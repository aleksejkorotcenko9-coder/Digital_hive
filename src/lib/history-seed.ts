/**
 * История датчиков («История событий»): почасовой журнал показаний ульев.
 *
 * Данные берутся из якорной выгрузки upload/telemetry_hives_large.csv
 * (src/lib/history-data.ts): контрольные замеры в 8:00 и 20:00 за 60 дней
 * (1 июля — 29 августа 2026), между ними значения интерполируются — параметры
 * фиксируются КАЖДЫЙ ЧАС. Генерация значений — в history-generate.ts.
 *
 * ensureSensorHistory лениво наполняет журнал: при первом открытии раздела
 * каждому улью с датчиком назначается своя семья из выгрузки (по порядку
 * привязки), и создаются записи за все 60 дней.
 */
import { db } from '@/lib/db'
import { HISTORY_BY_HIVE, HISTORY_DAYS, HISTORY_HIVES } from '@/lib/history-data'
import { generateHourlyLogsLocal } from '@/lib/history-generate'

export { HISTORY_RANGE } from '@/lib/history-generate'
export { isHistoryAlarm } from '@/lib/history-generate'

export interface EnsureHistoryResult {
  seededPoints: number
  totalLogs: number
}

/**
 * Ленивый засев журнала: каждому улью с датчиком, у которого ещё нет записей,
 * назначается семья из выгрузки (по порядку привязки точек) и создаётся
 * почасовая история за 60 дней. Идемпотентно — можно вызывать на каждый запрос.
 */
export async function ensureSensorHistory(userId: string): Promise<EnsureHistoryResult> {
  const points = await db.apiaryPoint.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  })
  let seededPoints = 0
  let totalLogs = 0
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    if (!p.hasSensor || !p.sensorCode) continue // без датчика телеметрии нет
    const existing = await db.sensorLog.count({ where: { pointId: p.id } })
    if (existing > 0) continue
    const csvHive = HISTORY_HIVES[i % HISTORY_HIVES.length]
    const rows = generateHourlyLogsLocal(p.id, userId, csvHive, HISTORY_BY_HIVE, HISTORY_DAYS)
    if (rows.length === 0) continue
    for (let k = 0; k < rows.length; k += 600) {
      await db.sensorLog.createMany({ data: rows.slice(k, k + 600) })
    }
    seededPoints++
    totalLogs += rows.length
  }
  return { seededPoints, totalLogs }
}
