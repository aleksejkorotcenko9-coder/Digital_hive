// Проверка /api/history: привязка датчиков, ленивый засев журнала,
// scopes день/месяц/год, пустые периоды, тревожные события.
import { db } from '../src/lib/db'

void db // модульный файл (не глобальный скрипт): объединяем scope с проектом

const BASE = 'http://localhost:3000'
let fails = 0
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${cond ? '' : ' :: ' + extra}`)
  if (!cond) fails++
}

async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'tmp-field-test', password: 'uley2026' }),
  })
  check('login tmp-пользователя', login.ok)
  const cookie = (login.headers.getSetCookie?.() ?? [login.headers.get('set-cookie') ?? ''])
    .map((c) => c.split(';')[0]).join('; ')

  // привязываем два датчика (свободные 0711/0712 — поле у Белебея)
  for (const code of ['SN-2518-0711', 'SN-2518-0712']) {
    const r = await fetch(`${BASE}/api/map-points`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ sensorCode: code, name: code.endsWith('0711') ? 'Улей А' : 'Улей Б' }),
    })
    check(`привязка ${code}`, r.ok, `${r.status} ${await r.text()}`)
  }

  const t0 = Date.now()
  const day = await fetch(`${BASE}/api/history?scope=day`, { headers: { Cookie: cookie } })
  const dj = await day.json() as {
    scope: string; date: string; points: Array<{ id: string; name: string }>;
    range: { from: string; to: string }; logs: Array<{ pointId: string; recordedAt: string; weightKg: number; tempC: number; humidityPct: number; alarm: boolean }>
  }
  console.log(`первый запрос (ленивый засев 2 ульев): ${Date.now() - t0} мс`)
  check('scope=day: 200', day.ok)
  check('день по умолчанию — последний с данными (2026-08-29)', dj.date === '2026-08-29', dj.date)
  check('диапазон журнала 01.07–29.08', dj.range.from === '2026-07-01' && dj.range.to === '2026-08-29', JSON.stringify(dj.range))
  check('ленивый засев: 2 улья в points', dj.points.length === 2, JSON.stringify(dj.points))
  check('24 часа × 2 улья = 48 записей', dj.logs?.length === 48, String(dj.logs?.length))
  const h8 = dj.logs?.filter((l) => l.recordedAt.endsWith('T08:00:00.000Z') )
  const h8a = h8?.find((l) => l.pointId === dj.points[0].id)
  check('якорь 8:00 совпадает с CSV (77.1 кг / 36.3°C / 64%)', !!h8a && h8a.weightKg === 77.1 && h8a.tempC === 36.3 && h8a.humidityPct === 64, JSON.stringify(h8a))
  const h20a = dj.logs?.find((l) => l.pointId === dj.points[0].id && l.recordedAt.endsWith('T20:00:00.000Z'))
  check('якорь 20:00 совпадает с CSV (77.3 кг / 36.3°C / 66%)', !!h20a && h20a.weightKg === 77.3 && h20a.tempC === 36.3 && h20a.humidityPct === 66, JSON.stringify(h20a))
  const alarms = dj.logs?.filter((l) => l.alarm).length ?? 0
  check('есть тревожные события (t≥36.5 или влажн≥73)', alarms > 0, String(alarms))

  // месяц
  const month = await fetch(`${BASE}/api/history?scope=month&month=2026-08`, { headers: { Cookie: cookie } })
  const mj = await month.json() as { date: string; days: Array<{ date: string; perPoint: Array<{ pointId: string; avgTempC: number; deltaWeightKg: number; logs: number; alarms: number; startWeightKg: number; endWeightKg: number }> }> }
  check('scope=month: 200', month.ok)
  check('29 дней августа с записями', mj.days?.length === 29, String(mj.days?.length))
  const d29 = mj.days?.[28]
  check('день 29.08: по 24 записи на улей', d29?.perPoint.every((p) => p.logs === 24), JSON.stringify(d29))
  check('день 29.08: дельта веса положительная', d29?.perPoint.every((p) => p.deltaWeightKg > 0), JSON.stringify(d29?.perPoint.map((p) => p.deltaWeightKg)))

  // год
  const year = await fetch(`${BASE}/api/history?scope=year&year=2026`, { headers: { Cookie: cookie } })
  const yj = await year.json() as { date: string; months: Array<{ month: string; perPoint: Array<{ pointId: string; deltaWeightKg: number; logs: number }> }> }
  check('scope=year: 200', year.ok)
  check('2 месяца с данными (07, 08)', yj.months?.length === 2, JSON.stringify(yj.months?.map((m) => m.month)))
  const jul = yj.months?.find((m) => m.month === '2026-07')
  check('июль: по 744 записи на улей (31 день)', jul?.perPoint.every((p) => p.logs === 744) ?? false, JSON.stringify(jul?.perPoint.map((p) => p.logs)))

  // пустые периоды
  const emptyDay = await fetch(`${BASE}/api/history?scope=day&date=2026-09-15`, { headers: { Cookie: cookie } })
  const ej = await emptyDay.json() as { logs: unknown[]; date: string }
  check('день вне диапазона: 200 и пусто', emptyDay.ok && ej.logs?.length === 0, `${emptyDay.status} ${JSON.stringify(ej.logs)?.slice(0, 80)}`)
  const bad = await fetch(`${BASE}/api/history?scope=day&date=garbage`, { headers: { Cookie: cookie } })
  check('неверная дата: 400', bad.status === 400, String(bad.status))

  // без сессии
  const anon = await fetch(`${BASE}/api/history?scope=day`)
  check('без входа: 401', anon.status === 401, String(anon.status))

  console.log(fails === 0 ? '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ' : `\nПРОВАЛОВ: ${fails}`)
  process.exit(fails === 0 ? 0 : 1)
}
main()
