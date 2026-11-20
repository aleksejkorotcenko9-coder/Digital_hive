/**
 * Справочник медоносов и агрономическая логика кочёвки.
 *
 * Источники (справочно, для прототипа):
 *  • Посевные площади, даты посева, обработки пестицидами — данные Минсельхоза
 *    области (региональный справочник, засевается в bootstrap.ts).
 *  • Медопродуктивность гектара, нормы размещения пчелосемей, фенология —
 *    проверенные советские нормативы НИИ пчеловодства (Рыбново, Рязанская обл.).
 *
 * Ключевая функция — estimateBloomWindow(): от фактической даты посева
 * рассчитывается окно цветения (например, подсолнечник зацветает примерно
 * через 2 месяца после посева), при отсутствии даты посева — эталонное окно.
 */
import type { SeasonPhase } from './season'

export interface AgroCulture {
  key: string
  name: string
  /** От посева до начала цветения, дней (для посевных культур). */
  daysToBloom: number | null
  /** Длительность цветения, дней. */
  bloomDays: number
  /** Эталонное окно цветения в средней полосе, 'MM-DD'. */
  etalonStart: string
  etalonEnd: string
  /** Медопродуктивность, кг/га (товарный мёд, норматив). */
  honeyYieldMin: number
  honeyYieldMax: number
  /** Норма размещения пчелосемей, семей/га (НИИ пчеловодства). */
  familiesPerHaMin: number
  familiesPerHaMax: number
  /** Посевная культура (false — лесные/природные массивы, посева нет). */
  sowing: boolean
  /** Справочная заметка. */
  note: string
}

export const AGRO_CULTURES: Record<string, AgroCulture> = {
  buckwheat: {
    key: 'buckwheat',
    name: 'Гречиха',
    daysToBloom: 38,
    bloomDays: 25,
    etalonStart: '06-20',
    etalonEnd: '07-15',
    honeyYieldMin: 60,
    honeyYieldMax: 80,
    familiesPerHaMin: 1.5,
    familiesPerHaMax: 2,
    sowing: true,
    note: 'взяток 2–4 кг в день, требовательна к влаге в цветение',
  },
  linden: {
    key: 'linden',
    name: 'Липа',
    daysToBloom: null,
    bloomDays: 20,
    etalonStart: '06-20',
    etalonEnd: '07-10',
    honeyYieldMin: 500,
    honeyYieldMax: 800,
    familiesPerHaMin: 2,
    familiesPerHaMax: 3,
    sowing: false,
    note: 'лесной массив, посева нет; семья берёт 5–10 кг за день взятка',
  },
  melilot: {
    key: 'melilot',
    name: 'Донник',
    daysToBloom: null,
    bloomDays: 60,
    etalonStart: '06-20',
    etalonEnd: '08-20',
    honeyYieldMin: 100,
    honeyYieldMax: 150,
    familiesPerHaMin: 1,
    familiesPerHaMax: 2,
    sowing: true,
    note: 'двулетник: цветёт на следующий год после посева, самое длинное окно',
  },
  sunflower: {
    key: 'sunflower',
    name: 'Подсолнечник',
    daysToBloom: 65,
    bloomDays: 28,
    etalonStart: '07-20',
    etalonEnd: '08-15',
    honeyYieldMin: 30,
    honeyYieldMax: 50,
    familiesPerHaMin: 0.5,
    familiesPerHaMax: 1,
    sowing: true,
    note: 'зацветает примерно через 2 месяца после посева; часто обрабатывается пестицидами',
  },
  sainfoin: {
    key: 'sainfoin',
    name: 'Эспарцет',
    daysToBloom: 55,
    bloomDays: 18,
    etalonStart: '06-05',
    etalonEnd: '06-25',
    honeyYieldMin: 90,
    honeyYieldMax: 120,
    familiesPerHaMin: 1,
    familiesPerHaMax: 2,
    sowing: true,
    note: 'многолетник: зацветает весной, устойчив к засухе',
  },
  phacelia: {
    key: 'phacelia',
    name: 'Фацелия',
    daysToBloom: 33,
    bloomDays: 40,
    etalonStart: '06-05',
    etalonEnd: '07-15',
    honeyYieldMin: 60,
    honeyYieldMax: 120,
    familiesPerHaMin: 2,
    familiesPerHaMax: 3,
    sowing: true,
    note: 'пчелоучастки и пары; длинное цветение при поэтапном посеве',
  },
  coriander: {
    key: 'coriander',
    name: 'Кориандр',
    daysToBloom: 45,
    bloomDays: 28,
    etalonStart: '06-25',
    etalonEnd: '07-20',
    honeyYieldMin: 100,
    honeyYieldMax: 200,
    familiesPerHaMin: 2,
    familiesPerHaMax: 3,
    sowing: true,
    note: 'поздний медонос, сильный аромат; требователен к теплу',
  },
}

