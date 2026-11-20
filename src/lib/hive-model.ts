/**
 * Модель улья и правиловые оценки «Цифрового улья».
 *
 * Здесь живут общие типы (Hive, DayPoint, WeatherDay, MigrationSite,
 * PesticideAlert) и правила оценки состояния семьи, которые работают
 * поверх любых данных — с датчиков на карте или из загруженной телеметрии:
 *  1) падение веса ≥ 1 кг за 2 дня → риск роения;
 *  2) привес за месяц < 60 % от лидера пасеки → слабый привес;
 *  3) датчик влажности молчит → «датчик молчит»;
 *  4) иначе — штатный режим.
 */

/* ------------------------------------------------------------------ */
/* Форматирование                                                      */
/* ------------------------------------------------------------------ */

/** Форматирование чисел по-русски: 72,2 / −4,3. */
export function fmtNum(n: number, digits = 1): string {
  const rounded = n.toFixed(digits)
  return rounded.replace('.', ',').replace('-', '−')
}

export function fmtSigned(n: number, digits = 1): string {
  const s = fmtNum(Math.abs(n), digits)
  return n >= 0 ? `+${s}` : `−${s}`
}

/* ------------------------------------------------------------------ */
/* Телеметрия ульев                                                    */
/* ------------------------------------------------------------------ */

export interface DayPoint {
  /** ISO-дата, например 2026-07-18 */
  date: string
  /** Короткая подпись для оси, например «18.07» */
  label: string
  /** Полная дата, например «18 июля» */
  full: string
  weightKg: number | null
  tempInC: number | null
  humidityPct: number | null
}

export interface Hive {
  id: number
  label: string
  familyNote: string
  humiditySensorOk: boolean
  humidityOfflineFrom: string | null
  series: DayPoint[]
}

export interface HiveStatus {
  level: 'risk' | 'watch' | 'ok'
  label: string
}

/** Порог падения веса за 2 дня, при котором ставим флаг роения. */
const SWARM_DROP_KG = -1.0

/**
 * Изменение веса за `backDays` календарных дней — устойчиво к пропускам дней:
 * ищет точку, ближайшую к «дата последнего − backDays», с допуском ±1,5 дня.
 * Работает и для плотного суточного ряда, и для редких реальных измерений.
 */
export function weightDeltaOver(h: Hive, backDays: number): number | null {
  const s = h.series
  if (s.length === 0) return null
  const lastPoint = s[s.length - 1]
  if (lastPoint.weightKg === null) return null
  const target = new Date(lastPoint.date).getTime() - backDays * 86400000
  let best: number | null = null
  let bestDiff = Infinity
  for (const p of s) {
    if (p.weightKg === null || p === lastPoint) continue
    const diff = Math.abs(new Date(p.date).getTime() - target)
    if (diff <= 1.5 * 86400000 && diff < bestDiff) {
      bestDiff = diff
      best = p.weightKg
    }
  }
  if (best === null) return null
  return Math.round((lastPoint.weightKg - best) * 10) / 10
}

export function weightDelta30d(h: Hive): number {
  const a = h.series[h.series.length - 1]?.weightKg ?? 0
  const b = h.series[0]?.weightKg ?? a
  return Math.round((a - b) * 10) / 10
}

export function bestHiveOf(list: Hive[]): Hive {
  return [...list].sort((a, b) => weightDelta30d(b) - weightDelta30d(a))[0]
}

/**
 * Правиловая оценка состояния улья по данным телеметрии:
 *  1) падение веса ≥ 1 кг за 2 дня → риск роения;
 *  2) привес за месяц < 60 % от лидера пасеки → слабый привес;
 *  3) датчик влажности молчит → «датчик молчит»;
 *  4) иначе — штатный режим.
 */
export function hiveStatus(h: Hive, all: Hive[]): HiveStatus {
  const s = h.series
  if (s.length === 0) return { level: 'watch', label: 'Нет данных' }
  const d2 = weightDeltaOver(h, 2)
  if (d2 !== null && d2 <= SWARM_DROP_KG) {
    return { level: 'risk', label: 'Риск роения' }
  }
  const leader = bestHiveOf(all)
  const d30 = weightDelta30d(h)
  const leaderD30 = weightDelta30d(leader)
  if (leader.id !== h.id && leaderD30 > 1 && d30 < leaderD30 * 0.6) {
    return { level: 'watch', label: 'Слабый привес' }
  }
  if (!h.humiditySensorOk) {
    return { level: 'watch', label: 'Датчик молчит' }
  }
  return { level: 'ok', label: 'Штатный режим' }
}

/** Данные для графиков (последние n дней). */
export function chartSeries(h: Hive, n = 30): DayPoint[] {
  return h.series.slice(-n)
}

/* ------------------------------------------------------------------ */
/* Погода                                                              */
/* ------------------------------------------------------------------ */

export type WeatherIcon = 'sun' | 'sun-cloud' | 'cloud' | 'rain'
export type FlightWindow = 'good' | 'fair' | 'bad'

export interface WeatherDay {
  date: string
  weekday: string
  full: string
  icon: WeatherIcon
  tMax: number
  tMin: number
  windMs: number
  precipProb: number
  flight: FlightWindow
}

/* ------------------------------------------------------------------ */
/* Предупреждение об обработке поля (тип; данные придут из реестра)    */
/* ------------------------------------------------------------------ */

export interface PesticideAlert {
  field: string
  crop: string
  dateLabel: string
  dateShort: string
  distanceKm: number
  treatment: string
  windNote: string
  source: string
}

/* ------------------------------------------------------------------ */
/* Кочёвка: площадки-кандидаты                                         */
/* ------------------------------------------------------------------ */

export type SiteVerdict = 'recommend' | 'backup' | 'avoid'

export interface MigrationSite {
  id: string
  name: string
  distanceKm: number
  honeyPlant: string
  bloomWindow: string
  weatherNote: string
  risks: string
  score: number
  verdict: SiteVerdict
  /** координаты на стилизованной карте, 0..1 */
  map: { x: number; y: number }
}
