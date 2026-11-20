/**
 * E2E-проверка подтверждения email (запуск: bun scripts/e2e-email-verification.ts).
 *
 * Цепочка:
 *   1) регистрация нового аккаунта (без сессии, письмо через SMTP из .env);
 *   2) вход до подтверждения → 403 needsVerification;
 *   3) неверный код → 400, верный код → 200 (код подбирается из SHA-256 хеша
 *      в БД ТОЛЬКО в рамках теста — в приложении такого пути нет);
 *   4) вход после подтверждения → 200 + cookie;
 *   5) демо-вход pasichnik работает как раньше (бэкфилл emailVerified);
 *   6) legacy-ссылка /api/auth/verify?token=... → редирект.
 *
 * Тестовый аккаунт в конце удаляется (каскадом сессии/токены).
 */
import { createHash } from 'node:crypto'
import { db } from '../src/lib/db'

const BASE = 'http://localhost:3000'
const NAME = 'e2e-mail-test'
const EMAIL = 'digitalhive@mail.ru' // реальный ящик из .env — Mail.ru не отклонит адрес отправителя
const PASSWORD = 'test1234'

let failed = 0
function check(step: string, cond: boolean, extra = '') {
  console.log(`${cond ? '✅' : '❌'} ${step}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failed++
}

async function post(path: string, body: unknown, cookie?: string) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  })
  let json: Record<string, unknown> = {}
  try {
    json = (await res.json()) as Record<string, unknown>
  } catch {}
  return { status: res.status, json, setCookie: res.headers.get('set-cookie') }
}

/** Подбор 6-значного кода по хешу — ТОЛЬКО для теста. */
function crackCode(hash: string): string | null {
  for (let n = 100000; n < 1000000; n++) {
    if (createHash('sha256').update(String(n)).digest('hex') === hash) return String(n)
  }
  return null
}

async function main() {
  // 0) чистим прошлые запуски теста
  await db.user.deleteMany({ where: { name: NAME } })

  // 1) Регистрация
  const reg = await post('/api/auth/register', { name: NAME, email: EMAIL, password: PASSWORD, role: 'BEEKEEPER' })
  check('register: 200', reg.status === 200, JSON.stringify(reg.json))
  check('register: без сессии (нет set-cookie)', !reg.setCookie)

  const user = await db.user.findUnique({ where: { name: NAME } })
  check('register: пользователь создан с email', !!user?.email && user.emailVerified === null)

  // 2) Вход ДО подтверждения
  const login0 = await post('/api/auth/login', { name: NAME, password: PASSWORD })
  check('login до подтверждения: 403 needsVerification', login0.status === 403 && login0.json.needsVerification === true, JSON.stringify(login0.json))
  check('login до подтверждения: email возвращён', login0.json.email === EMAIL)

  // 3) Код из БД (hash) + неверный/верный ввод
  const token = await db.verificationToken.findFirst({ where: { userId: user!.id } })
  check('verification: запись кода создана', !!token)
  const code = token ? crackCode(token.tokenHash) : null
  check('verification: код найден по хешу', !!code)

  const bad = await post('/api/auth/verify-code', { email: EMAIL, code: '000000' })
  check('verify-code: неверный код → 400', bad.status === 400, JSON.stringify(bad.json))

  const fmt = await post('/api/auth/verify-code', { email: EMAIL, code: 'abc' })
  check('verify-code: не 6 цифр → 400', fmt.status === 400)

  const ok = await post('/api/auth/verify-code', { email: EMAIL, code: code! })
  check('verify-code: верный код → 200', ok.status === 200, JSON.stringify(ok.json))

  const reuse = await post('/api/auth/verify-code', { email: EMAIL, code: code! })
  check('verify-code: повторное использование → expired 400', reuse.status === 400)

  const verified = await db.user.findUnique({ where: { name: NAME } })
  check('verify-code: emailVerified проставлен', verified?.emailVerified !== null)

  // 4) Вход ПОСЛЕ подтверждения
  const login1 = await post('/api/auth/login', { name: NAME, password: PASSWORD })
  check('login после подтверждения: 200 + cookie', login1.status === 200 && !!login1.setCookie, JSON.stringify(login1.json))

  // 5) Демо-вход не сломался
  const demo = await post('/api/auth/login', { name: 'pasichnik', password: 'uley2026' })
  check('демо-вход pasichnik: 200', demo.status === 200, JSON.stringify(demo.json))

  // 6) Legacy-ссылка
  const legacy = await fetch(`${BASE}/api/auth/verify?token=deadbeef`, { redirect: 'manual' })
  check('legacy verify: битый токен → redirect /login?error=invalid_token', legacy.status === 307 && String(legacy.headers.get('location')).includes('/login?error=invalid_token'), String(legacy.headers.get('location')))

  // 7) resend для несуществующего email не раскрывает аккаунт
  const ghost = await post('/api/auth/resend-verification', { email: 'nobody-nowhere@example.com' })
  check('resend: неизвестный email → 200 без раскрытия', ghost.status === 200, JSON.stringify(ghost.json))

  // Уборка: удаляем тестовый аккаунт (каскад — sessions, tokens)
  await db.user.deleteMany({ where: { name: NAME } })
  console.log(failed === 0 ? '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ' : `\nПРОВАЛЕНО: ${failed}`)
  process.exit(failed === 0 ? 0 : 1)
}

main().finally(() => db.$disconnect())
