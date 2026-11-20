/**
 * Логика ИИ-агента «Цифровой улей» (правиловая версия).
 *
 * Принципы из кейса:
 *  1. Data Driven — совет опирается на показатели, агент показывает, какие данные использовал.
 *  2. Честность — если данных не хватает, агент прямо об этом говорит.
 *  3. Вероятность и уровень риска, а не 100% прогноз; решение принимает пчеловод.
 *
 * Агент работает через AgentContext: один и тот же набор правил применяется
 * к данным пасеки — с датчиков на карте (точки ApiaryPoint) или из загруженной
 * телеметрии (/api/data). Контекст собирают callers: экран агента и /api/agent.
 */
import {
  fmtNum,
  fmtSigned,
  hiveStatus,
  weightDeltaOver,
  type Hive,
  type MigrationSite,
  type PesticideAlert,
  type WeatherDay,
} from './hive-model'
import type { SensorReading } from './api-types'
import type { AgentWeatherNow } from './weather-days'
import { seasonPhase } from './season'
import { tr, type Lang } from './i18n-core'
import { AGRO_CULTURES, estimateBloomWindow, formatBloomWindow, type AgroCulture, type BloomWindow } from './agro-catalog'

/* ------------------------------------------------------------------ */
/* Типы                                                                */
/* ------------------------------------------------------------------ */

export type Urgency = 'act-now' | 'today' | 'this-week' | 'ok'
export type Scenario = 'pesticide' | 'swarm' | 'weather' | 'migration' | 'status' | 'care' | 'offtopic' | 'bloom' | 'guide'

