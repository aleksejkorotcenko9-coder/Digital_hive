/**
 * Чистая генерация почасовых записей журнала по якорной CSV-выгрузке.
 * Без зависимостей от БД и алиасов — используется и сервером Next.js,
 * и скриптами засева. См. history-seed.ts (запись в БД).
 *
 * Времена хранятся как «стеночные часы» CSV в UTC: 2026-07-01T08:00Z и т.д.
 */
import { HISTORY_DAYS, type HistoryAnchorRow } from './history-data'

/** Первый день выгрузки: 1 июля 2026, 00:00 UTC. */
export const HISTORY_START_MS = Date.UTC(2026, 6, 1)

/** Доступный диапазон журнала в ключах UTC-дат «yyyy-mm-dd». */
export const HISTORY_RANGE = {
  from: '2026-07-01',
  to: '2026-08-29',
} as const

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Детерминированная дробь 0..1 по строке — дрожание без «прыжков» при пересеве. */
function jitterFrac(key: string): number {
  let h = 5381
  for (let i = 0; i < key.length; i++) h = ((h * 33) ^ key.charCodeAt(i)) >>> 0
  return (h % 10000) / 10000
}

/** Базовые значения (вес, t, влажность) для (якорь дня, час) с интерполяцией
 *  между контрольными замерами 8:00 и 20:00 и переходом через полночь. */
function baseAt(
  a: HistoryAnchorRow,
  next: HistoryAnchorRow | undefined,
  prev: HistoryAnchorRow | undefined,
  h: number,
): [number, number, number] {
  const m08 = [a.w08, a.t08, a.h08] as const
  const m20 = [a.w20, a.t20, a.h20] as const
  if (h >= 8 && h <= 20) {
    const t = (h - 8) / 12
    return [lerp(m08[0], m20[0], t), lerp(m08[1], m20[1], t), lerp(m08[2], m20[2], t)]
  }
  if (h > 20) {
    if (!next) return [...m20] as [number, number, number]
    const t = (h - 20) / 12
    return [lerp(m20[0], next.w08, t), lerp(m20[1], next.t08, t), lerp(m20[2], next.h08, t)]
  }
  if (!prev) return [...m08] as [number, number, number]
  const t = h / 8
  return [lerp(prev.w20, m08[0], t), lerp(prev.t20, m08[1], t), lerp(prev.h20, m08[2], t)]
}

export interface GeneratedLog {
  pointId: string
  userId: string
  recordedAt: Date
  weightKg: number
  tempC: number
  humidityPct: number
  source: string
}

/** Почасовые записи одного улья за весь период выгрузки (60 дней × 24 часа).
 *  В 8:00 и 20:00 — точные значения CSV, между ними — плавный ход с небольшим
 *  детерминированным дрожанием датчика. */
export function generateHourlyLogsLocal(
  pointId: string,
  userId: string,
  csvHive: number,
  byHive: Record<number, HistoryAnchorRow[]>,
  days: number = HISTORY_DAYS,
): GeneratedLog[] {
  const anchors = byHive[csvHive] ?? []
  const rows: GeneratedLog[] = []
  for (let d = 0; d < days; d++) {
    const a = anchors[d]
    if (!a) continue
    const next = anchors[d + 1]
    const prev = anchors[d - 1]
    for (let h = 0; h < 24; h++) {
      const [bw, bt, bh] = baseAt(a, next, prev, h)
      const isAnchor = h === 8 || h === 20
      const jk = `${pointId}:${d}:${h}`
      const weightKg = isAnchor ? bw : bw + (jitterFrac(`${jk}:w`) - 0.5) * 0.1
      const tempC = isAnchor ? bt : bt + (jitterFrac(`${jk}:t`) - 0.5) * 0.3
      const humidityPct = isAnchor ? bh : bh + (jitterFrac(`${jk}:h`) - 0.5) * 2
      rows.push({
        pointId,
        userId,
        recordedAt: new Date(HISTORY_START_MS + d * 86400000 + h * 3600000),
        weightKg: Math.round(weightKg * 10) / 10,
        tempC: Math.round(tempC * 10) / 10,
        humidityPct: Math.max(0, Math.min(100, Math.round(humidityPct))),
        source: 'csv',
      })
    }
  }
  return rows
}

/** Порог тревожного события журнала: перегрев/переохлаждение семьи, слишком
 *  сухой или сырой воздух, резкое падение веса. Норма расплода 33.5–36.7 °C,
 *  комфортная влажность 45–75 %. */
export function isHistoryAlarm(
  prevWeightKg: number | null,
  weightKg: number,
  tempC: number,
  humidityPct: number,
): boolean {
  return (
    // Расплодная часть: постоянные ≈ 35 °C — тревога при перегреве выше 36 °C
    // или падении ниже 33,5 °C; влажность в норме 40–50 % — тревога за её пределами.
    tempC >= 36.0 ||
    tempC <= 33.5 ||
    humidityPct >= 58 ||
    humidityPct <= 36 ||
    (prevWeightKg !== null && weightKg <= prevWeightKg - 0.3)
  )
}
