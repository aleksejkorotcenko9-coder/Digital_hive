import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { ensureSeeded } from '@/lib/bootstrap'
import { db } from '@/lib/db'
import { ensureSensorHistory } from '@/lib/history-seed'
import type { HistoryInsightDto, HistoryScope } from '@/lib/api-types'

/**
 * GET /api/history/ai?scope=day&date=2026-08-29&pointId=…
 * GET /api/history/ai?scope=month&month=2026-08&pointId=…
 * GET /api/history/ai?scope=year&year=2026&pointId=…
 *
 * ИИ-анализ журнала за выбранный период: агент смотрит на те же данные, что и
 * графики раздела «История событий», находит проблемы (перегрев и переохлаждение
 * семьи, сырость и сухость, падение массы, слабый привес, много тревожных часов)
 * и для каждой кратко объясняет, что не так и как это исправить.
 *
 * Пороги — те же, что у тревожных событий журнала (lib/history-generate.ts):
 * норма семьи с расплодом 33,5–36,7 °C, комфортная влажность 45–75 %.
 * Все границы периодов — UTC, как и в основном маршруте журнала.
 */

const r1 = (v: number) => Math.round(v * 10) / 10

/** Число по-русски: 36,5 / −2,3. */
function fmt(n: number, digits = 1): string {
  return n.toFixed(digits).replace('.', ',').replace('-', '−')
}
function fmtSigned(n: number, digits = 1): string {
  return `${n >= 0 ? '+' : ''}${fmt(n, digits)}`
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function parseDayKey(key: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null
  const ms = Date.parse(`${key}T00:00:00Z`)
  return Number.isFinite(ms) ? new Date(ms) : null
}

/** Агрегированная статистика одного улья за период. */
interface PointStat {
  pointId: string
  name: string
  logs: number
  avgT: number
  minT: number
  maxT: number
  avgH: number
  minH: number
  maxH: number
  startWeight: number | null
  endWeight: number | null
  deltaWeight: number | null
  alarms: number
}

const PERIOD_WORD = { day: 'за день', month: 'за месяц', year: 'за год' } as const

/** Сборка статистики по ульям из сырых записей журнала. */
function computeStats(
  rows: Array<{ pointId: string; weightKg: number; tempC: number; humidityPct: number; recordedAt: Date }>,
  pointNames: Map<string, string>,
): PointStat[] {
  const acc = new Map<string, {
    logs: number
    sumT: number
    minT: number
    maxT: number
    sumH: number
    minH: number
    maxH: number
    firstW: number | null
    lastW: number | null
    firstTs: number
    lastTs: number
  }>()
  for (const r of rows) {
    let a = acc.get(r.pointId)
    if (!a) {
      a = { logs: 0, sumT: 0, minT: Infinity, maxT: -Infinity, sumH: 0, minH: Infinity, maxH: -Infinity, firstW: null, lastW: null, firstTs: 0, lastTs: 0 }
      acc.set(r.pointId, a)
    }
    a.logs++
    a.sumT += r.tempC
    a.minT = Math.min(a.minT, r.tempC)
    a.maxT = Math.max(a.maxT, r.tempC)
    a.sumH += r.humidityPct
    a.minH = Math.min(a.minH, r.humidityPct)
    a.maxH = Math.max(a.maxH, r.humidityPct)
    const ts = r.recordedAt.getTime()
    if (a.firstW === null || ts < a.firstTs) {
      a.firstW = r.weightKg
      a.firstTs = ts
    }
    if (a.lastW === null || ts >= a.lastTs) {
      a.lastW = r.weightKg
      a.lastTs = ts
    }
  }
  // Тревожные часы считаем по тем же порогам, что и журнал (isHistoryAlarm):
  // перегрев/переохлаждение, сырость/сухость, падение веса от часа к часу.
  const isAlarm = (t: number, h: number, prevW: number | null, w: number) =>
    t >= 36.8 || t <= 33.4 || h >= 76 || h <= 44 || (prevW !== null && w <= prevW - 0.3)
  const byPoint = new Map<string, Array<{ ts: number; w: number; t: number; h: number }>>()
  for (const r of rows) {
    const arr = byPoint.get(r.pointId) ?? []
    arr.push({ ts: r.recordedAt.getTime(), w: r.weightKg, t: r.tempC, h: r.humidityPct })
    byPoint.set(r.pointId, arr)
  }
  const alarms = new Map<string, number>()
  for (const [pid, arr] of byPoint) {
    arr.sort((x, y) => x.ts - y.ts)
    let n = 0
    let prevW: number | null = null
    for (const it of arr) {
      if (isAlarm(it.t, it.h, prevW, it.w)) n++
      prevW = it.w
    }
    alarms.set(pid, n)
  }
  return [...acc.entries()].map(([pid, a]) => ({
    pointId: pid,
    name: pointNames.get(pid) ?? 'Улей',
    logs: a.logs,
    avgT: a.logs ? a.sumT / a.logs : 0,
    minT: a.minT,
    maxT: a.maxT,
    avgH: a.logs ? a.sumH / a.logs : 0,
    minH: a.minH,
    maxH: a.maxH,
    startWeight: a.firstW,
    endWeight: a.lastW,
    deltaWeight: a.firstW !== null && a.lastW !== null ? r1(a.lastW - a.firstW) : null,
    alarms: alarms.get(pid) ?? 0,
  }))
}

/** Пороги из lib/history-generate.ts — анализ сходится с тревогами журнала. */
const T_MAX = 36.8
const T_MIN = 33.4
const H_WET = 76
const H_DRY = 44

function buildFindings(stats: PointStat[], scope: HistoryScope): HistoryInsightDto[] {
  const out: HistoryInsightDto[] = []
  const period = PERIOD_WORD[scope]
  const withData = stats.filter((s) => s.logs > 0)

  if (withData.length === 0) {
    return [
      {
        id: 'nodata',
        severity: 'warn',
        title: 'Данных за период нет',
        problem: 'В журнале за выбранный период записей не нашлось, поэтому анализировать нечего — цифры я не выдумываю.',
        fix: 'Выберите другой день, месяц или год стрелками или в календаре: журнал ведётся с 1 июля по 29 августа 2026.',
        metrics: [],
        pointName: null,
      },
    ]
  }

  const single = withData.length === 1 ? withData[0] : null
  const worst = (pick: (s: PointStat) => number, dir: 'max' | 'min'): PointStat =>
    dir === 'max'
      ? [...withData].sort((a, b) => pick(b) - pick(a))[0]
      : [...withData].sort((a, b) => pick(a) - pick(b))[0]

  /* Перегрев */
  const hot = worst((s) => s.maxT, 'max')
  if (hot.maxT >= T_MAX) {
    out.push({
      id: 'hot',
      severity: 'danger',
      title: single ? 'Перегрев семьи' : `Перегрев: ${hot.name}`,
      problem: `Температура${single ? '' : ` в «${hot.name}»`} поднималась до ${fmt(hot.maxT)} °C — выше верхней границы нормы для семьи с расплодом (36,7 °C). В жаре семья тратит силы на охлаждение гнезда, а не на медосбор.`,
      fix: 'Притените улей от полуденного солнца, усильте вентиляцию — приоткройте верхний леток, и поставьте поилку рядом с пасекой.',
      metrics: [
        { label: 'Макс. t°', value: `${fmt(hot.maxT)} °C` },
        { label: 'Норма', value: 'до 36,7 °C' },
      ],
      pointName: single ? null : hot.name,
    })
  }

  /* Переохлаждение */
  const cold = worst((s) => s.minT, 'min')
  if (cold.minT <= T_MIN) {
    out.push({
      id: 'cold',
      severity: 'warn',
      title: single ? 'Переохлаждение семьи' : `Переохлаждение: ${cold.name}`,
      problem: `Минимальная температура${single ? '' : ` в «${cold.name}»`} опускалась до ${fmt(cold.minT)} °C — ниже нормы расплода 33,5 °C. На холодном гнезде семья греет расплод вместо работы.`,
      fix: 'Проверьте щели и сократите лишнее пространство: сузьте гнездо, уменьшите леток — семье легче держать тепло на меньшем объёме.',
      metrics: [
        { label: 'Мин. t°', value: `${fmt(cold.minT)} °C` },
        { label: 'Норма', value: 'от 33,5 °C' },
      ],
      pointName: single ? null : cold.name,
    })
  }

  /* Сырость */
  const wet = worst((s) => s.maxH, 'max')
  if (wet.maxH >= H_WET) {
    out.push({
      id: 'wet',
      severity: 'danger',
      title: single ? 'Сырость в улье' : `Сырость: ${wet.name}`,
      problem: `Влажность${single ? '' : ` в «${wet.name}»`} доходила до ${fmt(wet.maxH, 0)} % — выше комфортных 75 %. Сырое гнездо ведёт к плесени, закисанию корма и гнильцам.`,
      fix: 'Усильте вентиляцию улья, проверьте крышу и подставку — улей не должен стоять в низине; при необходимости замените сырые рамки.',
      metrics: [
        { label: 'Макс. влажн.', value: `${fmt(wet.maxH, 0)} %` },
        { label: 'Комфорт', value: '45–75 %' },
      ],
      pointName: single ? null : wet.name,
    })
  }

  /* Сухость */
  const dry = worst((s) => s.minH, 'min')
  if (dry.minH <= H_DRY) {
    out.push({
      id: 'dry',
      severity: 'warn',
      title: single ? 'Слишком сухой воздух' : `Сухо: ${dry.name}`,
      problem: `Влажность${single ? '' : ` в «${dry.name}»`} падала до ${fmt(dry.minH, 0)} % — ниже комфортных 45 %. Пересушенный воздух сушит корм и затрудняет вывод расплода.`,
      fix: 'Поставьте поилку с водой у пасеки и оставьте в улье сот с водой; в жару полезна влажная прилетковая доска.',
      metrics: [
        { label: 'Мин. влажн.', value: `${fmt(dry.minH, 0)} %` },
        { label: 'Комфорт', value: '45–75 %' },
      ],
      pointName: single ? null : dry.name,
    })
  }

  /* Падение массы */
  const drop = worst((s) => s.deltaWeight ?? 0, 'min')
  const dropLimit = scope === 'day' ? -0.5 : -1
  if (drop.deltaWeight !== null && drop.deltaWeight <= dropLimit) {
    out.push({
      id: 'weight-drop',
      severity: 'danger',
      title: single ? `Масса улья снижается (${period})` : `Падение массы: ${drop.name}`,
      problem: `${period} масса${single ? '' : ` «${drop.name}»`} снизилась на ${fmt(Math.abs(drop.deltaWeight))} кг (с ${fmt(drop.startWeight ?? 0)} до ${fmt(drop.endWeight ?? 0)} кг). В сезон медосбора вес должен расти или стоять.`,
      fix: 'Осмотрите улей в ближайший день: возможны воровство пчёл, роевое состояние или срыв медосбора — сократите летки и проверьте рамки с кормом.',
      metrics: [
        { label: `Изменение ${period}`, value: `${fmtSigned(drop.deltaWeight)} кг` },
        { label: 'Вес в конце', value: `${fmt(drop.endWeight ?? 0)} кг` },
      ],
      pointName: single ? null : drop.name,
    })
  }

  /* Слабый привес — сравнение с лидером пасеки */
  const withGain = withData.filter((s) => s.deltaWeight !== null)
  if (withGain.length >= 2) {
    const leader = [...withGain].sort((a, b) => (b.deltaWeight ?? 0) - (a.deltaWeight ?? 0))[0]
    const laggard = withGain.find(
      (s) => s.pointId !== leader.pointId && (s.deltaWeight ?? 0) < (leader.deltaWeight ?? 0) * 0.6 && (leader.deltaWeight ?? 0) > 1,
    )
    if (laggard) {
      out.push({
        id: 'weak-gain',
        severity: 'warn',
        title: `Слабый привес: ${laggard.name}`,
        problem: `«${laggard.name}» набрала ${fmtSigned(laggard.deltaWeight ?? 0)} кг ${period}, а лидер пасеки «${leader.name}» — ${fmtSigned(leader.deltaWeight ?? 0)} кг. Разница больше 40 % — это заметно.`,
        fix: 'Проверьте семью: сила семьи, матка и кормовая база. Слабую семью усильте расплодом от сильной или подкормите сиропом в вечернее время.',
        metrics: [
          { label: laggard.name, value: `${fmtSigned(laggard.deltaWeight ?? 0)} кг` },
          { label: `Лидер ${leader.name}`, value: `${fmtSigned(leader.deltaWeight ?? 0)} кг` },
        ],
        pointName: laggard.name,
      })
    }
  }

  /* Много тревожных часов */
  const alarmLeader = worst((s) => s.alarms, 'max')
  const alarmLimit = scope === 'day' ? 3 : 10
  if (alarmLeader.alarms > alarmLimit) {
    out.push({
      id: 'alarms',
      severity: 'warn',
      title: single ? 'Много тревожных часов' : `Частые тревоги: ${alarmLeader.name}`,
      problem: `В журнале ${period} ${alarmLeader.alarms} тревожных часов${single ? '' : ` в «${alarmLeader.name}»`} — выше верхней границы нормы для температуры, влажности или веса.`,
      fix: 'Откройте тревожные часы в журнале и посмотрите, какой параметр выходит за норму чаще всего, — по нему и ищите причину на месте.',
      metrics: [{ label: 'Тревожных часов', value: String(alarmLeader.alarms) }],
      pointName: single ? null : alarmLeader.name,
    })
  }

  if (out.length === 0) {
    const totalLogs = withData.reduce((s, x) => s + x.logs, 0)
    const avgT = withData.reduce((s, x) => s + x.avgT * x.logs, 0) / totalLogs
    const avgH = withData.reduce((s, x) => s + x.avgH * x.logs, 0) / totalLogs
    const gain = withData.reduce((s, x) => s + (x.deltaWeight ?? 0), 0)
    out.push({
      id: 'ok',
      severity: 'ok',
      title: 'Всё в штатном режиме',
      problem: `Существенных отклонений ${period} я не нашёл: температура и влажность внутри ульев держатся в рабочем диапазоне, резких провалов массы нет${gain > 0 ? `, вес пасеки вырос на ${fmtSigned(gain)} кг` : ''}.`,
      fix: 'Продолжайте наблюдение: как только в журнале появится отклонение от нормы, я сразу отмечу проблемные часы и подскажу, что делать.',
      metrics: [
        { label: 'Ср. t°', value: `${fmt(avgT)} °C` },
        { label: 'Ср. влажн.', value: `${fmt(avgH, 0)} %` },
        { label: 'Записей', value: String(totalLogs) },
      ],
      pointName: null,
    })
  }

  const rank = { danger: 0, warn: 1, ok: 2 } as const
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]).slice(0, 6)
}

