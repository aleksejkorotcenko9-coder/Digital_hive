/**
 * Сборка суточных рядов телеметрии из «сырых» измерений датчиков.
 * Используется и на сервере (/api/data), и в утилитах реального режима.
 */
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { DayPoint } from './hive-model'

export interface RawMeasurement {
  ts: Date | string
  weightKg: number | null
  tempC: number | null
  humidityPct: number | null
}

const r1 = (n: number) => Math.round(n * 10) / 10

/**
 * Группирует измерения по дням; в каждый день берётся последнее непустое
 * значение каждого показателя (датчики пишут дважды в сутки).
 * Возвращает максимум `maxDays` последних дней, отсортированные по дате.
 */
export function buildDailySeries(measurements: RawMeasurement[], maxDays = 60): DayPoint[] {
  const byDay = new Map<string, { w: number | null; t: number | null; h: number | null; d: Date }>()
  for (const m of measurements) {
    const d = typeof m.ts === 'string' ? new Date(m.ts) : m.ts
    if (Number.isNaN(d.getTime())) continue
    const key = format(d, 'yyyy-MM-dd')
    const slot = byDay.get(key) ?? { w: null, t: null, h: null, d }
    if (m.weightKg !== null && Number.isFinite(m.weightKg)) slot.w = r1(m.weightKg)
    if (m.tempC !== null && Number.isFinite(m.tempC)) slot.t = r1(m.tempC)
    if (m.humidityPct !== null && Number.isFinite(m.humidityPct)) slot.h = Math.round(m.humidityPct)
    byDay.set(key, slot)
  }
  const entries = [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(-maxDays)
  return entries.map(([key, slot]) => ({
    date: key,
    label: format(slot.d, 'd.MM'),
    full: format(slot.d, 'd MMMM', { locale: ru }),
    weightKg: slot.w,
    tempInC: slot.t,
    humidityPct: slot.h,
  }))
}

/**
 * Состояние датчика влажности: если последние дни идут с прочерками — датчик
 * не отвечает, возвращаем дату первого «пропавшего» дня.
 */
export function humidityMeta(series: DayPoint[]): { ok: boolean; offlineFrom: string | null } {
  if (series.length === 0) return { ok: false, offlineFrom: null }
  let i = series.length - 1
  if (series[i].humidityPct !== null) return { ok: true, offlineFrom: null }
  while (i >= 0 && series[i].humidityPct === null) i--
  const firstMissing = series[i + 1]
  return { ok: false, offlineFrom: firstMissing ? firstMissing.full : null }
}
