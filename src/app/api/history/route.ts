import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { ensureSeeded } from '@/lib/bootstrap'
import { db } from '@/lib/db'
import { ensureSensorHistory, isHistoryAlarm, HISTORY_RANGE } from '@/lib/history-seed'
import { groupApiaryPoints } from '@/lib/apiary-groups'
import type {
  HistoryDayPointDto,
  HistoryDaySummaryDto,
  HistoryLogDto,
  HistoryMonthPointDto,
  HistoryMonthSummaryDto,
  HistoryPointDto,
  HistoryResponse,
  HistoryScope,
} from '@/lib/api-types'

/**
 * GET /api/history?scope=day&date=2026-08-29   — почасовые записи выбранного дня
 * GET /api/history?scope=month&month=2026-08   — сводка по дням месяца
 * GET /api/history?scope=year&year=2026        — сводка по месяцам года
 *
 * Источник — журнал SensorLog: параметры ульев фиксируются каждый час.
 * ensureSensorHistory лениво наполняет журнал по якорной CSV-выгрузке.
 * Все границы периодов — в UTC, чтобы показывать «стеночные часы» таблицы
 * телеметрии независимо от часового пояса браузера.
 */

const r1 = (v: number) => Math.round(v * 10) / 10

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7)
}

/** «yyyy-mm-dd» → Date (00:00 UTC). */
function parseDayKey(key: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null
  const ms = Date.parse(`${key}T00:00:00Z`)
  return Number.isFinite(ms) ? new Date(ms) : null
}

function ok(
  scope: HistoryScope,
  date: string,
  points: HistoryPointDto[],
  groups: ReturnType<typeof groupApiaryPoints>,
  range: { from: string; to: string },
  extra: Omit<HistoryResponse, 'scope' | 'date' | 'points' | 'groups' | 'range'>,
) {
  const body: HistoryResponse = { scope, date, points, groups, range, ...extra }
  return NextResponse.json(body)
}

