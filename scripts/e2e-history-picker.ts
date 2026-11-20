/**
 * E2E-проверка новых функций:
 *  1) /api/history отдаёт группы «пасека → улей»;
 *  2) /api/history/ai — ИИ-анализ периода (день/месяц/год, с ульем и без);
 *  3) /api/agent — вопросы о здоровье пчёл уходят в сценарий care,
 *     а погодные — по-прежнему в weather.
 *
 * Пароль реального пользователя на время теста подменяется тестовым,
 * в конце — восстановление исходного хеша.
 */
import { PrismaClient } from '@prisma/client'
import { scryptSync, randomBytes } from 'node:crypto'

const db = new PrismaClient()
const KEY_LEN = 64
const BASE = 'http://localhost:3000'
const TEST_PASSWORD = 'e2e-hist-2026'

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(password, salt, KEY_LEN).toString('hex')}`
}

let passed = 0
let failed = 0
function check(name: string, cond: boolean, extra = '') {
  if (cond) {
    passed++
    console.log(`  OK   ${name}${extra ? ` — ${extra}` : ''}`)
  } else {
    failed++
    console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ''}`)
  }
}

async function main() {
  const user = await db.user.findFirst({ orderBy: { createdAt: 'asc' } })
  if (!user) throw new Error('В БД нет пользователей')
  const originalHash = user.passwordHash
  console.log(`Пользователь: ${user.name} (${user.role})`)

  // Подменяем пароль на тестовый
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(TEST_PASSWORD) },
  })

  try {
    /* Логин */
    const login = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: user.name, password: TEST_PASSWORD }),
    })
    check('логин', login.ok)
    const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')
    const H = { cookie }

    /* 1. Группы в /api/history */
    const hist = await fetch(`${BASE}/api/history?scope=day`, { headers: H })
    check('GET /api/history 200', hist.ok)
    const histJson = (await hist.json()) as {
      points: Array<{ id: string; name: string }>
      groups: Array<{ id: string; name: string; pointIds: string[] }>
      logs: Array<{ pointId: string; tempC: number }> | null
    }
    console.log('  points:', histJson.points.map((p) => p.name).join(', '))
    console.log(
      '  groups:',
      histJson.groups.map((g) => `«${g.name}» (${g.pointIds.length})`).join(', '),
    )
    check('groups присутствуют', Array.isArray(histJson.groups) && histJson.groups.length > 0)
    check(
      'все точки покрыты группами',
      histJson.groups.reduce((s, g) => s + g.pointIds.length, 0) === histJson.points.length,
    )
    const singleGroup = histJson.groups.length === 1 && histJson.groups[0].pointIds.length === histJson.points.length
    const multiGroup = histJson.groups.length > 1
    check(
      'пасеки сгруппированы (одна пасека или несколько)',
      singleGroup || multiGroup,
      histJson.groups.map((g) => g.name).join(' | '),
    )

    /* 2. ИИ-анализ */
    for (const scope of ['day', 'month', 'year'] as const) {
      const ai = await fetch(`${BASE}/api/history/ai?scope=${scope}`, { headers: H })
      check(`GET /api/history/ai?scope=${scope} 200`, ai.ok)
      const j = (await ai.json()) as {
        findings: Array<{ id: string; severity: string; title: string; problem: string; fix: string }>
      }
      check(`scope=${scope}: есть выводы`, j.findings.length > 0)
      check(
        `scope=${scope}: у каждого вывода есть «что не так» и «как исправить»`,
        j.findings.every((f) => f.problem.length > 10 && f.fix.length > 10),
      )
      console.log(
        `  анализ ${scope}:`,
        j.findings.map((f) => `[${f.severity}] ${f.title}`).join(' · '),
      )
    }
    const pointId = histJson.points[0]?.id
    if (pointId) {
      const ai = await fetch(`${BASE}/api/history/ai?scope=day&pointId=${pointId}`, { headers: H })
      const j = (await ai.json()) as { pointName: string | null; findings: Array<{ id: string }> }
      check('scope=day с ульем: pointName заполнен', j.pointName !== null, j.pointName ?? '—')
      check('scope=day с ульем: анализ получен', j.findings.length > 0)
    }

    /* 3. Агент: здоровье пчёл */
    const ask = async (question: string): Promise<{ error?: number; answer?: { scenario: string; engine: string; text: string } | null }> => {
      const res = await fetch(`${BASE}/api/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...H },
        body: JSON.stringify({ question }),
      })
      if (!res.ok) return { error: res.status }
      const j = (await res.json()) as { answer: { scenario: string; engine: string; text: string } }
      return j
    }

    const sick = await ask('Что делать, если пчёлы заболели?')
    check(
      '«пчёлы заболели» → сценарий care',
      !!sick.answer && sick.answer.scenario === 'care',
      sick.answer ? sick.answer.scenario : String(sick.error),
    )
    const foul = await ask('В улье похоже на гнилец, что делать?')
    check(
      '«гнилец» → care + ветслужба',
      !!foul.answer && foul.answer.scenario === 'care' && /ветеринар|ветслужб|ветлаборатор/i.test(foul.answer.text),
      foul.answer?.scenario ?? String(foul.error),
    )
    const varroa = await ask('Как обработать улей от клеща варроа?')
    check(
      '«клещ варроа» → care (а не пестициды поля)',
      !!varroa.answer && varroa.answer.scenario === 'care' && /варроа|обработк/i.test(varroa.answer.text),
      varroa.answer?.scenario ?? String(varroa.error),
    )
    const winter = await ask('Как подготовить пасеку к зимовке?')
    check(
      '«зимовка» → care + корм 18–25 кг',
      !!winter.answer && winter.answer.scenario === 'care' && /18–25|корм/i.test(winter.answer.text),
      winter.answer?.scenario ?? String(winter.error),
    )
    const weather = await ask('Какая сейчас погода на пасеке?')
    check(
      '«погода» → по-прежнему weather',
      !!weather.answer && weather.answer.scenario === 'weather',
      weather.answer?.scenario ?? String(weather.error),
    )
    const off = await ask('Кто выиграл вчера матч по футболу?')
    check(
      'офтопик → по-прежнему отказ',
      !!off.answer && off.answer.scenario === 'offtopic',
      off.answer?.scenario ?? String(off.error),
    )

    console.log(`\nИтог: ${passed} OK, ${failed} FAIL`)
  } finally {
    // Восстанавливаем исходный пароль
    await db.user.update({ where: { id: user.id }, data: { passwordHash: originalHash } })
    console.log('Пароль пользователя восстановлен')
    await db.$disconnect()
  }
  if (failed > 0) process.exit(1)
}

await main()
