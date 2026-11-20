/**
 * E2E-проверка приложения после удаления демо-режима (bun scripts/e2e-no-demo.ts):
 *   1) /api/map-points без параметра mode отдаёт ТОЛЬКО точки пользователя;
 *   2) привязка датчика по коду работает без mode/scope;
 *   3) /api/agent отвечает без body.mode;
 *   4) регистрация с подтверждением email работает как раньше;
 *   5) в ответах сервера нет упоминаний «Демо»/«Ростелеком».
 * Тестовый аккаунт удаляется в конце.
 */
import { createHash } from 'node:crypto'
import { db } from '../src/lib/db'

const BASE = 'http://localhost:3000'
const NAME = 'e2e-no-demo'
const EMAIL = 'digitalhive@mail.ru'
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

async function get(path: string, cookie: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Cookie: cookie }, cache: 'no-store' })
  const text = await res.text()
  let json: Record<string, unknown> = {}
  try {
    json = JSON.parse(text) as Record<string, unknown>
  } catch {}
  return { status: res.status, json, text }
}

function crackCode(hash: string): string | null {
  for (let n = 100000; n < 1000000; n++) {
    if (createHash('sha256').update(String(n)).digest('hex') === hash) return String(n)
  }
  return null
}

async function main() {
  await db.user.deleteMany({ where: { name: NAME } })

  // 1) регистрация + подтверждение email
  const reg = await post('/api/auth/register', { name: NAME, email: EMAIL, password: PASSWORD, role: 'BEEKEEPER' })
  check('register: 200 (письмо отправлено или предупреждение)', reg.status === 200, JSON.stringify(reg.json))
  const user = await db.user.findUnique({ where: { name: NAME } })
  const token = user ? await db.verificationToken.findFirst({ where: { userId: user.id } }) : null
  const code = token ? crackCode(token.tokenHash) : null
  const ver = await post('/api/auth/verify-code', { email: EMAIL, code: code ?? '000000' })
  check('verify-code: подтверждение работает', ver.status === 200, JSON.stringify(ver.json))

  const login = await post('/api/auth/login', { name: NAME, password: PASSWORD })
  check('login: 200 + cookie', login.status === 200 && !!login.setCookie)
  const cookie = (login.setCookie ?? '').split(';')[0]

  // 2) точки пользователя без параметра mode
  const pts0 = await get('/api/map-points', cookie)
  check('map-points GET: 200 без ?mode=', pts0.status === 200)
  check('map-points: у нового пользователя точек нет', Array.isArray(pts0.json.points) && (pts0.json.points as unknown[]).length === 0, JSON.stringify(pts0.json.points))

  // 3) привязка датчика без mode в теле
  const bind = await post('/api/map-points', { sensorCode: 'SN-2518-0712', name: 'Тестовый улей' }, cookie)
  check('map-points POST: привязка по коду (без mode)', bind.status === 200, JSON.stringify(bind.json.error ?? 'ok'))
  const pts1 = await get('/api/map-points', cookie)
  check('map-points: после привязки 1 точка с GPS датчика', (pts1.json.points as Array<{ sensorCode: string; lat: number }>)?.[0]?.sensorCode === 'SN-2518-0712' && (pts1.json.points as Array<{ lat: number }>)?.[0]?.lat === 54.0271)

  // 4) агент без body.mode
  const agent = await post('/api/agent', { question: 'Как дела на пасеке?' }, cookie)
  check('agent POST: 200 без body.mode', agent.status === 200, JSON.stringify(agent.json).slice(0, 120))
  const answerText = JSON.stringify(agent.json)
  check('agent: в ответе нет «Демо»/«Ростелеком»', !answerText.includes('Демо') && !answerText.includes('демо-режим') && !answerText.includes('Ростелеком'))

  // 5) данные и погода
  const data = await get('/api/data', cookie)
  check('data GET: 200', data.status === 200)
  const weather = await get('/api/weather?lat=54.0271&lon=55.7402', cookie)
  check('weather GET: 200 (реальные данные по точке)', weather.status === 200)

  // 6) страницы без «Демо»
  const home = await fetch(`${BASE}/`)
  const homeText = await home.text()
  check('страница /: в HTML нет «Демо-режим»/«Ростелеком»', !homeText.includes('Демо-режим') && !homeText.includes('Ростелеком'))
  const loginPage = await fetch(`${BASE}/login?verified=true`)
  const loginText = await loginPage.text()
  check('страница /login: нет блока демо-доступа', !loginText.includes('Демо-доступ') && !loginText.includes('pasichnik'))

  // уборка
  await db.user.deleteMany({ where: { name: NAME } })
  console.log(failed === 0 ? '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ' : `\nПРОВАЛЕНО: ${failed}`)
  process.exit(failed === 0 ? 0 : 1)
}

main().finally(() => db.$disconnect())