export async function GET(req: Request) {
  await ensureSeeded()
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Нужен вход в систему' }, { status: 401 })
  }

  // Ленивый засев журнала (идемпотентно): у каждого улья с датчиком появляется
  // почасовая история за период выгрузки.
  await ensureSensorHistory(user.id)

  const sp = new URL(req.url).searchParams
  const scopeParam = (sp.get('scope') ?? 'day') as HistoryScope
  const scope: HistoryScope = ['day', 'month', 'year'].includes(scopeParam) ? scopeParam : 'day'

  const pointsRows = await db.apiaryPoint.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, sensorCode: true },
  })
  const pointNames = new Map(pointsRows.map((p) => [p.id, p.name]))
  // Пасеки для каскадного выбора «пасека → улей»: группа точек, стоящих рядом
  const groups = groupApiaryPoints(pointsRows)

  // Доступный диапазон журнала пользователя
  const agg = await db.sensorLog.aggregate({
    where: { userId: user.id },
    _min: { recordedAt: true },
    _max: { recordedAt: true },
  })
  const range = {
    from: agg._min.recordedAt ? dayKey(agg._min.recordedAt) : HISTORY_RANGE.from,
    to: agg._max.recordedAt ? dayKey(agg._max.recordedAt) : HISTORY_RANGE.to,
  }

  const points: HistoryPointDto[] = pointsRows.map((p) => ({ id: p.id, name: p.name }))
  if (scope === 'day') {
    // без явной даты — последний день с данными; неверный формат — ошибка
    const dateParam = sp.get('date')
    if (dateParam !== null && !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return NextResponse.json({ error: 'Неверный формат даты — ожидается yyyy-MM-dd' }, { status: 400 })
    }
    const dateKey = dateParam ?? range.to
    const start = parseDayKey(dateKey)
    if (!start) {
      return NextResponse.json({ error: 'Неверный формат даты — ожидается yyyy-MM-dd' }, { status: 400 })
    }
    const end = new Date(start.getTime() + 86400000)

    const rows = await db.sensorLog.findMany({
      where: { userId: user.id, recordedAt: { gte: start, lt: end } },
      orderBy: { recordedAt: 'asc' },
    })

    // для первой записи дня берём вес из последней записи предыдущего дня,
    // чтобы сигнал «резкое падение веса» был честным
    const prevWeight = new Map<string, number | null>()
    for (const pid of pointNames.keys()) {
      const prev = await db.sensorLog.findFirst({
        where: { pointId: pid, recordedAt: { lt: start } },
        orderBy: { recordedAt: 'desc' },
        select: { weightKg: true },
      })
      prevWeight.set(pid, prev ? prev.weightKg : null)
    }

    const logs: HistoryLogDto[] = rows.map((r) => {
      const prevW = prevWeight.get(r.pointId) ?? null
      const alarm = isHistoryAlarm(prevW, r.weightKg, r.tempC, r.humidityPct)
      prevWeight.set(r.pointId, r.weightKg)
      return {
        pointId: r.pointId,
        recordedAt: r.recordedAt.toISOString(),
        weightKg: r1(r.weightKg),
        tempC: r1(r.tempC),
        humidityPct: Math.round(r.humidityPct),
        alarm,
      }
    })

    return ok(scope, dateKey, points, groups, range, { logs, days: null, months: null })
  }

  if (scope === 'month') {
    const monthParam = sp.get('month')
    if (monthParam !== null && !/^\d{4}-\d{2}$/.test(monthParam)) {
      return NextResponse.json({ error: 'Неверный формат месяца — ожидается yyyy-MM' }, { status: 400 })
    }
    const month = monthParam ?? range.to.slice(0, 7)
    const start = parseDayKey(`${month}-01`)
    if (!start) {
      return NextResponse.json({ error: 'Неверный формат месяца — ожидается yyyy-MM' }, { status: 400 })
    }
    const end = new Date(start.getTime())
    end.setUTCMonth(end.getUTCMonth() + 1)

    const rows = await db.sensorLog.findMany({
      where: { userId: user.id, recordedAt: { gte: start, lt: end } },
      orderBy: { recordedAt: 'asc' },
    })

    const byDay = new Map<string, Map<string, HistoryDayPointDto>>()
    const prevWeight = new Map<string, number | null>()
    for (const r of rows) {
      const dk = dayKey(r.recordedAt)
      const prevW = prevWeight.has(r.pointId) ? prevWeight.get(r.pointId)! : null
      prevWeight.set(r.pointId, r.weightKg)
      let perPoint = byDay.get(dk)
      if (!perPoint) {
        perPoint = new Map()
        byDay.set(dk, perPoint)
      }
      let acc = perPoint.get(r.pointId)
      if (!acc) {
        acc = {
          pointId: r.pointId,
          avgTempC: 0,
          minTempC: Infinity,
          maxTempC: -Infinity,
          avgHumidityPct: 0,
          minHumidityPct: Infinity,
          maxHumidityPct: -Infinity,
          startWeightKg: r.weightKg,
          endWeightKg: r.weightKg,
          deltaWeightKg: 0,
          logs: 0,
          alarms: 0,
        }
        perPoint.set(r.pointId, acc)
      }
      acc.avgTempC += r.tempC
      acc.avgHumidityPct += r.humidityPct
      acc.minTempC = Math.min(acc.minTempC, r.tempC)
      acc.maxTempC = Math.max(acc.maxTempC, r.tempC)
      acc.minHumidityPct = Math.min(acc.minHumidityPct, Math.round(r.humidityPct))
      acc.maxHumidityPct = Math.max(acc.maxHumidityPct, Math.round(r.humidityPct))
      acc.endWeightKg = r.weightKg
      acc.logs++
      if (isHistoryAlarm(prevW, r.weightKg, r.tempC, r.humidityPct)) acc.alarms++
    }

    const days: HistoryDaySummaryDto[] = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dk, perPoint]) => ({
        date: dk,
        perPoint: [...perPoint.values()].map((acc) => ({
          pointId: acc.pointId,
          avgTempC: r1(acc.avgTempC / acc.logs),
          minTempC: r1(acc.minTempC),
          maxTempC: r1(acc.maxTempC),
          avgHumidityPct: Math.round(acc.avgHumidityPct / acc.logs),
          minHumidityPct: acc.minHumidityPct,
          maxHumidityPct: acc.maxHumidityPct,
          startWeightKg: r1(acc.startWeightKg),
          endWeightKg: r1(acc.endWeightKg),
          deltaWeightKg: r1(acc.endWeightKg - acc.startWeightKg),
          logs: acc.logs,
          alarms: acc.alarms,
        })),
      }))

    return ok(scope, month, points, groups, range, { logs: null, days, months: null })
  }

  // scope === 'year'
  const yearParam = sp.get('year')
  if (yearParam !== null && !/^\d{4}$/.test(yearParam)) {
    return NextResponse.json({ error: 'Неверный формат года — ожидается yyyy' }, { status: 400 })
  }
  const year = yearParam ? Number(yearParam) : Number(range.to.slice(0, 4))
  const start = parseDayKey(`${year}-01-01`)
  if (!start) {
    return NextResponse.json({ error: 'Неверный формат года — ожидается yyyy' }, { status: 400 })
  }
  const end = parseDayKey(`${year + 1}-01-01`) as Date

  const rows = await db.sensorLog.findMany({
    where: { userId: user.id, recordedAt: { gte: start, lt: end } },
    orderBy: { recordedAt: 'asc' },
  })

  const byMonth = new Map<string, Map<string, HistoryMonthPointDto>>()
  const monthStartWeight = new Map<string, number>()
  const prevWeight = new Map<string, number | null>()
  for (const r of rows) {
    const mk = monthKey(r.recordedAt)
    const prevW = prevWeight.has(r.pointId) ? prevWeight.get(r.pointId)! : null
    prevWeight.set(r.pointId, r.weightKg)
    const swKey = `${mk}:${r.pointId}`
    if (!monthStartWeight.has(swKey)) monthStartWeight.set(swKey, r.weightKg)
    let perPoint = byMonth.get(mk)
    if (!perPoint) {
      perPoint = new Map()
      byMonth.set(mk, perPoint)
    }
    let acc = perPoint.get(r.pointId)
    if (!acc) {
      acc = { pointId: r.pointId, avgTempC: 0, avgHumidityPct: 0, deltaWeightKg: 0, logs: 0, alarms: 0 }
      perPoint.set(r.pointId, acc)
    }
    acc.avgTempC += r.tempC
    acc.avgHumidityPct += r.humidityPct
    acc.deltaWeightKg = r.weightKg - (monthStartWeight.get(swKey) ?? r.weightKg)
    acc.logs++
    if (isHistoryAlarm(prevW, r.weightKg, r.tempC, r.humidityPct)) acc.alarms++
  }

  const months: HistoryMonthSummaryDto[] = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mk, perPoint]) => ({
      month: mk,
      perPoint: [...perPoint.values()].map((acc) => ({
        pointId: acc.pointId,
        avgTempC: r1(acc.avgTempC / acc.logs),
        avgHumidityPct: Math.round(acc.avgHumidityPct / acc.logs),
        deltaWeightKg: r1(acc.deltaWeightKg),
        logs: acc.logs,
        alarms: acc.alarms,
      })),
    }))

  return ok(scope, String(year), points, groups, range, { logs: null, days: null, months })
}
