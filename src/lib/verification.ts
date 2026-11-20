/**
 * Подтверждение email: коды и токены.
 *
 * КОД (основной способ): 6 цифр, crypto.randomInt. В БД хранится ТОЛЬКО
 * SHA-256 хеш кода (утечка базы не раскрывает код), сырой код уходит
 * пользователю в письме. Срок жизни — 30 минут, код одноразовый;
 * не более 5 неверных попыток ввода.
 *
 * ТОКЕН-ССЫЛКА (legacy, остался для /api/auth/verify): randomBytes(32) → hex,
 * в БД SHA-256 хеш, срок 24 часа, одноразовый.
 *
 * Плюс rate limit повторной отправки: не более 3 запросов на один email в час.
 * Хранение в памяти процесса (Map) — достаточно для этого приложения.
 */
import { createHash, randomBytes, randomInt } from 'node:crypto'
import { db } from './db'

export const VERIFICATION_TTL_MS = 24 * 3600 * 1000 // 24 часа (для токена-ссылки)
export const CODE_TTL_MS = 30 * 60 * 1000 // 30 минут (для кода из письма)
const MAX_CODE_ATTEMPTS = 5

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

/**
 * Создаёт новый токен подтверждения для пользователя. Предыдущие токены
 * пользователя удаляются — действительна всегда только последняя ссылка.
 * Возвращает СЫРОЙ токен (только для ссылки в письме).
 */
export async function issueVerificationToken(userId: string): Promise<string> {
  const raw = randomBytes(32).toString('hex')
  await db.verificationToken.deleteMany({ where: { userId } })
  await db.verificationToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
    },
  })
  return raw
}

export type ConsumeResult = { ok: true; userId: string } | { ok: false }

/* ------------------------------------------------------------------ */
/* КОД ПОДТВЕРЖДЕНИЯ (основной способ)                                  */
/* ------------------------------------------------------------------ */

/** userId → счётчик неверных попыток ввода кода. */
const codeAttempts = new Map<string, { count: number; firstAt: number }>()

function resetAttempts(userId: string): void {
  codeAttempts.delete(userId)
}

function failAttempt(userId: string): number {
  const now = Date.now()
  const rec = codeAttempts.get(userId)
  if (!rec || now - rec.firstAt > CODE_TTL_MS) {
    codeAttempts.set(userId, { count: 1, firstAt: now })
    return 1
  }
  rec.count += 1
  return rec.count
}

function attemptsLeft(userId: string): number {
  const rec = codeAttempts.get(userId)
  if (!rec || Date.now() - rec.firstAt > CODE_TTL_MS) return MAX_CODE_ATTEMPTS
  return Math.max(0, MAX_CODE_ATTEMPTS - rec.count)
}

/**
 * Создаёт новый 6-значный код подтверждения для пользователя. Предыдущие
 * записи пользователя удаляются — действителен всегда только последний код.
 * Возвращает СЫРОЙ код (только для письма).
 */
export async function issueVerificationCode(userId: string): Promise<string> {
  const code = String(randomInt(100000, 1000000))
  await db.verificationToken.deleteMany({ where: { userId } })
  await db.verificationToken.create({
    data: {
      userId,
      tokenHash: hashToken(code),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  })
  resetAttempts(userId)
  return code
}

export type CodeConsumeResult = 'ok' | 'invalid' | 'expired' | 'locked'

/**
 * Проверяет код из письма по email. Валидный и не истёкший — ставит
 * User.emailVerified и удаляет запись (одноразовость).
 * 'invalid' — неверный код (или аккаунта нет); 'expired' — срок вышел;
 * 'locked' — слишком много неверных попыток.
 */
export async function consumeVerificationCode(email: string, code: string): Promise<CodeConsumeResult> {
  const user = await db.user.findUnique({ where: { email } })
  if (!user) return 'invalid'

  const record = await db.verificationToken.findFirst({ where: { userId: user.id } })
  if (!record) return 'expired'

  if (record.expiresAt.getTime() < Date.now()) {
    await db.verificationToken.delete({ where: { id: record.id } }).catch(() => undefined)
    return 'expired'
  }

  if (attemptsLeft(user.id) <= 0) return 'locked'

  if (hashToken(code) !== record.tokenHash) {
    const fails = failAttempt(user.id)
    return fails >= MAX_CODE_ATTEMPTS ? 'locked' : 'invalid'
  }

  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } }),
    db.verificationToken.delete({ where: { id: record.id } }),
  ])
  resetAttempts(user.id)
  return 'ok'
}

/**
 * Проверяет сырой токен из ссылки. Если он валиден и не истёк — ставит
 * User.emailVerified = текущая дата и удаляет запись токена (одноразовость).
 * Невалидный / истёкший / отсутствующий → { ok: false }.
 */
export async function consumeVerificationToken(raw: string | null): Promise<ConsumeResult> {
  if (!raw) return { ok: false }
  const record = await db.verificationToken.findUnique({ where: { tokenHash: hashToken(raw) } })
  if (!record) return { ok: false }

  if (record.expiresAt.getTime() < Date.now()) {
    // Истёкший токен сразу чистим, чтобы не копился мусор.
    await db.verificationToken.delete({ where: { id: record.id } }).catch(() => undefined)
    return { ok: false }
  }

  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { emailVerified: new Date() } }),
    db.verificationToken.delete({ where: { id: record.id } }),
  ])
  return { ok: true, userId: record.userId }
}

/* ------------------------------------------------------------------ */
/* Rate limit повторной отправки: 3 запроса на email в час              */
/* ------------------------------------------------------------------ */

const RESEND_WINDOW_MS = 3600 * 1000 // 1 час
const RESEND_MAX_PER_WINDOW = 3

/** email (в нижнем регистре) → времена запросов внутри текущего часа. */
const resendHits = new Map<string, number[]>()

export function checkResendRateLimit(email: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now()
  const list = (resendHits.get(email) ?? []).filter((t) => now - t < RESEND_WINDOW_MS)

  if (list.length >= RESEND_MAX_PER_WINDOW) {
    const retryAfterSec = Math.max(1, Math.ceil((RESEND_WINDOW_MS - (now - list[0])) / 1000))
    resendHits.set(email, list)
    return { allowed: false, retryAfterSec }
  }

  list.push(now)
  resendHits.set(email, list)
  return { allowed: true, retryAfterSec: 0 }
}
