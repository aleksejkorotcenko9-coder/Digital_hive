/**
 * «Живые» показания датчика улья на карте.
 * Одна формула и для /api/map-points (интерфейс), и для контекста ИИ-агента —
 * чтобы агент называл те же числа, что видит пчеловод на экране.
 * Без датчика или при выключенном датчике показаний нет — «данных об улье нет».
 *
 * Сезонность: зимой пчёлы в клубе — ядро 24–28 °C, влажность 55–70 %,
 * расход корма (вес снижается на 0,1–0,2 кг/сут), шум тише летнего.
 */
import type { SensorReading } from './api-types'
import { seasonPhase } from './season'

export interface SensorPointRow {
  id: string
  name: string
  lat: number
  lon: number
  hiveCount: number
  hasSensor: boolean
  sensorOn: boolean
  /** Код датчика на корпусе (в показания не входит, нужен интерфейсу). */
  sensorCode?: string | null
}

/** Детерминированная фаза по id точки — чтобы значения отличались между ульями. */
export function hashPhase(s: string): number {
  let h = 7
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return ((h % 997) / 997) * Math.PI * 2
}

/** Сезонные базовые показатели датчика (средняя полоса). */
export function seasonSensorBase(nowMs: number = Date.now()): { tempBase: number; humBase: number; weightDrift: number; noiseBase: number } {
  const phase = seasonPhase(new Date(nowMs))
  switch (phase) {
    case 'winter_rest':
      return { tempBase: 25.5, humBase: 60, weightDrift: -0.15, noiseBase: 32 } // клуб: тихий фон
    case 'flight_start':
      return { tempBase: 34.2, humBase: 44, weightDrift: 0.08, noiseBase: 38 }
    case 'buildup':
      return { tempBase: 34.8, humBase: 45, weightDrift: 0.12, noiseBase: 42 }
    case 'autumn_prep':
      return { tempBase: 34.0, humBase: 47, weightDrift: 0.0, noiseBase: 40 }
    default:
      return { tempBase: 35.0, humBase: 45, weightDrift: 0.35, noiseBase: 45 } // главный медосбор
  }
}

/**
 * Показания датчика: температура и шум колеблются заметно, масса меняется
 * медленно (привес/расход по сезону), влажность — в рабочем диапазоне.
 */
export function sensorReading(r: SensorPointRow, tSec: number): SensorReading {
  const updatedAt = new Date().toISOString()
  if (!r.hasSensor) {
    return { on: false, reason: 'none', tempC: null, humidityPct: null, weightKg: null, noiseDb: null, updatedAt }
  }
  if (!r.sensorOn) {
    return { on: false, reason: 'off', tempC: null, humidityPct: null, weightKg: null, noiseDb: null, updatedAt }
  }
  const p = hashPhase(r.id)
  // Сезонные нормы: расплодная часть ≈35 °C (в сезон), ядро клуба 24–28 °C зимой;
  // влажность 40–50 % (зимой 55–70 %); вес дадана 150–170 кг.
  const { tempBase, humBase, weightDrift, noiseBase } = seasonSensorBase(tSec * 1000)
  const tempC = tempBase + 0.15 * Math.sin(tSec / 150 + p) + 0.1 * Math.sin(tSec / 13 + p * 2)
  const humidityPct = humBase + 3 * Math.sin(tSec / 210 + p * 1.3) + 1 * Math.sin(tSec / 29 + p)
  // масса: база + медленный сезонный дрейф (привес или расход корма) —
  // 0,35 кг/сут в медосбор, −0,15 кг/сут зимой; в «часах» показываем тот же вес
  const daySec = 86400
  const weightKg = 155.0 + weightDrift * (tSec % (daySec * 30)) / daySec + 1.2 * Math.sin(tSec / 3600 + p) + 0.06 * Math.sin(tSec / 7 + p * 3)
  const noiseDb = noiseBase + 5 * Math.sin(tSec / 23 + p * 2.5) + 1.5 * Math.sin(tSec / 5 + p)
  return {
    on: true,
    reason: 'active',
    tempC: Math.round(tempC * 10) / 10,
    humidityPct: Math.round(humidityPct),
    weightKg: Math.round(weightKg * 10) / 10,
    noiseDb: Math.round(noiseDb),
    updatedAt,
  }
}