export const URGENCY_META: Record<Urgency, { labelKey: string; cls: string }> = {
  'act-now': { labelKey: 'agent.urgency.act-now', cls: 'bg-red-100 text-red-700 border-red-200' },
  today: { labelKey: 'agent.urgency.today', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  'this-week': { labelKey: 'agent.urgency.this-week', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  ok: { labelKey: 'agent.urgency.ok', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
}

export const SCENARIO_META: Record<Scenario, { labelKey: string }> = {
  pesticide: { labelKey: 'agent.scenario.pesticide' },
  swarm: { labelKey: 'agent.scenario.swarm' },
  weather: { labelKey: 'agent.scenario.weather' },
  migration: { labelKey: 'agent.scenario.migration' },
  status: { labelKey: 'agent.scenario.status' },
  care: { labelKey: 'agent.scenario.care' },
  offtopic: { labelKey: 'agent.scenario.offtopic' },
  bloom: { labelKey: 'agent.scenario.bloom' },
  guide: { labelKey: 'agent.scenario.guide' },
}

export interface AgentMetric {
  label: string
  value: string
}

export interface AgentMessage {
  scenario: Scenario
  text: string
  basis: string[]
  urgency: Urgency
  urgencyNote?: string
  probability?: string
  metrics: AgentMetric[]
  hiveId: number | null
  /** Кто ответил: LLM или встроенный правиловый движок (fallback). Модель не раскрывается. */
  engine?: 'llm' | 'rules'
}

export interface AgentFinding extends AgentMessage {
  id: string
  title: string
  prefill: string
}

/** Точка пасеки на карте (ульи с датчиком) — тот же DTO, что отдаёт /api/map-points. */
export interface AgentPoint {
  id: string
  name: string
  lat: number
  lon: number
  hiveCount: number
  hasSensor: boolean
  sensorOn: boolean
  sensor: SensorReading
}

/** Контекст данных, по которым агент отвечает: телеметрия и точки карты. */
export interface AgentContext {
  hives: Hive[]
  weather: WeatherDay[] | null
  /** Погода «прямо сейчас» (метеосервис); если недоступна — null. */
  weatherNow?: AgentWeatherNow | null
  pesticide: PesticideAlert | null
  sites: MigrationSite[]
  /** Точки пасеки на карте с датчиками (температура, вес, влажность, шум). */
  points?: AgentPoint[]
  /** Поля медоносов Минсельхоза (посевные площади, даты посева, обработки). */
  cropFields?: AgentCropField[]
  apiaryName: string
  /** Язык ответов агента (словарь i18n-extra-agent); по умолчанию — русский. */
  lang?: Lang
}

/** Поле медоносного растения — сжатое представление для контекста агента. */
export interface AgentCropField {
  name: string
  culture: string
  cultureName: string
  areaHa: number
  district: string
  distanceKm: number
  sowingDate: string | null
  bloomText: string
  bloomStart: string | null
  bloomEnd: string | null
  recommend: { min: number; max: number; optimal: number } | null
  treatments: Array<{ date: string; drug: string; hazardClass: string }>
  isMinselhoz: boolean
}

/** Собирает контекст агента: недостающее — честные null/пустые списки. */
export function makeContext(hives_: Hive[], opts?: Partial<Omit<AgentContext, 'hives'>>): AgentContext {
  return {
    hives: hives_,
    weather: opts?.weather ?? null,
    weatherNow: opts?.weatherNow ?? null,
    pesticide: opts?.pesticide ?? null,
    sites: opts?.sites ?? [],
    points: opts?.points,
    cropFields: opts?.cropFields ?? [],
    apiaryName: opts?.apiaryName ?? 'Моя пасека',
    lang: opts?.lang ?? 'ru',
  }
}

/* ------------------------------------------------------------------ */
/* Метрики по рядам (безопасны к пропускам значений)                   */
/* ------------------------------------------------------------------ */

function lastPoint(h: Hive) {
  return h.series[h.series.length - 1] ?? null
}

function lastWeight(h: Hive): number | null {
  return lastPoint(h)?.weightKg ?? null
}

/** Изменение веса за `backDays` календарных дней; null, если точек не хватает.
 *  Календарный поиск с допуском ±1,5 дня — корректен при пропусках дней. */
function weightDelta(h: Hive, backDays: number): number | null {
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

const delta2d = (h: Hive) => weightDelta(h, 2)
const delta30d = (h: Hive) => weightDelta(h, Math.min(29, Math.max(1, spanDays(h) - 1)))

/**
 * Произвольный период из вопроса: «за 8 дней», «за 12 дней», «за 2 недели»,
 * «за месяц», «за 45 дней». Возвращает число дней или null.
 * (п. 7 ТЗ: любые периоды вместо трёх фиксированных)
 */
export function extractPeriodDays(q: string): number | null {
  const days = q.match(/за (\d+)\s*(дн|день|дня|дней|сутк)/)
  if (days) return Math.max(1, Math.min(365, Number(days[1])))
  const weeks = q.match(/за (\d+)\s*(недел)/)
  if (weeks) return Math.max(1, Math.min(104, Number(weeks[1]) * 7))
  const months = q.match(/за (\d+)\s*(мес)/)
  if (months) return Math.max(1, Math.min(24, Number(months[1]) * 30))
  if (/за неделю/.test(q)) return 7
  if (/за месяц/.test(q)) return 30
  return null
}

function maxTempRecent(h: Hive, n = 3): number | null {
  const temps = h.series.slice(-n).map((p) => p.tempInC).filter((t): t is number => t !== null)
  return temps.length ? Math.max(...temps) : null
}

function lastHumidity(h: Hive): number | null {
  return lastPoint(h)?.humidityPct ?? null
}

/** Лидер пасеки по 30-дневному привесу. */
function leaderOf(list: Hive[]): Hive | null {
  const withW = list.filter((x) => delta30d(x) !== null)
  if (!withW.length) return null
  return [...withW].sort((a, b) => (delta30d(b) ?? 0) - (delta30d(a) ?? 0))[0]
}

/** Сколько дней охватывает ряд (для честных подписей «за N дн.»). */
function spanDays(h: Hive): number {
  if (h.series.length < 2) return h.series.length
  const a = new Date(h.series[0].date).getTime()
  const b = new Date(h.series[h.series.length - 1].date).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return h.series.length
  return Math.round((b - a) / 86400000) + 1
}

function periodLabel(h: Hive, lang: Lang): string {
  const d = spanDays(h)
  if (d >= 25) return tr(lang, 'agent.period.month')
  if (d === 1) return tr(lang, 'agent.period.day')
  if (d === 0) return tr(lang, 'agent.period.dash')
  return tr(lang, 'agent.period.days', { n: d })
}

/** Первая буква — заглавная (метрики вида «За месяц» и причины находок). */
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Порог срабатывания «падения веса» (признак возможного роения). */
const SWARM_DROP = -1.0

function swarmProbability(drop: number, lang: Lang): string {
  const p = drop <= -3 ? 80 : drop <= -2 ? 70 : drop <= -1.5 ? 62 : 55
  return tr(lang, 'agent.swarm.prob', { p })
}

/* ------------------------------------------------------------------ */
/* Находки агента (карточки на дашборде)                               */
/* ------------------------------------------------------------------ */

/** Ярлыки статуса hiveStatus (hive-model.ts) → ключи перевода. */
const STATUS_LABEL_KEYS: Record<string, string> = {
  'Нет данных': 'agent.level.nodata',
  'Риск роения': 'agent.level.risk',
  'Слабый привес': 'agent.level.watchGain',
  'Датчик молчит': 'agent.level.sensorSilent',
  'Штатный режим': 'agent.level.ok',
}

function hiveFinding(h: Hive, ctx: AgentContext): AgentFinding {
  const l = ctx.lang ?? 'ru'
  const status = hiveStatus(h, ctx.hives)
  const d2 = delta2d(h)
  const d30 = delta30d(h)
  const t = lastPoint(h)?.tempInC ?? null
  const hum = lastHumidity(h)

  if (h.series.length === 0 || (lastWeight(h) === null && t === null)) {
    return {
      id: `nodata-${h.id}`,
      scenario: 'status',
      hiveId: h.id,
      title: tr(l, 'agent.find.nodata.title', { n: h.id }),
      text: tr(l, 'agent.find.nodata.text', { n: h.id }),
      basis: [tr(l, 'agent.basis.db'), tr(l, 'agent.basis.measurements', { n: h.id })],
      urgency: 'this-week',
      urgencyNote: tr(l, 'agent.note.loadData'),
      probability: tr(l, 'agent.prob.nodata'),
      metrics: [{ label: tr(l, 'agent.metric.measurements'), value: String(h.series.length) }],
      prefill: tr(l, 'agent.prefill.what', { n: h.id }),
    }
  }

  if (status.level === 'risk' && d2 !== null) {
    const peak = Math.max(...h.series.slice(-3).map((p) => p.weightKg ?? -Infinity))
    const now = lastWeight(h) ?? peak
    return {
      id: `swarm-${h.id}`,
      scenario: 'swarm',
      hiveId: h.id,
      title: tr(l, 'agent.find.swarm.title'),
      text: tr(l, 'agent.find.swarm.text', {
        n: h.id,
        w: fmtNum(Math.abs(d2)),
        peak: fmtNum(peak),
        now: fmtNum(now),
        temp: t !== null ? tr(l, 'agent.find.swarm.temp', { t: fmtNum(t) }) : '',
        hum: hum !== null ? tr(l, 'agent.find.swarm.hum', { h: fmtNum(hum, 0) }) : '',
      }),
      basis: [
        tr(l, 'agent.basis.weightChart', { n: h.id }),
        tr(l, 'agent.basis.weight2d', { w: fmtSigned(d2) }),
        ...(t !== null ? [tr(l, 'agent.basis.tempNormCheck', { t: fmtNum(t) })] : []),
        tr(l, 'agent.basis.seasonJuly'),
      ],
      urgency: 'today',
      urgencyNote: tr(l, 'agent.note.inspectTodayEvening'),
      probability: swarmProbability(d2, l),
      metrics: [
        { label: tr(l, 'agent.metric.weight2d'), value: tr(l, 'agent.value.kg', { w: fmtSigned(d2) }) },
        ...(t !== null ? [{ label: tr(l, 'agent.metric.tempIn'), value: tr(l, 'agent.value.tempC', { t: fmtNum(t) }) }] : []),
        ...(hum !== null ? [{ label: tr(l, 'agent.metric.humidity'), value: tr(l, 'agent.value.pct', { h: fmtNum(hum, 0) }) }] : []),
      ],
      prefill: tr(l, 'agent.prefill.what', { n: h.id }),
    }
  }

  if (status.level === 'watch' && h.label !== undefined) {
    const leader = leaderOf(ctx.hives)
    const reason = !h.humiditySensorOk && h.humidityOfflineFrom
      ? tr(l, 'agent.find.slow.reasonSensor')
      : tr(l, 'agent.find.slow.reasonLeader')
    return {
      id: `slow-${h.id}`,
      scenario: 'status',
      hiveId: h.id,
      title: tr(l, 'agent.find.slow.title'),
      text: tr(l, 'agent.find.slow.text', {
        n: h.id,
        w: fmtSigned(d30 ?? 0),
        period: periodLabel(h, l),
        leader:
          leader && leader.id !== h.id
            ? tr(l, 'agent.find.slow.leader', { n: leader.id, w: fmtSigned(delta30d(leader) ?? 0) })
            : '',
        temp: t !== null ? tr(l, 'agent.inline.temp', { t: fmtNum(t) }) : '',
        reason: cap(reason),
        extra: h.humidityOfflineFrom
          ? tr(l, 'agent.find.slow.offline', { date: h.humidityOfflineFrom })
          : tr(l, 'agent.find.slow.compare'),
      }),
      basis: [
        tr(l, 'agent.basis.gainCompare'),
        tr(l, 'agent.basis.slowGain', { n: h.id, w: fmtSigned(d30 ?? 0) }),
        ...(h.humidityOfflineFrom ? [tr(l, 'agent.basis.humOffline', { date: h.humidityOfflineFrom })] : []),
      ],
      urgency: 'this-week',
      urgencyNote: tr(l, 'agent.note.checkSensorDays'),
      probability: tr(l, 'agent.prob.indirect'),
      metrics: [
        { label: tr(l, 'agent.metric.gainPeriod', { period: periodLabel(h, l) }), value: tr(l, 'agent.value.kg', { w: fmtSigned(d30 ?? 0) }) },
        ...(leader && leader.id !== h.id
          ? [{ label: tr(l, 'agent.metric.leaderN', { n: leader.id }), value: tr(l, 'agent.value.kg', { w: fmtSigned(delta30d(leader) ?? 0) }) }]
          : []),
        ...(hum !== null
          ? [{ label: tr(l, 'agent.metric.humidity'), value: tr(l, 'agent.value.pct', { h: fmtNum(hum, 0) }) }]
          : [{ label: tr(l, 'agent.metric.humidity'), value: tr(l, 'agent.metric.nodata') }]),
      ],
      prefill: tr(l, 'agent.prefill.slowGain', { n: h.id }),
    }
  }

  return {
    id: `ok-${h.id}`,
    scenario: 'status',
    hiveId: h.id,
    title: tr(l, 'agent.find.ok.title'),
    text: tr(l, 'agent.find.ok.text', {
      n: h.id,
      w: fmtNum(lastWeight(h) ?? 0),
      g: fmtSigned(d30 ?? 0),
      period: periodLabel(h, l),
      d2: fmtSigned(d2 ?? 0),
      temp: t !== null ? tr(l, 'agent.find.ok.temp', { t: fmtNum(t) }) : '',
    }),
    basis: [
      tr(l, 'agent.basis.weightChart', { n: h.id }),
      tr(l, 'agent.basis.gain', { w: fmtSigned(d30 ?? 0) }),
      tr(l, 'agent.basis.tempOkFamily'),
    ],
    urgency: 'ok',
    urgencyNote: tr(l, 'agent.note.observe'),
    metrics: [
      { label: tr(l, 'agent.metric.gainPeriod', { period: periodLabel(h, l) }), value: tr(l, 'agent.value.kg', { w: fmtSigned(d30 ?? 0) }) },
      ...(t !== null ? [{ label: tr(l, 'agent.metric.tempIn'), value: tr(l, 'agent.value.tempC', { t: fmtNum(t) }) }] : []),
      ...(hum !== null ? [{ label: tr(l, 'agent.metric.humidity'), value: tr(l, 'agent.value.pct', { h: fmtNum(hum, 0) }) }] : []),
    ],
    prefill: tr(l, 'agent.prefill.whatOk', { n: h.id }),
  }
}

function pesticideFindingOf(ctx: AgentContext): AgentFinding | null {
  const a = ctx.pesticide
  if (!a) return null
  const l = ctx.lang ?? 'ru'
  return {
    id: 'pesticide',
    scenario: 'pesticide',
    hiveId: null,
    title: tr(l, 'agent.find.pest.title', { d: fmtNum(a.distanceKm) }),
    text: tr(l, 'agent.find.pest.text', {
      date: a.dateLabel,
      crop: a.crop,
      field: a.field,
      d: fmtNum(a.distanceKm),
      wind: a.windNote,
    }),
    basis: [
      tr(l, 'agent.basis.gisCoords'),
      tr(l, 'agent.basis.sourceDate', { source: cap(a.source), date: a.dateLabel }),
      tr(l, 'agent.basis.distInside', { d: fmtNum(a.distanceKm) }),
      tr(l, 'agent.basis.windForecast'),
    ],
    urgency: 'act-now',
    urgencyNote: tr(l, 'agent.find.pest.note'),
    probability: tr(l, 'agent.prob.riskHigh'),
    metrics: [
      { label: tr(l, 'agent.metric.distance'), value: tr(l, 'agent.value.km', { d: fmtNum(a.distanceKm) }) },
      { label: tr(l, 'agent.metric.treatDate'), value: a.dateLabel },
      { label: tr(l, 'agent.metric.flightRadius'), value: tr(l, 'agent.value.radiusFlight') },
    ],
    prefill: tr(l, 'agent.prefill.pest'),
  }
}

function weatherFindingOf(ctx: AgentContext): AgentFinding | null {
  const w = ctx.weather
  if (!w || w.length === 0) return null
  const good = w.filter((d) => d.flight === 'good')
  const bad = w.filter((d) => d.flight === 'bad')
  const tMax = Math.max(...w.map((d) => d.tMax))
  const rainProb = bad.length ? Math.max(...bad.map((d) => d.precipProb)) : 0
  const l = ctx.lang ?? 'ru'
  return {
    id: 'weather',
    scenario: 'weather',
    hiveId: null,
    title: good.length
      ? tr(l, 'agent.find.weather.title', { days: good.map((d) => dayMonth(d.date, l)).join(', ').slice(0, 80) })
      : tr(l, 'agent.find.weather.titleBad'),
    text: good.length
      ? tr(l, 'agent.find.weather.textGood', {
          list: good.map((d) => d.full).join(', '),
          tmax: fmtSigned(tMax, 0),
          wind: Math.max(...good.map((d) => d.windMs)),
          bad: bad.length
            ? tr(l, 'agent.find.weather.bad', {
                days: bad.map((d) => d.full).join(tr(l, 'agent.misc.and')),
                p: rainProb,
                wind: Math.max(...bad.map((d) => d.windMs)),
              })
            : '',
        })
      : tr(l, 'agent.find.weather.textBad'),
    basis: [tr(l, 'agent.basis.weather'), tr(l, 'agent.basis.bloomCalendar')],
    urgency: 'ok',
    urgencyNote: good.length ? tr(l, 'agent.note.useFlightWindow') : tr(l, 'agent.note.watchWeather'),
    metrics: [
      { label: tr(l, 'agent.metric.max'), value: tr(l, 'agent.value.tempC', { t: fmtSigned(tMax, 0) }) },
      ...(bad.length ? [{ label: tr(l, 'agent.metric.rain'), value: tr(l, 'agent.value.uptoPct', { p: rainProb }) }] : []),
      ...(ctx.sites.length
        ? [{ label: tr(l, 'agent.metric.migrationCandidates'), value: String(ctx.sites.length) }]
        : []),
    ],
    prefill: tr(l, 'agent.prefill.weather'),
  }
}

/** «2026-07-20» → «20 июля» — форма «число + месяц» для заголовка находки. */
function dayMonth(date: string, lang: Lang): string {
  const m = Number(date.slice(5, 7))
  return tr(lang, 'agent.date.dayMonth', {
    d: Number(date.slice(8)),
    m: m >= 1 && m <= 12 ? tr(lang, `agent.month.${m}`) : '',
  })
}

function migrationFindingOf(ctx: AgentContext): AgentFinding | null {
  const sites = [...ctx.sites].sort((a, b) => b.score - a.score)
  if (!sites.length) return null
  const best = sites[0]
  const worst = sites[sites.length - 1]
  const l = ctx.lang ?? 'ru'
  const counted = `${sites.length} ${tr(
    l,
    sites.length === 1 ? 'agent.unit.site.one' : sites.length < 5 ? 'agent.unit.site.few' : 'agent.unit.site.many',
  )}`
  return {
    id: 'migration',
    scenario: 'migration',
    hiveId: null,
    title: tr(l, 'agent.find.mig.title', { name: best.name }),
    text: tr(l, 'agent.find.mig.text', {
      counted,
      name: best.name,
      plant: best.honeyPlant.toLowerCase(),
      bloom: best.bloomWindow,
      d: fmtNum(best.distanceKm),
      weather: best.weatherNote.toLowerCase(),
      risks: best.risks ? tr(l, 'agent.find.mig.risks', { r: best.risks.toLowerCase() }) : '',
      avoid:
        sites.length > 1 && worst.verdict === 'avoid'
          ? tr(l, 'agent.find.mig.avoid', {
              name: worst.name.replace(/^Донниковое поле \(/, '').replace(/\)$/, ''),
              r: worst.risks.toLowerCase() || tr(l, 'agent.find.mig.lowScore'),
            })
          : '',
    }),
    basis: [tr(l, 'agent.basis.gisPlants'), tr(l, 'agent.basis.weatherSites'), tr(l, 'agent.basis.pestRegistry')],
    urgency: 'this-week',
    urgencyNote: tr(l, 'agent.note.decideBeforeBloom'),
    metrics: [
      { label: tr(l, 'agent.metric.bestSite'), value: tr(l, 'agent.value.score10', { s: fmtNum(best.score) }) },
      { label: tr(l, 'agent.metric.distance'), value: tr(l, 'agent.value.km', { d: fmtNum(best.distanceKm) }) },
      { label: tr(l, 'agent.metric.bloom'), value: best.bloomWindow },
    ],
    prefill: tr(l, 'agent.prefill.migration'),
  }
}

/** Список находок: по выбранному улью + глобальные сценарии, отсортированы по срочности. */
export function findingsFor(hiveId: number, ctx: AgentContext): AgentFinding[] {
  const hive = ctx.hives.find((x) => x.id === hiveId) ?? ctx.hives[0]
  const list: AgentFinding[] = []
  if (hive) list.push(hiveFinding(hive, ctx))
  const pesticide = pesticideFindingOf(ctx)
  if (pesticide) list.push(pesticide)
  const weatherF = weatherFindingOf(ctx)
  if (weatherF) list.push(weatherF)
  const migrationF = migrationFindingOf(ctx)
  if (migrationF) list.push(migrationF)
  const rank: Record<Urgency, number> = { 'act-now': 0, today: 1, 'this-week': 2, ok: 3 }
  return list.sort((a, b) => rank[a.urgency] - rank[b.urgency])
}

/* ------------------------------------------------------------------ */
/* Ответы на вопросы пчеловода                                         */
/* ------------------------------------------------------------------ */

function norm(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е')
}

function extractHiveId(q: string, ctx: AgentContext): number | null {
  const m = q.match(/(?:№|улье|улья|улью|улье|hive)\s*№?\s*(\d+)/)
  if (!m) return null
  const id = Number(m[1])
  return ctx.hives.some((h) => h.id === id) ? id : null
}

function swarmAnswer(h: Hive, ctx: AgentContext): AgentMessage {
  const l = ctx.lang ?? 'ru'
  const status = hiveStatus(h, ctx.hives)
  const d2 = delta2d(h)
  const t = lastPoint(h)?.tempInC ?? null
  const hum = lastHumidity(h)

  if (h.series.length === 0 || (lastWeight(h) === null && d2 === null)) {
    return {
      scenario: 'swarm',
      hiveId: h.id,
      text: tr(l, 'agent.swarm.nodata.text', { n: h.id }),
      basis: [tr(l, 'agent.basis.db'), tr(l, 'agent.basis.measurements', { n: h.id })],
      urgency: 'this-week',
      urgencyNote: tr(l, 'agent.note.loadData'),
      probability: tr(l, 'agent.prob.nodata'),
      metrics: [{ label: tr(l, 'agent.metric.weightData'), value: tr(l, 'agent.value.no') }],
    }
  }

  if (status.level === 'risk' && d2 !== null) {
    const peak = Math.max(...h.series.slice(-3).map((p) => p.weightKg ?? -Infinity))
    const now = lastWeight(h) ?? peak
    return {
      scenario: 'swarm',
      hiveId: h.id,
      text: tr(l, 'agent.swarm.risk.text', {
        n: h.id,
        w: fmtNum(Math.abs(d2)),
        peak: fmtNum(peak),
        now: fmtNum(now),
        temp: t !== null ? tr(l, 'agent.swarm.risk.temp', { t: fmtNum(t) }) : '',
        hum: hum !== null ? tr(l, 'agent.swarm.risk.hum', { h: fmtNum(hum, 0) }) : '',
      }),
      basis: [
        tr(l, 'agent.basis.weightChart', { n: h.id }),
        tr(l, 'agent.basis.weight2d', { w: fmtSigned(d2) }),
        ...(t !== null ? [tr(l, 'agent.basis.tempNormValue', { t: fmtNum(t) })] : []),
        tr(l, 'agent.basis.seasonJuly'),
      ],
      urgency: 'today',
      urgencyNote: tr(l, 'agent.note.inspectToday'),
      probability: swarmProbability(d2, l),
      metrics: [
        { label: tr(l, 'agent.metric.weight2d'), value: tr(l, 'agent.value.kg', { w: fmtSigned(d2) }) },
        ...(t !== null ? [{ label: tr(l, 'agent.metric.tempIn'), value: tr(l, 'agent.value.tempC', { t: fmtNum(t) }) }] : []),
        ...(hum !== null ? [{ label: tr(l, 'agent.metric.humidity'), value: tr(l, 'agent.value.pct', { h: fmtNum(hum, 0) }) }] : []),
      ],
    }
  }

  return {
    scenario: 'swarm',
    hiveId: h.id,
    text: tr(l, 'agent.swarm.ok.text', {
      n: h.id,
      d2: fmtSigned(d2 ?? 0),
      temp: t !== null ? tr(l, 'agent.inline.temp', { t: fmtNum(t) }) : '',
    }),
    basis: [
      tr(l, 'agent.basis.weightChart', { n: h.id }),
      tr(l, 'agent.basis.swarmSignsCompare'),
      tr(l, 'agent.basis.tempOkFamily'),
    ],
    urgency: 'ok',
    urgencyNote: tr(l, 'agent.note.observeSignal'),
    probability: tr(l, 'agent.prob.noSwarmSigns'),
    metrics: [
      { label: tr(l, 'agent.metric.weight2d'), value: tr(l, 'agent.value.kg', { w: fmtSigned(d2 ?? 0) }) },
      ...(t !== null ? [{ label: tr(l, 'agent.metric.tempIn'), value: tr(l, 'agent.value.tempC', { t: fmtNum(t) }) }] : []),
      { label: tr(l, 'agent.metric.humidity'), value: hum !== null ? tr(l, 'agent.value.pct', { h: fmtNum(hum, 0) }) : tr(l, 'agent.metric.nodata') },
    ],
  }
}

function statusAnswer(h: Hive, ctx: AgentContext): AgentMessage {
  const l = ctx.lang ?? 'ru'
  const status = hiveStatus(h, ctx.hives)
  const d2 = delta2d(h)
  const d30 = delta30d(h)
  const t = lastPoint(h)?.tempInC ?? null
  const hum = lastHumidity(h)
  const w = lastWeight(h)

  if (h.series.length === 0) {
    return {
      scenario: 'status',
      hiveId: h.id,
      text: tr(l, 'agent.status.nodata.text', { n: h.id }),
      basis: [tr(l, 'agent.basis.db')],
      urgency: 'this-week',
      urgencyNote: tr(l, 'agent.note.loadData'),
      probability: tr(l, 'agent.prob.insufficient'),
      metrics: [{ label: tr(l, 'agent.metric.measurements'), value: '0' }],
    }
  }

  if (status.level === 'risk' && d2 !== null) {
    const peak = Math.max(...h.series.slice(-3).map((p) => p.weightKg ?? -Infinity))
    return {
      scenario: 'swarm',
      hiveId: h.id,
      text: tr(l, 'agent.status.risk.text', {
        n: h.id,
        peak: fmtNum(peak),
        w: fmtNum(w ?? 0),
        drop: fmtNum(Math.abs(d2)),
        temp: t !== null ? tr(l, 'agent.status.risk.temp', { t: fmtNum(t) }) : '',
      }),
      basis: [
        tr(l, 'agent.basis.weightChart', { n: h.id }),
        tr(l, 'agent.basis.weight2d', { w: fmtSigned(d2) }),
        ...(t !== null ? [tr(l, 'agent.basis.tempHigh')] : []),
        tr(l, 'agent.basis.seasonJuly'),
      ],
      urgency: 'today',
      urgencyNote: tr(l, 'agent.note.inspectShort'),
      probability: swarmProbability(d2, l),
      metrics: [
        { label: tr(l, 'agent.metric.weightNow'), value: tr(l, 'agent.value.kg', { w: fmtNum(w ?? 0) }) },
        { label: tr(l, 'agent.metric.weight2d'), value: tr(l, 'agent.value.kg', { w: fmtSigned(d2) }) },
        ...(t !== null ? [{ label: tr(l, 'agent.metric.tempIn'), value: tr(l, 'agent.value.tempC', { t: fmtNum(t) }) }] : []),
      ],
    }
  }

  if (status.level === 'watch') {
    const leader = leaderOf(ctx.hives)
    return {
      scenario: 'status',
      hiveId: h.id,
      text: tr(l, 'agent.status.watch.text', {
        n: h.id,
        w: fmtSigned(d30 ?? 0),
        period: periodLabel(h, l),
        leader:
          leader && leader.id !== h.id
            ? tr(l, 'agent.status.watch.leader', { n: leader.id, w: fmtSigned(delta30d(leader) ?? 0) })
            : '',
        temp: t !== null ? tr(l, 'agent.inline.temp', { t: fmtNum(t) }) : '',
        extra:
          !h.humiditySensorOk && h.humidityOfflineFrom
            ? tr(l, 'agent.status.watch.extraSensor', { date: h.humidityOfflineFrom })
            : tr(l, 'agent.status.watch.extraVisit'),
      }),
      basis: [
        tr(l, 'agent.basis.gainCompare'),
        ...(h.humidityOfflineFrom ? [tr(l, 'agent.basis.humOffline', { date: h.humidityOfflineFrom })] : []),
        tr(l, 'agent.basis.tempOk'),
      ],
      urgency: 'this-week',
      urgencyNote: tr(l, 'agent.note.checkFamily'),
      probability: tr(l, 'agent.prob.indirectShort'),
      metrics: [
        { label: tr(l, 'agent.metric.gainPeriod', { period: periodLabel(h, l) }), value: tr(l, 'agent.value.kg', { w: fmtSigned(d30 ?? 0) }) },
        ...(leader && leader.id !== h.id
          ? [{ label: tr(l, 'agent.metric.leaderN', { n: leader.id }), value: tr(l, 'agent.value.kg', { w: fmtSigned(delta30d(leader) ?? 0) }) }]
          : []),
        { label: tr(l, 'agent.metric.humidity'), value: hum !== null ? tr(l, 'agent.value.pct', { h: fmtNum(hum, 0) }) : tr(l, 'agent.metric.nodata') },
      ],
    }
  }

  return {
    scenario: 'status',
    hiveId: h.id,
    text: tr(l, 'agent.status.ok.text', {
      n: h.id,
      w: fmtNum(w ?? 0),
      g: fmtSigned(d30 ?? 0),
      period: periodLabel(h, l),
      d2: fmtSigned(d2 ?? 0),
      temp: t !== null ? tr(l, 'agent.inline.temp', { t: fmtNum(t) }) : '',
      hum: hum !== null ? tr(l, 'agent.inline.hum', { h: fmtNum(hum, 0) }) : '',
    }),
    basis: [
      tr(l, 'agent.basis.weightChart', { n: h.id }),
      tr(l, 'agent.basis.gain', { w: fmtSigned(d30 ?? 0) }),
      tr(l, 'agent.basis.tempHumOk'),
    ],
    urgency: 'ok',
    urgencyNote: tr(l, 'agent.note.observe'),
    metrics: [
      { label: tr(l, 'agent.metric.weightNow'), value: tr(l, 'agent.value.kg', { w: fmtNum(w ?? 0) }) },
      { label: tr(l, 'agent.metric.gainMonth'), value: tr(l, 'agent.value.kg', { w: fmtSigned(d30 ?? 0) }) },
      ...(t !== null ? [{ label: tr(l, 'agent.metric.tempIn'), value: tr(l, 'agent.value.tempC', { t: fmtNum(t) }) }] : []),
    ],
  }
}

function weightAnswer(h: Hive, ctx: AgentContext, periodDays?: number | null): AgentMessage {
  const l = ctx.lang ?? 'ru'
  const d2 = delta2d(h)
  const d30 = delta30d(h)
  const w = lastWeight(h)
  const risky = d2 !== null && d2 <= SWARM_DROP

  // Произвольный период (п. 7 ТЗ): «привес за 8 дней», «за месяц» и т.д.
  if (periodDays && h.series.length > 0 && w !== null) {
    const gN = weightDelta(h, periodDays)
    const riskyPeriod = gN !== null && gN <= SWARM_DROP
    return {
      scenario: 'status',
      hiveId: h.id,
      text: tr(l, 'agent.weight.period.text', {
        n: h.id,
        w: fmtNum(w),
        days: periodDays,
        g: gN !== null ? fmtSigned(gN) : tr(l, 'agent.metric.nodata'),
        risky: riskyPeriod ? tr(l, 'agent.weight.risky') : '',
      }),
      basis: [tr(l, 'agent.basis.weightChart', { n: h.id }), tr(l, 'agent.basis.periodArbitrary', { days: periodDays })],
      urgency: riskyPeriod ? 'today' : 'ok',
      urgencyNote: riskyPeriod ? tr(l, 'agent.note.checkToday') : tr(l, 'agent.note.observe'),
      probability: riskyPeriod ? tr(l, 'agent.prob.matchesSwarm') : undefined,
      metrics: [
        { label: tr(l, 'agent.metric.weightNow'), value: tr(l, 'agent.value.kg', { w: fmtNum(w) }) },
        { label: tr(l, 'agent.metric.periodDays', { days: periodDays }), value: gN !== null ? tr(l, 'agent.value.kg', { w: fmtSigned(gN) }) : tr(l, 'agent.metric.nodata') },
        { label: cap(periodLabel(h, l)), value: tr(l, 'agent.value.kg', { w: fmtSigned(d30 ?? 0) }) },
      ],
    }
  }

  if (h.series.length === 0 || w === null) {
    return {
      scenario: 'status',
      hiveId: h.id,
      text: tr(l, 'agent.weight.nodata.text', { n: h.id }),
      basis: [tr(l, 'agent.basis.db')],
      urgency: 'this-week',
      urgencyNote: tr(l, 'agent.note.loadData'),
      probability: tr(l, 'agent.prob.insufficient'),
      metrics: [{ label: tr(l, 'agent.metric.weight'), value: tr(l, 'agent.metric.nodata') }],
    }
  }

  const others = ctx.hives
    .map((x) => ({ x, d: delta30d(x) }))
    .filter((o): o is { x: Hive; d: number } => o.d !== null)
    .map((o) => tr(l, 'agent.item.hiveGain', { n: o.x.id, w: fmtSigned(o.d) }))
    .join(', ')

  return {
    scenario: 'status',
    hiveId: h.id,
    text: tr(l, 'agent.weight.text', {
      n: h.id,
      w: fmtNum(w),
      d2: fmtSigned(d2 ?? 0),
      period: periodLabel(h, l),
      d30: fmtSigned(d30 ?? 0),
      risky: risky ? tr(l, 'agent.weight.risky') : '',
      others: others || tr(l, 'agent.weight.noOthers'),
    }),
    basis: [
      tr(l, 'agent.basis.weightChart', { n: h.id }),
      tr(l, 'agent.basis.gainAll'),
      tr(l, 'agent.basis.ruleGain'),
    ],
    urgency: risky ? 'today' : 'ok',
    urgencyNote: risky ? tr(l, 'agent.note.checkToday') : tr(l, 'agent.note.observe'),
    probability: risky ? tr(l, 'agent.prob.matchesSwarm') : undefined,
    metrics: [
      { label: tr(l, 'agent.metric.weightNow'), value: tr(l, 'agent.value.kg', { w: fmtNum(w) }) },
      { label: tr(l, 'agent.metric.days2'), value: tr(l, 'agent.value.kg', { w: fmtSigned(d2 ?? 0) }) },
      { label: cap(periodLabel(h, l)), value: tr(l, 'agent.value.kg', { w: fmtSigned(d30 ?? 0) }) },
    ],
  }
}

function humidityAnswer(h: Hive, ctx: AgentContext): AgentMessage {
  const l = ctx.lang ?? 'ru'
  const hum = lastHumidity(h)
  const offline = !h.humiditySensorOk && h.humidityOfflineFrom

  if (h.series.length === 0) {
    return {
      scenario: 'status',
      hiveId: h.id,
      text: tr(l, 'agent.humidity.nodata.text', { n: h.id }),
      basis: [tr(l, 'agent.basis.db')],
      urgency: 'this-week',
      urgencyNote: tr(l, 'agent.note.loadData'),
      probability: tr(l, 'agent.prob.insufficient'),
      metrics: [{ label: tr(l, 'agent.metric.humidity'), value: tr(l, 'agent.metric.nodata') }],
    }
  }

  if (offline || hum === null) {
    const t = lastPoint(h)?.tempInC
    const d30 = delta30d(h)
    return {
      scenario: 'status',
      hiveId: h.id,
      text: tr(l, 'agent.humidity.offline.text', {
        n: h.id,
        since: h.humidityOfflineFrom ? tr(l, 'agent.inline.since', { date: h.humidityOfflineFrom }) : '',
        w: fmtSigned(delta30d(h) ?? 0),
        period: periodLabel(h, l),
        temp: t != null ? tr(l, 'agent.inline.temp', { t: fmtNum(t) }) : '',
      }),
      basis: [
        tr(l, 'agent.basis.humSensorNodata', {
          n: h.id,
          since: h.humidityOfflineFrom ? tr(l, 'agent.inline.since', { date: h.humidityOfflineFrom }) : '',
        }),
        tr(l, 'agent.basis.gainPeriod', { w: fmtSigned(d30 ?? 0), period: periodLabel(h, l) }),
      ],
      urgency: 'this-week',
      urgencyNote: tr(l, 'agent.note.checkSensor'),
      probability: tr(l, 'agent.prob.insufficientHonest'),
      metrics: [
        { label: tr(l, 'agent.metric.humidity'), value: tr(l, 'agent.metric.nodata') },
        { label: tr(l, 'agent.metric.gainMonth'), value: tr(l, 'agent.value.kg', { w: fmtSigned(d30 ?? 0) }) },
        ...(t != null ? [{ label: tr(l, 'agent.metric.tempIn'), value: tr(l, 'agent.value.tempC', { t: fmtNum(t) }) }] : []),
      ],
    }
  }

  const verdict =
    hum > 70
      ? tr(l, 'agent.humidity.verdictWet')
      : hum > 64
        ? tr(l, 'agent.humidity.verdictUpper')
        : tr(l, 'agent.humidity.verdictOk')
  return {
    scenario: 'status',
    hiveId: h.id,
    text: tr(l, 'agent.humidity.text', { n: h.id, h: fmtNum(hum, 0), verdict }),
    basis: [tr(l, 'agent.basis.humSensor', { n: h.id }), tr(l, 'agent.basis.normHum')],
    urgency: hum > 70 ? 'today' : 'ok',
    urgencyNote: hum > 70 ? tr(l, 'agent.note.ventilation') : tr(l, 'agent.note.observe'),
    metrics: [
      { label: tr(l, 'agent.metric.humidity'), value: tr(l, 'agent.value.pct', { h: fmtNum(hum, 0) }) },
      { label: tr(l, 'agent.metric.norm'), value: tr(l, 'agent.value.humNorm') },
    ],
  }
}

function climateAnswer(h: Hive, ctx: AgentContext): AgentMessage {
  const l = ctx.lang ?? 'ru'
  const t = lastPoint(h)?.tempInC ?? null
  const risky = hiveStatus(h, hiveStatusArgFallback(h)).level === 'risk'

  if (t === null) {
    return {
      scenario: 'status',
      hiveId: h.id,
      text: tr(l, 'agent.climate.nodata.text', { n: h.id }),
      basis: [tr(l, 'agent.basis.db')],
      urgency: 'this-week',
      urgencyNote: tr(l, 'agent.note.loadData'),
      probability: tr(l, 'agent.prob.insufficient'),
      metrics: [{ label: tr(l, 'agent.metric.tempIn'), value: tr(l, 'agent.metric.nodata') }],
    }
  }

  return {
    scenario: risky ? 'swarm' : 'status',
    hiveId: h.id,
    text: risky
      ? tr(l, 'agent.climate.risk.text', { n: h.id, t: fmtNum(t), dt: fmtNum(t - 35.0) })
      : tr(l, 'agent.climate.ok.text', { n: h.id, t: fmtNum(t) }),
    basis: [
      tr(l, 'agent.basis.tempSensor', { n: h.id }),
      tr(l, 'agent.basis.normTemp'),
      ...(risky ? [tr(l, 'agent.basis.joint')] : []),
    ],
    urgency: risky ? 'today' : 'ok',
    urgencyNote: risky ? tr(l, 'agent.note.inspectShort') : tr(l, 'agent.note.observe'),
    probability: risky ? tr(l, 'agent.prob.joint') : undefined,
    metrics: [
      { label: tr(l, 'agent.metric.tempNow'), value: tr(l, 'agent.value.tempC', { t: fmtNum(t) }) },
      { label: tr(l, 'agent.metric.norm'), value: tr(l, 'agent.value.tempNorm') },
    ],
  }
}

/** Для climateAnswer статус проверяется по одному улью без сравнения с пасекой. */
function hiveStatusArgFallback(h: Hive): Hive[] {
  return [h]
}

function pesticideAnswer(ctx: AgentContext): AgentMessage {
  const l = ctx.lang ?? 'ru'
  const a = ctx.pesticide
  if (!a) {
    return {
      scenario: 'pesticide',
      hiveId: null,
      text: tr(l, 'agent.pest.none.text'),
      basis: [tr(l, 'agent.basis.pestOff')],
      urgency: 'ok',
      urgencyNote: tr(l, 'agent.note.sourceOff'),
      probability: tr(l, 'agent.prob.insufficient'),
      metrics: [{ label: tr(l, 'agent.metric.pestRegistry'), value: tr(l, 'agent.metric.nodata') }],
    }
  }
  return {
    scenario: 'pesticide',
    hiveId: null,
    text: tr(l, 'agent.pest.alert.text', {
      date: a.dateLabel,
      crop: a.crop,
      field: a.field,
      d: fmtNum(a.distanceKm),
      wind: a.windNote,
    }),
    basis: [
      tr(l, 'agent.basis.gisCoords'),
      tr(l, 'agent.basis.sourceDate', { source: cap(a.source), date: a.dateLabel }),
      tr(l, 'agent.basis.radiusFlight'),
      tr(l, 'agent.basis.windForecast'),
    ],
    urgency: 'act-now',
    urgencyNote: tr(l, 'agent.pest.alert.note', { date: a.dateShort }),
    probability: tr(l, 'agent.prob.riskHigh'),
    metrics: [
      { label: tr(l, 'agent.metric.field'), value: tr(l, 'agent.value.cropKm', { crop: a.crop, d: fmtNum(a.distanceKm) }) },
      { label: tr(l, 'agent.metric.treatment'), value: a.dateLabel },
      { label: tr(l, 'agent.metric.wind'), value: tr(l, 'agent.value.towardApiary') },
    ],
  }
}

function weatherAnswer(ctx: AgentContext): AgentMessage {
  const l = ctx.lang ?? 'ru'
  const w = ctx.weather
  if (!w || w.length === 0) {
    return {
      scenario: 'weather',
      hiveId: null,
      text: tr(l, 'agent.weather.none.text'),
      basis: [tr(l, 'agent.basis.weatherOff'), tr(l, 'agent.basis.weightIndirect')],
      urgency: 'ok',
      urgencyNote: tr(l, 'agent.note.sourceOff'),
      probability: tr(l, 'agent.prob.insufficient'),
      metrics: [{ label: tr(l, 'agent.metric.forecast'), value: tr(l, 'agent.metric.nodata') }],
    }
  }
  const good = w.filter((d) => d.flight === 'good')
  const bad = w.filter((d) => d.flight === 'bad')
  const days = (arr: WeatherDay[]) => arr.map((d) => d.full).join(', ')
  return {
    scenario: 'weather',
    hiveId: null,
    text: good.length
      ? tr(l, 'agent.weather.good.text', {
          good: days(good),
          tmax: fmtSigned(Math.max(...good.map((d) => d.tMax)), 0),
          wind: Math.max(...good.map((d) => d.windMs)),
          bad: bad.length
            ? tr(l, 'agent.weather.badPart', {
                days: days(bad),
                p: Math.max(...bad.map((d) => d.precipProb)),
                wind: Math.max(...bad.map((d) => d.windMs)),
              })
            : '',
        })
      : tr(l, 'agent.weather.bad.text'),
    basis: [
      tr(l, 'agent.basis.weather'),
      tr(l, 'agent.basis.bloomCalendar'),
      tr(l, 'agent.basis.ruleFlight'),
    ],
    urgency: 'ok',
    urgencyNote: good.length ? tr(l, 'agent.note.useFlightWindow') : tr(l, 'agent.note.observe'),
    metrics: [
      ...(good.length ? [{ label: tr(l, 'agent.metric.flightWindow'), value: good[0].full }] : []),
      ...(bad.length
        ? [{ label: tr(l, 'agent.metric.rain'), value: tr(l, 'agent.value.uptoPct', { p: Math.max(...bad.map((d) => d.precipProb)) }) }]
        : []),
    ],
  }
}

/**
 * Поля Минсельхоза: сколько семей вывозить на каждое поле (нормативы
 * НИИ пчеловодства), цветение от даты посева, предупреждение о перенасыщении
 * и план распределения семей (п. 4 ТЗ).
 */
function cropFieldsAnswer(ctx: AgentContext): AgentMessage {
  const l = ctx.lang ?? 'ru'
  const fields = ctx.cropFields ?? []
  if (!fields.length) {
    return {
      scenario: 'migration',
      hiveId: null,
      text: tr(l, 'agent.crop.none.text'),
      basis: [tr(l, 'agent.basis.minselhoz')],
      urgency: 'this-week',
      urgencyNote: tr(l, 'agent.note.loadData'),
      probability: tr(l, 'agent.prob.nodata'),
      metrics: [{ label: tr(l, 'agent.metric.cropFields'), value: '0' }],
    }
  }
  const rows = fields
    .map((f) => {
      const rec = f.recommend ? tr(l, 'agent.crop.families', { min: f.recommend.min, max: f.recommend.max }) : ''
      const treat = f.treatments.length
        ? ' ' + tr(l, 'agent.crop.treatWarn', { date: f.treatments[0].date.split('-').reverse().join('.'), drug: f.treatments[0].drug, hazard: f.treatments[0].hazardClass })
        : ''
      return tr(l, 'agent.crop.row', {
        name: f.name,
        culture: f.cultureName,
        area: fmtNum(f.areaHa, 0),
        bloom: f.bloomText,
        rec,
        treat,
      })
    })
    .join('\n')

  // План распределения: тот же медонос на двух полях ≥3 км или другой
  // медонос с перекрытием цветения ≥10 дней → два сорта мёда.
  const pairs: string[] = []
  for (let i = 0; i < fields.length; i++) {
    for (let j = i + 1; j < fields.length; j++) {
      const a = fields[i]
      const b = fields[j]
      const sameCulture = a.culture === b.culture && Math.abs(a.distanceKm - b.distanceKm) >= 3
      const overlap =
        a.bloomStart && a.bloomEnd && b.bloomStart && b.bloomEnd
          ? (new Date(Math.min(new Date(a.bloomEnd).getTime(), new Date(b.bloomEnd).getTime())).getTime() -
              new Date(Math.max(new Date(a.bloomStart).getTime(), new Date(b.bloomStart).getTime())).getTime()) /
            86400000
          : 0
      if (sameCulture) pairs.push(tr(l, 'agent.crop.pairSame', { a: a.name, b: b.name }))
      else if (overlap >= 10) pairs.push(tr(l, 'agent.crop.pairDiff', { a: a.name, b: b.name, ca: a.cultureName, cb: b.cultureName }))
    }
  }
  const totalOptimal = fields.reduce((s, f) => s + (f.recommend?.optimal ?? 0), 0)
  const winter = seasonPhase(new Date()) === 'winter_rest'
  return {
    scenario: 'migration',
    hiveId: null,
    text: tr(l, 'agent.crop.text', {
      rows,
      plan: pairs.length
        ? tr(l, 'agent.crop.plan', { options: pairs.slice(0, 3).join('; ') })
        : '',
      season: winter ? tr(l, 'agent.crop.winterNote') : tr(l, 'agent.crop.seasonNote'),
      total: String(totalOptimal),
    }),
    basis: [tr(l, 'agent.basis.minselhoz'), tr(l, 'agent.basis.bloomFromSowing'), tr(l, 'agent.basis.normsRybnovo')],
    urgency: winter ? 'ok' : 'this-week',
    urgencyNote: winter ? tr(l, 'agent.crop.winterUrgency') : tr(l, 'agent.note.planMigration'),
    metrics: [
      { label: tr(l, 'agent.metric.cropFields'), value: String(fields.length) },
      { label: tr(l, 'agent.metric.cropArea'), value: tr(l, 'agent.value.ha', { n: fmtNum(fields.reduce((s, f) => s + f.areaHa, 0), 0) }) },
      { label: tr(l, 'agent.metric.optimalFamilies'), value: String(totalOptimal) },
    ],
  }
}

/**
 * Календарь цветения медоносов (п. 3 ТЗ): эталонные окна культур средней
 * полосы + окна полей Минсельхоза, пересчитанные от фактических дат посева.
 * Зимой календарь — план на следующий сезон; летом сверяется с GDD-прогнозом.
 * Отвечает и на вопрос про конкретный медонос («когда цветёт липа»).
 */
function bloomCalendarAnswer(question: string, ctx: AgentContext): AgentMessage {
  const l = ctx.lang ?? 'ru'
  const q = norm(question)
  const year = new Date().getFullYear()

  // Эталонные окна всех культур справочника, отсортированные по дате старта.
  const cultures = Object.values(AGRO_CULTURES)
    .map((c) => ({ c, w: estimateBloomWindow(c.key, null, year) as BloomWindow }))
    .filter((x) => x.w !== null)
    .sort((a, b) => a.w.start.getTime() - b.w.start.getTime())

  // Названный в вопросе медонос — отдельной строкой сверху с деталями.
  // Согласование: «гречихи», «липу», «донника» — ищем корень слова (имя без окончания).
  const stemOf = (name: string) => norm(name).slice(0, Math.max(4, norm(name).length - 2))
  const named =
    cultures.find(({ c }) => {
      const stem = stemOf(c.name)
      return q.includes(stem)
    }) ?? null
  const ordered = named ? [named, ...cultures.filter((x) => x !== named)] : cultures

  const yieldOf = (c: AgroCulture) => `${c.honeyYieldMin}–${c.honeyYieldMax}`
  const rows = ordered
    .map(({ c, w }) => tr(l, 'agent.bloom.row', { name: c.name, window: formatBloomWindow(w), yield: yieldOf(c) }))
    .join('\n')

  // Окна полей Минсельхоза: расчёт от фактической даты посева + отклонение от эталона.
  const fields = (ctx.cropFields ?? []).filter((f) => f.sowingDate && f.bloomText)
  const corrRows = fields
    .map((f) => {
      const bloomYear = f.bloomStart ? new Date(f.bloomStart + 'T00:00:00').getFullYear() : year
      const etalon = estimateBloomWindow(f.culture, null, bloomYear)
      let dev = ''
      if (etalon && f.bloomStart) {
        const d = Math.round((new Date(f.bloomStart + 'T00:00:00').getTime() - etalon.start.getTime()) / 86400000)
        if (d > 0) dev = tr(l, 'agent.bloom.devLate', { d })
        else if (d < 0) dev = tr(l, 'agent.bloom.devEarly', { d: -d })
      }
      return tr(l, 'agent.bloom.corrRow', { name: f.name, culture: f.cultureName, bloom: f.bloomText, dev })
    })
    .join('\n')

  // Совет про два сорта мёда: пара медоносов с максимальным перекрытием окон.
  let tip = ''
  let bestOverlap = 0
  let tipPair: [AgroCulture, AgroCulture] | null = null
  for (let i = 0; i < cultures.length; i++) {
    for (let j = i + 1; j < cultures.length; j++) {
      const a = cultures[i]
      const b = cultures[j]
      const overlap = Math.min(a.w.end.getTime(), b.w.end.getTime()) - Math.max(a.w.start.getTime(), b.w.start.getTime())
      if (overlap > bestOverlap) {
        bestOverlap = overlap
        tipPair = [a.c, b.c]
      }
    }
  }
  if (tipPair && bestOverlap >= 10 * 86400000) {
    tip = tr(l, 'agent.bloom.tip', { a: tipPair[0].name, b: tipPair[1].name })
  }

  const winter = seasonPhase(new Date()) === 'winter_rest'
  const season = winter ? tr(l, 'agent.bloom.seasonWinter') : tr(l, 'agent.bloom.seasonActive')

  const parts: string[] = []
  if (named) {
    const note = named.c.note.charAt(0).toUpperCase() + named.c.note.slice(1)
    parts.push(
      tr(l, 'agent.bloom.single', {
        name: named.c.name,
        window: formatBloomWindow(named.w),
        yield: yieldOf(named.c),
        note,
      }),
    )
    parts.push(tr(l, 'agent.bloom.fullList', { rows }))
  } else {
    parts.push(tr(l, 'agent.bloom.etalonTitle', { rows }))
  }
  if (corrRows) parts.push(tr(l, 'agent.bloom.corrected', { rows: corrRows }))
  if (tip) parts.push(tip)
  parts.push(season)

  const basis = [tr(l, 'agent.basis.agroCalendar')]
  if (corrRows) basis.push(tr(l, 'agent.basis.minselhoz'), tr(l, 'agent.basis.bloomFromSowing'))

  const earliest = cultures[0]
  return {
    scenario: 'bloom',
    hiveId: null,
    text: parts.join('\n'),
    basis,
    urgency: winter ? 'ok' : 'this-week',
    urgencyNote: winter ? tr(l, 'agent.crop.winterUrgency') : tr(l, 'agent.note.planMigration'),
    metrics: [
      { label: tr(l, 'agent.metric.bloomCultures'), value: String(cultures.length) },
      ...(earliest
        ? [{ label: tr(l, 'agent.metric.bloomEarliest'), value: `${earliest.c.name} — ${formatBloomWindow(earliest.w)}` }]
        : []),
      ...(fields.length ? [{ label: tr(l, 'agent.metric.bloomFields'), value: String(fields.length) }] : []),
    ],
  }
}

function migrationAnswer(ctx: AgentContext): AgentMessage {
  const l = ctx.lang ?? 'ru'
  const sites = [...ctx.sites].sort((a, b) => b.score - a.score)
  if (!sites.length) {
    return {
      scenario: 'migration',
      hiveId: null,
      text: tr(l, 'agent.mig.none.text'),
      basis: [tr(l, 'agent.basis.sitesEmpty')],
      urgency: 'this-week',
      urgencyNote: tr(l, 'agent.note.addSites'),
      probability: tr(l, 'agent.prob.insufficient'),
      metrics: [{ label: tr(l, 'agent.metric.sites'), value: '0' }],
    }
  }
  const best = sites[0]
  const worst = sites[sites.length - 1]
  const counted = `${sites.length} ${tr(
    l,
    sites.length === 1 ? 'agent.unit.site.one' : sites.length < 5 ? 'agent.unit.site.few' : 'agent.unit.site.many',
  )}`
  return {
    scenario: 'migration',
    hiveId: null,
    text: tr(l, 'agent.mig.text', {
      counted,
      name: best.name,
      plant: best.honeyPlant.toLowerCase(),
      bloom: best.bloomWindow,
      d: fmtNum(best.distanceKm),
      weather: best.weatherNote.toLowerCase(),
      risk: best.risks ? tr(l, 'agent.mig.risk', { r: best.risks.toLowerCase() }) : '',
      list:
        sites.length > 1
          ? `\n\n${sites
              .slice(1)
              .map(
                (s) =>
                  tr(l, 'agent.mig.item', { name: s.name, score: fmtNum(s.score) }) +
                  (s.verdict === 'avoid' ? tr(l, 'agent.mig.itemAvoid') : ''),
              )
              .join('; ')}.`
          : '',
      worst:
        worst.verdict === 'avoid' && worst.risks
          ? tr(l, 'agent.mig.worst', {
              name: worst.name.replace(/^Донниковое поле \(/, '').replace(/\)$/, ''),
              r: worst.risks.toLowerCase(),
            })
          : '',
    }),
    basis: [
      tr(l, 'agent.basis.gisPlants'),
      tr(l, 'agent.basis.weatherSites'),
      tr(l, 'agent.basis.pestRegistry'),
    ],
    urgency: 'this-week',
    urgencyNote: tr(l, 'agent.note.decideBeforeBloom'),
    metrics: [
      { label: tr(l, 'agent.metric.bestSite'), value: `«${best.name}»` },
      { label: tr(l, 'agent.metric.score'), value: tr(l, 'agent.value.score10', { s: fmtNum(best.score) }) },
      { label: tr(l, 'agent.metric.bloom'), value: best.bloomWindow },
    ],
  }
}

function greetingAnswer(ctx: AgentContext): AgentMessage {
  const l = ctx.lang ?? 'ru'
  const name = ctx.apiaryName ? tr(l, 'agent.inline.apiary', { name: ctx.apiaryName }) : ''
  const withData = ctx.hives.filter((h) => h.series.length > 0).length
  if (ctx.hives.length === 0 || withData === 0) {
    return {
      scenario: 'status',
      hiveId: null,
      text: tr(l, 'agent.greet.nodata.text', { name }),
      basis: [tr(l, 'agent.basis.db')],
      urgency: 'ok',
      urgencyNote: tr(l, 'agent.note.waitingData'),
      metrics: [{ label: tr(l, 'agent.metric.hivesData'), value: tr(l, 'agent.value.outof', { a: 0, b: ctx.hives.length || 0 }) }],
    }
  }
  return {
    scenario: 'status',
    hiveId: null,
    text: tr(l, 'agent.greet.text', {
      name,
      n: ctx.hives.length,
      hives: tr(l, ctx.hives.length === 1 ? 'agent.unit.hive.one' : 'agent.unit.hive.many'),
      weather: ctx.weather ? tr(l, 'agent.greet.withWeather') : '',
      pesticide: ctx.pesticide ? tr(l, 'agent.greet.withPesticide') : '',
    }),
    basis: [
      tr(l, 'agent.basis.telemetry', { a: withData, b: ctx.hives.length }),
      ...(ctx.weather ? [tr(l, 'agent.basis.weatherShort')] : []),
      ...(ctx.pesticide ? [tr(l, 'agent.basis.pestShort')] : []),
      ...(ctx.sites.length ? [tr(l, 'agent.basis.sitesCount', { n: ctx.sites.length })] : []),
    ],
    urgency: 'ok',
    urgencyNote: tr(l, 'agent.note.ready'),
    metrics: [{ label: tr(l, 'agent.metric.hivesData'), value: tr(l, 'agent.value.outof', { a: withData, b: ctx.hives.length }) }],
  }
}

/** Короткая фраза про активные датчики точек на карте (для общих ответов). */
function pointsSummary(ctx: AgentContext): string | null {
  const l = ctx.lang ?? 'ru'
  const pts = (ctx.points ?? []).filter((p) => p.sensor.on && p.sensor.tempC !== null)
  if (!pts.length) return null
  return pts
    .map(
      (p) =>
        tr(l, 'agent.pts.summary', {
          name: p.name,
          count: p.hiveCount,
          t: fmtNum(p.sensor.tempC ?? 0),
          h: fmtNum(p.sensor.humidityPct ?? 0, 0),
          w: fmtNum(p.sensor.weightKg ?? 0),
          n: fmtNum(p.sensor.noiseDb ?? 0, 0),
        }),
    )
    .join('; ')
}

/** Сводка сразу по всем ульям — ответ на общий вопрос о пасеке. */
function allHivesAnswer(ctx: AgentContext): AgentMessage {
  const l = ctx.lang ?? 'ru'
  const withData = ctx.hives.filter((h) => h.series.length > 0).length
  const lines = ctx.hives.map((h) => {
    const st = hiveStatus(h, ctx.hives)
    const w = lastWeight(h)
    const t = lastPoint(h)?.tempInC ?? null
    const hum = lastHumidity(h)
    const parts = [
      w !== null ? tr(l, 'agent.value.kg', { w: fmtNum(w) }) : null,
      t !== null ? tr(l, 'agent.all.tempIn', { t: fmtNum(t) }) : null,
      hum !== null ? tr(l, 'agent.all.hum', { h: fmtNum(hum, 0) }) : !h.humiditySensorOk ? tr(l, 'agent.all.humSilent') : null,
    ].filter(Boolean)
    return tr(l, 'agent.all.line', {
      n: h.id,
      status: tr(l, STATUS_LABEL_KEYS[st.label] ?? 'agent.level.ok'),
      parts: parts.join(', ') || tr(l, 'agent.metric.nodata'),
    })
  })
  const leader = leaderOf(ctx.hives)
  const w0 = ctx.weather?.[0]
  const now = ctx.weatherNow
  const pts = pointsSummary(ctx)
  return {
    scenario: 'status',
    hiveId: null,
    text: tr(l, 'agent.all.text', {
      n: ctx.hives.length,
      lines: lines.join('\n'),
      leader: leader
        ? tr(l, 'agent.all.leader', { n: leader.id, w: fmtSigned(delta30d(leader) ?? 0), period: periodLabel(leader, l) })
        : '',
      weather:
        now || w0
          ? tr(l, 'agent.all.weather', {
              now: now
                ? tr(l, 'agent.all.now', { t: fmtSigned(now.tempC, 0), text: now.text.toLowerCase(), wind: now.windKmh })
                : '',
              today: w0
                ? tr(l, 'agent.all.today', {
                    flight: tr(
                      l,
                      w0.flight === 'good' ? 'agent.all.flightGood' : w0.flight === 'bad' ? 'agent.all.flightBad' : 'agent.all.flightMid',
                    ),
                    min: fmtSigned(w0.tMin, 0),
                    max: fmtSigned(w0.tMax, 0),
                    p: w0.precipProb,
                  })
                : '',
            })
          : '',
      pts: pts ? tr(l, 'agent.all.pts', { pts }) : '',
    }),
    basis: [
      tr(l, 'agent.basis.telemetry', { a: withData, b: ctx.hives.length }),
      ...(ctx.weather ? [tr(l, 'agent.basis.weatherShort')] : []),
      ...(pts ? [tr(l, 'agent.basis.mapSensors')] : []),
    ],
    urgency: 'ok',
    urgencyNote: tr(l, 'agent.note.summaryAll'),
    metrics: [
      { label: tr(l, 'agent.metric.hivesData'), value: tr(l, 'agent.value.outof', { a: withData, b: ctx.hives.length }) },
      ...(leader
        ? [{ label: tr(l, 'agent.metric.leader'), value: tr(l, 'agent.value.leaderGain', { n: leader.id, w: fmtSigned(delta30d(leader) ?? 0) }) }]
        : []),
      ...(now ? [{ label: tr(l, 'agent.metric.weatherNow'), value: tr(l, 'agent.value.tempC', { t: fmtSigned(now.tempC, 0) }) }] : []),
    ],
  }
}

/** Риск роения сразу по всем ульям. */
function swarmAllAnswer(ctx: AgentContext): AgentMessage {
  const l = ctx.lang ?? 'ru'
  const risky = ctx.hives.filter((h) => {
    const d2 = delta2d(h)
    return d2 !== null && d2 <= SWARM_DROP
  })
  if (risky.length) {
    const details = risky.map((h) => {
      const d2 = delta2d(h) ?? 0
      const t = lastPoint(h)?.tempInC ?? null
      return tr(l, 'agent.swarmall.detail', {
        n: h.id,
        w: fmtNum(Math.abs(d2)),
        temp: t !== null ? tr(l, 'agent.swarmall.detailTemp', { t: fmtNum(t) }) : '',
      })
    })
    return {
      scenario: 'swarm',
      hiveId: null,
      text: tr(l, 'agent.swarmall.risk.text', {
        total: ctx.hives.length,
        where: risky.length === 1 ? tr(l, 'agent.swarmall.whereOne') : tr(l, 'agent.swarmall.whereMany', { n: risky.length }),
        ids: risky.map((h) => `№${h.id}`).join(', '),
        details: details.join('.\n'),
      }),
      basis: risky.map((h) => tr(l, 'agent.basis.weightChart', { n: h.id })),
      urgency: 'today',
      urgencyNote: tr(l, 'agent.note.inspectAllToday'),
      probability: swarmProbability(delta2d(risky[0]) ?? SWARM_DROP, l),
      metrics: [
        { label: tr(l, 'agent.metric.hivesRisk'), value: tr(l, 'agent.value.outof', { a: risky.length, b: ctx.hives.length }) },
        { label: tr(l, 'agent.metric.weightDrop'), value: tr(l, 'agent.value.drop2d', { w: fmtNum(Math.abs(delta2d(risky[0]) ?? 0)) }) },
      ],
    }
  }
  const deltas = ctx.hives.map((h) => tr(l, 'agent.item.hiveGain', { n: h.id, w: fmtSigned(delta2d(h) ?? 0) })).join(', ')
  return {
    scenario: 'swarm',
    hiveId: null,
    text: tr(l, 'agent.swarmall.ok.text', { deltas }),
    basis: [tr(l, 'agent.basis.gainCompareAll')],
    urgency: 'ok',
    urgencyNote: tr(l, 'agent.note.observeSignal'),
    probability: tr(l, 'agent.prob.noSwarmSigns'),
    metrics: [{ label: tr(l, 'agent.metric.hivesChecked'), value: String(ctx.hives.length) }],
  }
}

/** Температура сразу по всем ульям + погода снаружи. */
function climateAllAnswer(ctx: AgentContext): AgentMessage {
  const l = ctx.lang ?? 'ru'
  const lines = ctx.hives.map((h) => {
    const t = lastPoint(h)?.tempInC ?? null
    return tr(l, 'agent.climateall.line', {
      n: h.id,
      t: t !== null ? tr(l, 'agent.value.tempC', { t: fmtNum(t) }) : tr(l, 'agent.metric.nodata'),
    })
  })
  const temps = ctx.hives
    .map((h) => lastPoint(h)?.tempInC ?? null)
    .filter((t): t is number => t !== null)
  const maxT = temps.length ? Math.max(...temps) : null
  const overheated = maxT !== null && maxT > 36.0
  const now = ctx.weatherNow
  const w0 = ctx.weather?.[0]
  return {
    scenario: overheated ? 'swarm' : 'status',
    hiveId: null,
    text: tr(l, 'agent.climateall.text', {
      lines: lines.join(', '),
      overheat: overheated && maxT !== null ? tr(l, 'agent.climateall.overheat', { t: fmtNum(maxT) }) : '',
      ok: overheated ? '' : tr(l, 'agent.climateall.ok'),
      outside: now
        ? tr(l, 'agent.climateall.outside', {
            t: fmtSigned(now.tempC, 0),
            text: now.text.toLowerCase(),
            today: w0 ? tr(l, 'agent.climateall.today', { min: fmtSigned(w0.tMin, 0), max: fmtSigned(w0.tMax, 0) }) : '',
          })
        : '',
    }),
    basis: [
      tr(l, 'agent.basis.tempSensorsAll'),
      ...(now ? [tr(l, 'agent.basis.weatherNow')] : []),
      ...(overheated ? [tr(l, 'agent.basis.jointShort')] : []),
    ],
    urgency: overheated ? 'today' : 'ok',
    urgencyNote: overheated ? tr(l, 'agent.note.checkWarmest') : tr(l, 'agent.note.climateOk'),
    probability: overheated ? tr(l, 'agent.prob.joint') : undefined,
    metrics: [
      { label: tr(l, 'agent.metric.maxIn'), value: maxT !== null ? tr(l, 'agent.value.tempC', { t: fmtNum(maxT) }) : tr(l, 'agent.metric.nodata') },
      ...(now ? [{ label: tr(l, 'agent.metric.outside'), value: tr(l, 'agent.value.tempC', { t: fmtSigned(now.tempC, 0) }) }] : []),
      { label: tr(l, 'agent.metric.familyNorm'), value: tr(l, 'agent.value.tempNorm') },
    ],
  }
}

/** Влажность сразу по всем ульям, с честными пропусками по «молчащим» датчикам. */
function humidityAllAnswer(ctx: AgentContext): AgentMessage {
  const l = ctx.lang ?? 'ru'
  const lines = ctx.hives.map((h) => {
    const hum = lastHumidity(h)
    if (hum !== null) return tr(l, 'agent.humall.lineOk', { n: h.id, h: fmtNum(hum, 0) })
    if (!h.humiditySensorOk) {
      return tr(l, 'agent.humall.lineSilent', {
        n: h.id,
        since: h.humidityOfflineFrom ? tr(l, 'agent.inline.since', { date: h.humidityOfflineFrom }) : '',
      })
    }
    return tr(l, 'agent.humall.lineNodata', { n: h.id })
  })
  const wet = ctx.hives.filter((h) => (lastHumidity(h) ?? 0) > 70)
  const pts = (ctx.points ?? []).filter((p) => p.sensor.on && p.sensor.humidityPct !== null)
  return {
    scenario: 'status',
    hiveId: null,
    text: tr(l, 'agent.humall.text', {
      lines: lines.join('\n'),
      wet: wet.length ? tr(l, 'agent.humall.wet', { ids: wet.map((h) => `№${h.id}`).join(', ') }) : '',
      dry: wet.length ? '' : tr(l, 'agent.humall.dryOk'),
      pts: pts.length
        ? tr(l, 'agent.humall.pts', { pts: pts.map((p) => tr(l, 'agent.pts.hum', { name: p.name, h: fmtNum(p.sensor.humidityPct ?? 0, 0) })).join(', ') })
        : '',
    }),
    basis: [
      tr(l, 'agent.basis.humSensors'),
      tr(l, 'agent.basis.normHum'),
      ...(pts.length ? [tr(l, 'agent.basis.mapSensors')] : []),
    ],
    urgency: wet.length ? 'today' : 'ok',
    urgencyNote: wet.length ? tr(l, 'agent.note.ventilation') : tr(l, 'agent.note.observe'),
    metrics: [
      {
        label: tr(l, 'agent.metric.hivesData'),
        value: tr(l, 'agent.value.outof', { a: ctx.hives.filter((h) => lastHumidity(h) !== null).length, b: ctx.hives.length }),
      },
      ...(wet.length ? [{ label: tr(l, 'agent.metric.wetHives'), value: wet.map((h) => `№${h.id}`).join(', ') }] : []),
    ],
  }
}

/** Вес и привес сразу по всем ульям + контрольные датчики на карте. */
function weightAllAnswer(ctx: AgentContext, periodDays?: number | null): AgentMessage {
  const l = ctx.lang ?? 'ru'
  // Произвольный период по всем ульям (п. 7 ТЗ)
  if (periodDays) {
    const rowsP = ctx.hives.map((h) => {
      const w = lastWeight(h)
      const g = weightDelta(h, periodDays)
      return tr(l, 'agent.weightall.rowP', {
        n: h.id,
        w: w !== null ? tr(l, 'agent.value.kg', { w: fmtNum(w) }) : tr(l, 'agent.metric.nodata'),
        g: g !== null ? fmtSigned(g) : tr(l, 'agent.metric.nodata'),
        days: periodDays,
      })
    })
    const leaderP = [...ctx.hives]
      .map((h) => ({ h, g: weightDelta(h, periodDays) }))
      .filter((r): r is { h: Hive; g: number } => r.g !== null)
      .sort((a, b) => b.g - a.g)[0]
    const pts = (ctx.points ?? []).filter((p) => p.sensor.on && p.sensor.weightKg !== null)
    return {
      scenario: 'status',
      hiveId: null,
      text: tr(l, 'agent.weightall.textP', {
        days: periodDays,
        rows: rowsP.join('\n'),
        leader: leaderP
          ? tr(l, 'agent.weightall.leaderP', { n: leaderP.h.id, w: fmtSigned(leaderP.g) })
          : '',
        pts: pts.length
          ? tr(l, 'agent.weightall.pts', { pts: pts.map((p) => tr(l, 'agent.pts.weight', { name: p.name, w: fmtNum(p.sensor.weightKg ?? 0) })).join(', ') })
          : '',
      }),
      basis: [tr(l, 'agent.basis.periodArbitrary', { days: periodDays }), tr(l, 'agent.basis.weightChartsAll')],
      urgency: 'ok',
      urgencyNote: tr(l, 'agent.note.watchGain'),
      metrics: [
        ...(leaderP ? [{ label: tr(l, 'agent.metric.leader'), value: tr(l, 'agent.value.leaderGainP', { n: leaderP.h.id, w: fmtSigned(leaderP.g), days: periodDays }) }] : []),
        {
          label: tr(l, 'agent.metric.hivesWeights'),
          value: tr(l, 'agent.value.outof', { a: ctx.hives.filter((h) => lastWeight(h) !== null).length, b: ctx.hives.length }),
        },
      ],
    }
  }
  const rows = ctx.hives.map((h) => {
    const w = lastWeight(h)
    return tr(l, 'agent.weightall.row', {
      n: h.id,
      w: w !== null ? tr(l, 'agent.value.kg', { w: fmtNum(w) }) : tr(l, 'agent.metric.nodata'),
      g: fmtSigned(delta30d(h) ?? 0),
      period: periodLabel(h, l),
    })
  })
  const leader = leaderOf(ctx.hives)
  const pts = (ctx.points ?? []).filter((p) => p.sensor.on && p.sensor.weightKg !== null)
  return {
    scenario: 'status',
    hiveId: null,
    text: tr(l, 'agent.weightall.text', {
      rows: rows.join('\n'),
      leader: leader
        ? tr(l, 'agent.weightall.leader', { n: leader.id, w: fmtSigned(delta30d(leader) ?? 0), period: periodLabel(leader, l) })
        : '',
      pts: pts.length
        ? tr(l, 'agent.weightall.pts', { pts: pts.map((p) => tr(l, 'agent.pts.weight', { name: p.name, w: fmtNum(p.sensor.weightKg ?? 0) })).join(', ') })
        : '',
    }),
    basis: [tr(l, 'agent.basis.weightChartsAll'), ...(pts.length ? [tr(l, 'agent.basis.mapSensors')] : [])],
    urgency: 'ok',
    urgencyNote: tr(l, 'agent.note.watchGain'),
    metrics: [
      ...(leader ? [{ label: tr(l, 'agent.metric.leader'), value: tr(l, 'agent.value.leaderGain', { n: leader.id, w: fmtSigned(delta30d(leader) ?? 0) }) }] : []),
      {
        label: tr(l, 'agent.metric.hivesWeights'),
        value: tr(l, 'agent.value.outof', { a: ctx.hives.filter((h) => lastWeight(h) !== null).length, b: ctx.hives.length }),
      },
    ],
  }
}

/** Шум по датчикам точек на карте. Нет датчика или он выключен — данных нет. */
function noiseAnswer(ctx: AgentContext): AgentMessage {
  const l = ctx.lang ?? 'ru'
  const pts = (ctx.points ?? []).filter((p) => p.sensor.on && p.sensor.noiseDb !== null)
  if (!pts.length) {
    return {
      scenario: 'status',
      hiveId: null,
      text: tr(l, 'agent.noise.none.text'),
      basis: [tr(l, 'agent.basis.sensorsOff')],
      urgency: 'this-week',
      urgencyNote: tr(l, 'agent.note.enableSensors'),
      probability: tr(l, 'agent.prob.insufficient'),
      metrics: [{ label: tr(l, 'agent.metric.sensorsActive'), value: '0' }],
    }
  }
  const rows = pts.map((p) => tr(l, 'agent.noise.row', { name: p.name, n: fmtNum(p.sensor.noiseDb ?? 0, 0) })).join(', ')
  const loudest = [...pts].sort((a, b) => (b.sensor.noiseDb ?? 0) - (a.sensor.noiseDb ?? 0))[0]
  const loud = (loudest.sensor.noiseDb ?? 0) > 60
  return {
    scenario: 'status',
    hiveId: null,
    text: tr(l, 'agent.noise.text', {
      rows,
      loud: loud ? tr(l, 'agent.noise.loud', { name: loudest.name }) : '',
      calm: loud ? '' : tr(l, 'agent.noise.calm'),
    }),
    basis: [tr(l, 'agent.basis.sensorsCount', { n: pts.length })],
    urgency: loud ? 'today' : 'ok',
    urgencyNote: loud ? tr(l, 'agent.note.inspectNoisy') : tr(l, 'agent.note.noiseOk'),
    metrics: [{ label: tr(l, 'agent.metric.maxNoise'), value: tr(l, 'agent.value.db', { n: fmtNum(loudest.sensor.noiseDb ?? 0, 0) }) }],
  }
}

/** Обзор датчиков: точки на карте (температура, вес, влажность, шум) и датчики ульев. */
function sensorsAnswer(ctx: AgentContext): AgentMessage {
  const l = ctx.lang ?? 'ru'
  const ptLines = (ctx.points ?? []).map((p) =>
    p.sensor.on
      ? tr(l, 'agent.sensors.pt.on', {
          name: p.name,
          count: p.hiveCount,
          t: fmtNum(p.sensor.tempC ?? 0),
          h: fmtNum(p.sensor.humidityPct ?? 0, 0),
          w: fmtNum(p.sensor.weightKg ?? 0),
          n: fmtNum(p.sensor.noiseDb ?? 0, 0),
        })
      : tr(l, 'agent.sensors.pt.off', {
          name: p.name,
          count: p.hiveCount,
          off: p.hasSensor ? tr(l, 'agent.sensors.pt.offDisabled') : tr(l, 'agent.sensors.pt.offMissing'),
        }),
  )
  const hiveLines = ctx.hives.map((h) =>
    h.humiditySensorOk
      ? tr(l, 'agent.sensors.hive.ok', { n: h.id })
      : tr(l, 'agent.sensors.hive.bad', {
          n: h.id,
          since: h.humidityOfflineFrom ? tr(l, 'agent.inline.since', { date: h.humidityOfflineFrom }) : '',
        }),
  )
  return {
    scenario: 'status',
    hiveId: null,
    text: tr(l, 'agent.sensors.text', { lines: [...ptLines, ...hiveLines].join('\n') }),
    basis: [tr(l, 'agent.basis.mapSensors'), tr(l, 'agent.basis.hiveSensors')],
    urgency: 'ok',
    urgencyNote: tr(l, 'agent.note.sensorsAllOk'),
    metrics: [
      {
        label: tr(l, 'agent.metric.pointsSensors'),
        value: tr(l, 'agent.value.outof', { a: (ctx.points ?? []).filter((p) => p.sensor.on).length, b: (ctx.points ?? []).length }),
      },
      { label: tr(l, 'agent.metric.hivesWatch'), value: String(ctx.hives.length) },
    ],
  }
}

/** Вопрос о самом агенте: модель и устройство не раскрываем. */
function identityAnswer(ctx: AgentContext): AgentMessage {
  const l = ctx.lang ?? 'ru'
  return {
    scenario: 'status',
    hiveId: null,
    text: tr(l, 'agent.identity.text'),
    basis: [],
    urgency: 'ok',
    urgencyNote: tr(l, 'agent.note.ready'),
    metrics: [],
  }
}

/* ------------------------------------------------------------------ */
/* Навигация по приложению: «где что находится», «как добавить…»        */
/* ------------------------------------------------------------------ */

/** Темы-разделы приложения: шаблон ответа + название раздела для метрики. */
const GUIDE_TOPICS: Array<{ patterns: RegExp[]; key: string; section: string }> = [
  {
    key: 'camera',
    section: 'Карта пасеки',
    patterns: [/камер/, /видеонаблюден/, /снимок/, /видео/],
  },
  {
    key: 'bind',
    section: 'Карта пасеки',
    patterns: [/привяз/, /добав.{0,10}(улей|ульев|точк|пасек)/, /новый улей/, /код.{0,12}датчик/],
  },
  {
    key: 'sensors',
    section: 'Датчики',
    patterns: [/датчик/, /сенсор/, /шестер[её]нк/, /перенест.{0,10}(улей|точк)/],
  },
  {
    key: 'history',
    section: 'История',
    patterns: [/истори/, /журнал/, /почасов/, /csv|выгрузк/],
  },
  {
    key: 'migration',
    section: 'Кочёвка',
    patterns: [/кочев/, /площадк/, /минсельхоз/, /перенасыщ/, /пол.{1,3}(минсельхоз|га)/],
  },
  {
    key: 'reminders',
    section: 'Напоминания',
    patterns: [/напоминан/, /напоминалк/, /план работ/],
  },
  {
    key: 'data',
    section: 'Данные',
    patterns: [/мои данные/, /профил/, /парол/, /аватар/, /аккаунт/, /email|почт/],
  },
  {
    key: 'map',
    section: 'Карта',
    patterns: [/карт/, /метк/, /погод.{0,16}(карте|точке|точк)/],
  },
  {
    key: 'agent',
    section: 'Агент',
    patterns: [/чат/, /голос|микрофон/, /быстр.{0,8}вопрос/, /переписк/],
  },
]

/**
 * Подсказка по приложению: где что находится и как это сделать (кнопка камер,
 * привязка улья, журнал и т.д.). Плюс краткий перечень данных, которые агент
 * может назвать (п. «ИИ отвечает за приложение» ТЗ).
 */
function guideAnswer(question: string, ctx: AgentContext): AgentMessage {
  const l = ctx.lang ?? 'ru'
  const q = norm(question)
  const topic = GUIDE_TOPICS.find((g) => g.patterns.some((p) => p.test(q))) ?? null
  const dataLine = tr(l, 'agent.guide.dataLine')
  const text = topic
    ? `${tr(l, `agent.guide.${topic.key}`)}\n${dataLine}`
    : tr(l, 'agent.guide.fallback')
  return {
    scenario: 'guide',
    hiveId: null,
    text,
    basis: [tr(l, 'agent.basis.appGuide')],
    urgency: 'ok',
    urgencyNote: tr(l, 'agent.guide.note'),
    metrics: [
      { label: tr(l, 'agent.guide.metricLabel'), value: topic ? topic.section : tr(l, 'agent.guide.metricAll') },
    ],
  }
}

function fallbackAnswer(ctx: AgentContext): AgentMessage {
  const l = ctx.lang ?? 'ru'
  return {
    scenario: 'offtopic',
    hiveId: null,
    text: tr(l, 'agent.fallback.text'),
    basis: [],
    urgency: 'ok',
    urgencyNote: tr(l, 'agent.note.offtopic'),
    metrics: [],
  }
}

/* ------------------------------------------------------------------ */
/* Здоровье пчёл и уход: справочник правилового движка                  */
/* ------------------------------------------------------------------ */

interface CareTopic {
  id: string
  patterns: RegExp[]
  /** Ключ перевода основного текста ответа (словарь i18n-extra-agent). */
  textKey: string
  urgency: Urgency
  /** Ключ перевода предписания. */
  noteKey: string
  /** Ключ перевода вероятностной оценки (если есть). */
  probKey?: string
  /** Метрики: пары ключей «подпись / значение». */
  metrics: Array<{ labelKey: string; valueKey: string }>
  /** Ключи перевода оснований. */
  basisKeys: string[]
}

/** Справочник болезней и сезонного ухода — для ответов без LLM (fallback).
 *  Каждый ответ: признаки → порядок действий → правило о ветслужбе/диагнозе.
 *  Все строки — ключи переводов, собираются в beeCareAnswer по ctx.lang. */
const CARE_TOPICS: CareTopic[] = [
  {
    id: 'foulbrood',
    patterns: [/гнил/, /гнилост/],
    urgency: 'act-now',
    textKey: 'agent.care.foulbrood.text',
    noteKey: 'agent.care.foulbrood.note',
    probKey: 'agent.care.foulbrood.prob',
    metrics: [
      { labelKey: 'agent.care.foulbrood.m1l', valueKey: 'agent.care.foulbrood.m1v' },
      { labelKey: 'agent.care.foulbrood.m2l', valueKey: 'agent.care.foulbrood.m2v' },
      { labelKey: 'agent.care.foulbrood.m3l', valueKey: 'agent.care.foulbrood.m3v' },
    ],
    basisKeys: ['agent.basis.diseases', 'agent.basis.vetRules'],
  },
  {
    id: 'varroa',
    patterns: [/варроа/, /клещ/, /бипин/, /апивар/, /акара/, /щавелев/, /оксал/, /заклещ/],
    urgency: 'today',
    textKey: 'agent.care.varroa.text',
    noteKey: 'agent.care.varroa.note',
    probKey: 'agent.care.varroa.prob',
    metrics: [
      { labelKey: 'agent.care.varroa.m1l', valueKey: 'agent.care.varroa.m1v' },
      { labelKey: 'agent.care.varroa.m2l', valueKey: 'agent.care.varroa.m2v' },
      { labelKey: 'agent.care.varroa.m3l', valueKey: 'agent.care.varroa.m3v' },
    ],
    basisKeys: ['agent.basis.diseases', 'agent.basis.autumnTreatments'],
  },
  {
    id: 'nosema',
    patterns: [/нозем/, /понос/, /испачкан/],
    urgency: 'today',
    textKey: 'agent.care.nosema.text',
    noteKey: 'agent.care.nosema.note',
    metrics: [
      { labelKey: 'agent.care.nosema.m1l', valueKey: 'agent.care.nosema.m1v' },
      { labelKey: 'agent.care.nosema.m2l', valueKey: 'agent.care.nosema.m2v' },
    ],
    basisKeys: ['agent.basis.diseases'],
  },
  {
    id: 'chalkbrood',
    patterns: [/аскосфер/, /известков/, /мумии/, /аспергилл/],
    urgency: 'today',
    textKey: 'agent.care.chalkbrood.text',
    noteKey: 'agent.care.chalkbrood.note',
    metrics: [
      { labelKey: 'agent.care.chalkbrood.m1l', valueKey: 'agent.care.chalkbrood.m1v' },
      { labelKey: 'agent.care.chalkbrood.m2l', valueKey: 'agent.care.chalkbrood.m2v' },
    ],
    basisKeys: ['agent.basis.diseases', 'agent.basis.humTelemetry'],
  },
  {
    id: 'wax-moth',
    patterns: [/восковая моль/, /(^|[^а-я])моль(?![а-я])/, /воск моль/],
    urgency: 'this-week',
    textKey: 'agent.care.wax-moth.text',
    noteKey: 'agent.care.wax-moth.note',
    metrics: [
      { labelKey: 'agent.care.wax-moth.m1l', valueKey: 'agent.care.wax-moth.m1v' },
      { labelKey: 'agent.care.wax-moth.m2l', valueKey: 'agent.care.wax-moth.m2v' },
    ],
    basisKeys: ['agent.basis.combStorage'],
  },
  {
    id: 'queenless',
    patterns: [/осирот/, /нет матк/, /безматоч/, /матка пропал/, /матка потерян/, /матка исчез/, /трутовк/],
    urgency: 'today',
    textKey: 'agent.care.queenless.text',
    noteKey: 'agent.care.queenless.note',
    metrics: [
      { labelKey: 'agent.care.queenless.m1l', valueKey: 'agent.care.queenless.m1v' },
      { labelKey: 'agent.care.queenless.m2l', valueKey: 'agent.care.queenless.m2v' },
    ],
    basisKeys: ['agent.basis.coloniesQueens'],
  },
  {
    id: 'wintering',
    patterns: [/зимов/, /к зиме/, /в зиму/, /весной осматр/, /омшаник/],
    urgency: 'this-week',
    textKey: 'agent.care.wintering.text',
    noteKey: 'agent.care.wintering.note',
    metrics: [
      { labelKey: 'agent.care.wintering.m1l', valueKey: 'agent.care.wintering.m1v' },
      { labelKey: 'agent.care.wintering.m2l', valueKey: 'agent.care.wintering.m2v' },
      { labelKey: 'agent.care.wintering.m3l', valueKey: 'agent.care.wintering.m3v' },
    ],
    basisKeys: ['agent.basis.wintering'],
  },
  {
    id: 'feeding',
    patterns: [/подкорм/, /сироп/, /канди/, /сахарн/, /кормушк/],
    urgency: 'ok',
    textKey: 'agent.care.feeding.text',
    noteKey: 'agent.care.feeding.note',
    metrics: [
      { labelKey: 'agent.care.feeding.m1l', valueKey: 'agent.care.feeding.m1v' },
      { labelKey: 'agent.care.feeding.m2l', valueKey: 'agent.care.feeding.m2v' },
      { labelKey: 'agent.care.feeding.m3l', valueKey: 'agent.care.feeding.m3v' },
    ],
    basisKeys: ['agent.basis.feeding'],
  },
]

/** Общий ответ «пчёлы заболели — что делать», если конкретная болезнь не опознана. */
function sickBeesGeneral(ctx: AgentContext): AgentMessage {
  const l = ctx.lang ?? 'ru'
  return {
    scenario: 'care',
    hiveId: null,
    text: tr(l, 'agent.care.general.text'),
    basis: [tr(l, 'agent.basis.diseases'), tr(l, 'agent.basis.vetRules')],
    urgency: 'today',
    urgencyNote: tr(l, 'agent.care.general.note'),
    probability: tr(l, 'agent.care.general.prob'),
    metrics: [
      { label: tr(l, 'agent.care.general.m1l'), value: tr(l, 'agent.care.general.m1v') },
      { label: tr(l, 'agent.care.general.m2l'), value: tr(l, 'agent.care.general.m2v') },
      { label: tr(l, 'agent.care.general.m3l'), value: tr(l, 'agent.care.general.m3v') },
    ],
  }
}

/** Ответы о здоровье пчёл и уходе: болезни, лечение, подкормки, сезонный уход. */
function beeCareAnswer(question: string, ctx: AgentContext): AgentMessage {
  const l = ctx.lang ?? 'ru'
  const q = norm(question)
  for (const topic of CARE_TOPICS) {
    if (topic.patterns.some((p) => p.test(q))) {
      return {
        scenario: 'care',
        hiveId: null,
        text: tr(l, topic.textKey),
        basis: topic.basisKeys.map((k) => tr(l, k)),
        urgency: topic.urgency,
        urgencyNote: tr(l, topic.noteKey),
        probability: topic.probKey ? tr(l, topic.probKey) : undefined,
        metrics: topic.metrics.map((m) => ({ label: tr(l, m.labelKey), value: tr(l, m.valueKey) })),
      }
    }
  }
  return sickBeesGeneral(ctx)
}

function thanksAnswer(ctx: AgentContext): AgentMessage {
  const l = ctx.lang ?? 'ru'
  return {
    scenario: 'status',
    hiveId: null,
    text: tr(l, 'agent.thanks.text'),
    basis: [],
    urgency: 'ok',
    urgencyNote: tr(l, 'agent.note.observe'),
    metrics: [],
  }
}

/** Главная функция: вопрос пчеловода → структурированный ответ агента. */
export function askAgent(
  question: string,
  currentHiveId: number,
  ctx: AgentContext,
): AgentMessage {
  const q = norm(question)
  const hiveId = extractHiveId(q, ctx)
  const hive = ctx.hives.find((x) => x.id === (hiveId ?? currentHiveId)) ?? ctx.hives[0]

  // Произвольный период привесов: «за 8 дней», «за 2 недели», «за месяц» (п. 7 ТЗ)
  const periodDays = extractPeriodDays(q)

  const has = (...patterns: RegExp[]) => patterns.some((p) => p.test(q))

  // Приветствие и сервисные фразы
  if (has(/привет|здравств|добрый день|добрый вечер|доброе утро|что ты умеешь|чем ты можешь|помощь|справк/)) {
    return greetingAnswer(ctx)
  }
  // Вопрос о самом агенте: модель и устройство не раскрываем
  if (has(/кто ты|кто такой|как тебя зовут|ты бот|чат ?бот|какая (ты )?модель|какой (ты )?модель|на (чем|чём) ты (работаешь|сделан|написан)|что ты за|нейросет|искусственн|\bllm\b|\bgpt\b/)) {
    return identityAnswer(ctx)
  }
  if (has(/спасибо|благодар|класс|супер|отлично/)) {
    return thanksAnswer(ctx)
  }

  // Здоровье пчёл и уход: болезни, лечение, профилактика, подкормки, сезонный уход.
  // Ветка стоит ДО пестицидов: «обработать от клеща» — про лечение пчёл, а не про поле.
  if (
    has(
      /боле[етн]|болезн|заболел|недуг|варроа|клещ|нозем|аскосфер|известков|мумии|гнил|восковая моль|(^|[^а-я])моль(?![а-я])|лечен|лечит|вылеч|бипин|апивар|акара|щавелев|оксал|заклещ|полоск|подкорм|сироп|канди|сахарн|кормушк|ветеринар|ветврач|ветстанц|ветслужб|ветлабор|дезинфекц|осирот|нет матк|безматоч|матка пропал|матка потерян|матка исчез|трутовк|понос|испачкан|зим(ов|н)|к зиме|в зиму|омшаник|пчел.{0,14}(умира|погиб|гибнут)/,
    )
  ) {
    return beeCareAnswer(question, ctx)
  }

  // Навигация по приложению: «где что находится», «как добавить/исправить камеру» —
  // стоит ДО тематических веток, иначе «где посмотреть обработки» уйдёт в пестициды,
  // а «где посмотреть кочёвку» — в миграцию.
  if (
    has(
      /где .{0,32}(находится|находиться|посмотреть|найти|искать|кнопк|вкладк|раздел|список|панел)/,
      /(как|где|можно ли) (добавить|привязать|удалить|убрать|изменить|поменять|отредактировать|исправить|переименовать|включить|выключить|перенести|переставить|настроить|посмотреть)/,
      /(раздел|вкладк|кнопк|меню|панел|интерфейс|приложени|программ|сайт).{0,32}(где|как|что)/,
      /как пользоваться|как работает (приложение|программа|сайт|чат|агент|раздел)|где что находится/,
    )
  ) {
    return guideAnswer(question, ctx)
  }

  // Сценарий пестицидов
  if (has(/пестицид|обработк|хими|опрыск|травят|фунгицид|инсектицид/)) {
    return pesticideAnswer(ctx)
  }

  // Поля Минсельхоза: сколько семей вывозить, цветение от даты посева,
  // перенасыщение, распределение (п. 4 ТЗ) — ДО ветки «кочёвка».
  // сем[еья] покрывает «семей/семьи/семью/семьях» — «сколько семьи вывезть».
  if (
    has(/минсельхоз|посевн|дата посева|посев|сколько сем[еья]|сем[еья].{0,12}(вывоз|вывез|поле|га)|сем[еья] на поле|перенасыщ|распределе|два сорта|медопродуктив|норматив|рыбновск|ниин/)
  ) {
    return cropFieldsAnswer(ctx)
  }

  // Кочёвка (включая «когда вывозить» и «куда везти пасеку к цветению»)
  if (has(/кочев|перевез|перевоз|переех|перемест|везти|вывоз|вывезти|новое место|куда (вывезти|ехать|ставить|везти)|где лучше|выбор места|участк/)) {
    return migrationAnswer(ctx)
  }

  // Календарь цветения медоносов (п. 3 ТЗ): сроки и окна цветения, конкретный
  // медонос («когда цветёт липа») — ДО ветки погоды: это не вопрос о лёте.
  if (has(/календар|цветен|цветет|цветут|зацвет|окно цвет|сроки цвет|медонос/)) {
    return bloomCalendarAnswer(question, ctx)
  }

  // Погода и медосбор (включая температуру ВОЗДЕУХА — не путать с температурой улья)
  if (has(/погод|медосбор|взятк|летат|лёт|лету|дожд|ветер|осадк|снег|мороз|когда летать|температура (воздуха|за окном|на улице|снаружи)/)) {
    return weatherAnswer(ctx)
  }

  if (!hive) {
    return fallbackAnswer(ctx)
  }

  // Темы по ульям: если номер улья не назван — отвечаем сразу по ВСЕМ ульям
  if (has(/влажн|сырост|сыро/)) {
    return hiveId ? humidityAnswer(hive, ctx) : humidityAllAnswer(ctx)
  }
  if (has(/шум|децибел|гул(?![а-я])/)) {
    return noiseAnswer(ctx)
  }
  if (has(/ро(ение|иться|й|и(?![а-я]))|риск роения|делит|делени/)) {
    return hiveId ? swarmAnswer(hive, ctx) : swarmAllAnswer(ctx)
  }
  if (has(/температ|жар|тепло внутри|градус/)) {
    return hiveId ? climateAnswer(hive, ctx) : climateAllAnswer(ctx)
  }
  if (has(/вес|мед(?![а-я])|меда|привес|набор|тяже|лидер/)) {
    return hiveId ? weightAnswer(hive, ctx, periodDays) : weightAllAnswer(ctx, periodDays)
  }
  if (has(/датчик|сенсор/)) {
    return sensorsAnswer(ctx)
  }
  if (has(/все.{0,8}уль|всех ульев|всей пасек|пасек|обзор|сводк|итог|общее состояни|как дела|как себя|что происходит|состояни|статус|проверь|проблем|тревог|расскажи|что с улеем|как улей/)) {
    return hiveId ? statusAnswer(hive, ctx) : allHivesAnswer(ctx)
  }

  // Номер улья без распознанной темы — считаем вопросом «что происходит»
  if (hiveId !== null) {
    return statusAnswer(hive, ctx)
  }

  return fallbackAnswer(ctx)
}

/** Быстрые вопросы для чата — ключи переводов (тексты — в i18n-extra-agent). */
export const QUICK_QUESTIONS = [
  'agent.qq.0',
  'agent.qq.1',
  'agent.qq.2',
  'agent.qq.3',
  'agent.qq.4',
  'agent.qq.5',
  'agent.qq.6',
  'agent.qq.7',
]