/** Читаемая обработка поля пестицидом (Minselhoz справочник). */
export interface PesticideTreatment {
  date: string // 'YYYY-MM-DD'
  drug: string
  hazardClass: string // класс опасности '1'..'3'
  note: string
}

export interface BloomWindow {
  /** Начало цветения (в год цветения). */
  start: Date
  /** Конец цветения. */
  end: Date
  /** 'sowing' — рассчитано от даты посева; 'etalon' — эталонное окно. */
  source: 'sowing' | 'etalon'
  /** Отклонение начала от эталона, дней (положительное — позже эталона). */
  deviationDays: number | null
}

function parseMMDD(mmdd: string, year: number): Date {
  const [m, d] = mmdd.split('-').map(Number)
  return new Date(year, m - 1, d)
}

function fmtDay(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}`
}

/**
 * Окно цветения культуры.
 * Посевные: от sowingDate + daysToBloom; донник — двулетник, цветение
 * на следующий год после посева (sowingDate — прошлогодняя весна).
 * Липа (и прочие несевные) — эталонное окно текущего года.
 */
export function estimateBloomWindow(cultureKey: string, sowingDate: Date | null | undefined, refYear?: number): BloomWindow | null {
  const culture = AGRO_CULTURES[cultureKey]
  if (!culture) return null
  const year = refYear ?? new Date().getFullYear()

  if (!culture.sowing || !sowingDate) {
    const start = parseMMDD(culture.etalonStart, year)
    const end = parseMMDD(culture.etalonEnd, year)
    return { start, end, source: 'etalon', deviationDays: null }
  }

  const sowing = new Date(sowingDate)
  // Донник: цветение на следующий год после посева.
  const bloomYear = culture.key === 'melilot' ? sowing.getFullYear() + 1 : year
  const etalon = parseMMDD(culture.etalonStart, bloomYear)
  const days = culture.daysToBloom ?? 40
  // От посева до начала цветения: sowingDate + daysToBloom (в том же году).
  const startRaw = new Date(sowing.getFullYear(), sowing.getMonth(), sowing.getDate() + days)
  const start = new Date(bloomYear, startRaw.getMonth(), startRaw.getDate())
  // Плавно тянем расчёт к эталону: не дальше ±14 дней от эталонной даты.
  const dev = Math.round((start.getTime() - etalon.getTime()) / 86400000)
  const clampedDev = Math.max(-14, Math.min(14, dev))
  const startFinal = new Date(etalon.getTime() + clampedDev * 86400000)
  const end = new Date(startFinal.getTime() + culture.bloomDays * 86400000)
  return { start: startFinal, end, source: 'sowing', deviationDays: dev }
}

/** «23.06–18.07» по окну цветения. */
export function formatBloomWindow(w: BloomWindow | null): string {
  if (!w) return ''
  return `${fmtDay(w.start)}–${fmtDay(w.end)}`
}

export interface FamilyRecommendation {
  /** Рекомендуемое число семей (диапазон и оптимум). */
  min: number
  max: number
  optimal: number
  /** «кг товарного мёда на семью» — ориентировочно. */
  honeyPerFamilyKg: number
  /** Перенасыщение: слишком много семей на площади — мёд «размазывается» по сотам, незрелый. */
  oversaturation: boolean
  note: string
}

/**
 * Рекомендация по числу семей для поля: норматив семей/га × площадь.
 * Перенасыщение — если фактическая загрузка превышает верх норматива.
 */
export function recommendFamilies(cultureKey: string, areaHa: number, plannedFamilies?: number): FamilyRecommendation | null {
  const culture = AGRO_CULTURES[cultureKey]
  if (!culture || areaHa <= 0) return null
  const min = Math.round(areaHa * culture.familiesPerHaMin)
  const max = Math.round(areaHa * culture.familiesPerHaMax)
  const optimal = Math.round((min + max) / 2)
  const honeyPerFamilyKg = Math.round(((culture.honeyYieldMin + culture.honeyYieldMax) / 2) / Math.max(1, (culture.familiesPerHaMin + culture.familiesPerHaMax) / 2))
  const oversaturation = plannedFamilies !== undefined && plannedFamilies > max
  return {
    min,
    max,
    optimal,
    honeyPerFamilyKg,
    oversaturation,
    note: `${culture.name}: ${culture.honeyYieldMin}–${culture.honeyYieldMax} кг/га, норматив ${culture.familiesPerHaMin}–${culture.familiesPerHaMax} семьи/га (НИИ пчеловодства)`,
  }
}

export interface DistributionOption {
  /** Медонос и поля, между которыми распределяем. */
  label: string
  /** Культуры: одинаковый медонос на разных полях (≥3 км) или разные культуры с тем же окном. */
  fields: string[]
  /** Два сорта мёда — если культуры разные. */
  twoHoneyTypes: boolean
  /** Примерное распределение семей. */
  split: string
}

/**
 * Варианты распределения семей: часть семей на одно поле, часть — на другое
 * поле того же медоноса (не ближе 3 км) или на другой медонос с теми же
 * сроками цветения. Это позволяет получать два сорта мёда одновременно.
 */
export function planDistribution(fields: { id: string; name: string; culture: string; distanceKm: number; bloom: BloomWindow | null }[], totalFamilies: number): DistributionOption[] {
  const options: DistributionOption[] = []

  // 1) Один медонос на двух полях, разнесённых не ближе 3 км.
  for (let i = 0; i < fields.length; i++) {
    for (let j = i + 1; j < fields.length; j++) {
      const a = fields[i]
      const b = fields[j]
      if (a.culture !== b.culture) continue
      if (Math.abs(a.distanceKm - b.distanceKm) < 3) continue // поля должны быть разнесены ≥3 км
      const culture = AGRO_CULTURES[a.culture]
      const half = Math.round(totalFamilies / 2)
      options.push({
        label: `${culture.name}: ${a.name} + ${b.name}`,
        fields: [a.name, b.name],
        twoHoneyTypes: false,
        split: `по ${half} семей на каждое поле (поля разнесены ≥3 км)`,
      })
    }
  }

  // 2) Разные медоносы с совпадающим окном цветения → два сорта мёда.
  for (let i = 0; i < fields.length; i++) {
    for (let j = i + 1; j < fields.length; j++) {
      const a = fields[i]
      const b = fields[j]
      if (a.culture === b.culture) continue
      if (!a.bloom || !b.bloom) continue
      const overlap = Math.max(0, Math.min(a.bloom.end.getTime(), b.bloom.end.getTime()) - Math.max(a.bloom.start.getTime(), b.bloom.start.getTime()))
      if (overlap < 10 * 86400000) continue // меньше 10 дней перекрытия — смысла нет
      const half = Math.round(totalFamilies / 2)
      options.push({
        label: `${AGRO_CULTURES[a.culture].name} + ${AGRO_CULTURES[b.culture].name}`,
        fields: [a.name, b.name],
        twoHoneyTypes: true,
        split: `${half} семей на ${a.name}, ${half} на ${b.name} — два сорта мёда одновременно`,
      })
    }
  }

  return options.slice(0, 4)
}

/** Обработка поля идёт в пределах ±2 дней от указанной даты. */
export function treatmentNear(treatments: PesticideTreatment[], date: Date): PesticideTreatment | null {
  const t = date.getTime()
  return treatments.find((tr) => Math.abs(new Date(tr.date + 'T00:00:00').getTime() - t) <= 2 * 86400000) ?? null
}

/** Есть ли сейчас цветение на поле (для сезонной подкраски). */
export function isBlooming(w: BloomWindow | null, now = new Date(), phase?: SeasonPhase): boolean {
  if (phase && (phase === 'winter_rest' || phase === 'autumn_prep')) return false
  if (!w) return false
  const t = now.getTime()
  return t >= w.start.getTime() && t <= w.end.getTime()
}
