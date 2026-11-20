/**
 * Сессии пользователей: scrypt-пароли (см. password.ts), токен сессии в БД,
 * HttpOnly-cookie. Роли: BEEKEEPER (пасечник — полный доступ), HELPER (помощник
 * — только просмотр). Совместимо и с серверными компонентами, и с route handlers.
 */
import { cookies } from 'next/headers'
import { randomBytes } from 'node:crypto'
import { db } from './db'
import { hashPassword, verifyPassword } from './password'
import type { Role, SafeUser } from './api-types'

export const SESSION_COOKIE = 'uley_session'
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000 // 30 дней

/**
 * Требуется ли подтверждение email. ВКЛЮЧЕНО — эталон upload/почта.txt:
 * регистрация без сессии, 6-значный код на почту (TTL 30 мин, до 5 попыток
 * ввода, resend — не чаще 3 раз в час), вход в неподтверждённый аккаунт
 * возвращает 403 needsVerification и открывает экран «Проверьте почту».
 * Отключить на время можно, поставив false — тогда регистрация сразу логинит.
 */
export const EMAIL_VERIFICATION_REQUIRED = true

export interface AuthResult {
  user: SafeUser
  token: string
}

function toSafeUser(u: { id: string; name: string; role: string; displayName: string | null; avatar: string | null }): SafeUser {
  return { id: u.id, name: u.name, displayName: u.displayName, avatar: u.avatar, role: u.role as Role }
}

/** Результат входа: успех, неподтверждённый email или неверные данные. */
export type LoginResult =
  | { status: 'ok'; result: AuthResult }
  | { status: 'unverified'; email: string } // есть email, но он не подтверждён
  | { status: 'invalid' } // неверное имя или пароль

export async function loginUser(name: string, password: string): Promise<LoginResult> {
  const user = await db.user.findUnique({ where: { name } })
  if (!user || !verifyPassword(password, user.passwordHash)) return { status: 'invalid' }
  // Эталон upload/почта.txt: вход только для аккаунтов с подтверждённым email.
  // Сессия НЕ создаётся, пока email не подтверждён.
  if (EMAIL_VERIFICATION_REQUIRED && user.email && !user.emailVerified) {
    return { status: 'unverified', email: user.email }
  }
  const token = await createSession(user.id)
  return { status: 'ok', result: { user: toSafeUser(user), token } }
}

export interface RegisteredUser {
  id: string
  name: string
  email: string
  role: Role
}

/**
 * Создаёт неподтверждённого пользователя (email + пароль) БЕЗ сессии.
 * Токен подтверждения и отправку письма выполняет вызывающий маршрут
 * (см. src/lib/verification.ts и /api/auth/register).
 */
export async function registerUser(
  name: string,
  email: string,
  password: string,
  role: Role,
): Promise<{ ok: true; user: RegisteredUser } | { ok: false; error: string }> {
  const existsName = await db.user.findUnique({ where: { name } })
  if (existsName) return { ok: false, error: 'Пользователь с таким именем уже есть' }
  const existsEmail = await db.user.findUnique({ where: { email } })
  if (existsEmail) return { ok: false, error: 'Пользователь с таким email уже зарегистрирован' }
  const user = await db.user.create({
    data: { name, email, passwordHash: hashPassword(password), role },
  })
  // Сессию намеренно не создаём: доступ открывается только после подтверждения email.
  return { ok: true, user: { id: user.id, name: user.name, email: user.email as string, role: user.role as Role } }
}

async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex')
  await db.session.create({
    data: { token, userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  })
  return token
}

/**
 * Активация аккаунта без подтверждения почты (когда EMAIL_VERIFICATION_REQUIRED = false):
 * помечает email подтверждённым и сразу создаёт сессию.
 * Возвращает null, если пользователь не найден.
 */
export async function activateAndLogin(userId: string): Promise<AuthResult | null> {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) return null
  if (user.email && !user.emailVerified) {
    await db.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } })
  }
  const token = await createSession(user.id)
  return { user: toSafeUser(user), token }
}

/** Текущий пользователь по cookie-сессии (или null). */
export async function getSessionUser(): Promise<SafeUser | null> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null
  const session = await db.session.findUnique({ where: { token }, include: { user: true } })
  if (!session) return null
  if (session.expiresAt.getTime() < Date.now()) {
    await db.session.deleteMany({ where: { token } }).catch(() => undefined)
    return null
  }
  return toSafeUser(session.user)
}

/** Удаляет сессию по токену (для logout). */
export async function destroySessionByToken(token: string | undefined): Promise<void> {
  if (!token) return
  await db.session.deleteMany({ where: { token } }).catch(() => undefined)
}

/** Guard для маршрутов, изменяющих данные: только пасечник. */
export async function requireBeekeeper(): Promise<
  { ok: true; user: SafeUser } | { ok: false; status: 401 | 403; error: string }
> {
  const user = await getSessionUser()
  if (!user) return { ok: false, status: 401, error: 'Нужен вход в систему' }
  if (user.role !== 'BEEKEEPER') {
    return { ok: false, status: 403, error: 'Только пасечник может изменять данные' }
  }
  return { ok: true, user }
}

/** Cookie-опции для сессии. */
export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_TTL_MS / 1000,
}