export async function GET(req: Request) {
  await ensureSeeded()
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Нужен вход в систему' }, { status: 401 })
  }
  await ensureSensorHistory(user.id)

  const sp = new URL(req.url).searchParams
  const scopeParam = (sp.get('scope') ?? 'day') as HistoryScope
  const scope: HistoryScope = ['day', 'month', 'year'].includes(scopeParam) ? scopeParam : 'day'
  const pointIdParam = sp.get('pointId')

  const pointRows = await db.apiaryPoint.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true },
  })
  const pointNames = new Map(pointRows.map((p) => [p.id, p.name]))
  const pointId = pointIdParam && pointNames.has(pointIdParam) ? pointIdParam : null

  const agg = await db.sensorLog.aggregate({
    where: { userId: user.id },
    _min: { recordedAt: true },
    _max: { recordedAt: true },
  })
  const latest = agg._max.recordedAt
    ? dayKey(agg._max.recordedAt)
    : '2026-08-29' // последний день якорной выгрузки

  let start: Date | null
  let end: Date | null
  let dateLabel: string
  if (scope === 'day') {
    const key = sp.get('date') ?? latest
    start = parseDayKey(key)
    if (!start) return NextResponse.json({ error: 'Неверный формат даты — ожидается yyyy-MM-dd' }, { status: 400 })
    end = new Date(start.getTime() + 86400000)
    dateLabel = key
  } else if (scope === 'month') {
    const key = sp.get('month') ?? latest.slice(0, 7)
    start = parseDayKey(`${key}-01`)
    if (!start) return NextResponse.json({ error: 'Неверный формат месяца — ожидается yyyy-MM' }, { status: 400 })
    end = new Date(start.getTime())
    end.setUTCMonth(end.getUTCMonth() + 1)
    dateLabel = key
  } else {
    const key = sp.get('year') ?? latest.slice(0, 4)
    if (!/^\d{4}$/.test(key)) return NextResponse.json({ error: 'Неверный формат года — ожидается yyyy' }, { status: 400 })
    start = parseDayKey(`${key}-01-01`)
    if (!start) return NextResponse.json({ error: 'Неверный формат года — ожидается yyyy' }, { status: 400 })
    const endYear = parseDayKey(`${Number(key) + 1}-01-01`)
    if (!endYear) return NextResponse.json({ error: 'Неверный формат года — ожидается yyyy' }, { status: 400 })
    end = endYear
    dateLabel = key
  }

  const rows = await db.sensorLog.findMany({
    where: {
      userId: user.id,
      ...(pointId ? { pointId } : {}),
      recordedAt: { gte: start, lt: end },
    },
    orderBy: { recordedAt: 'asc' },
    select: { pointId: true, recordedAt: true, weightKg: true, tempC: true, humidityPct: true },
  })

  const stats = computeStats(rows, pointNames)
  const findings = buildFindings(stats, scope)

  const body = {
    scope,
    date: dateLabel,
    pointName: pointId ? (pointNames.get(pointId) ?? null) : null,
    findings,
  }
  return NextResponse.json(body)
}
