/**
 * Общие типы обмена между API-маршрутами и клиентом.
 * Файл без 'use client' — безопасно импортировать и на сервере, и на клиенте.
 * DayPoint / WeatherDay / PesticideAlert / MigrationSite переиспользуются из hive-model.
 */
import type { DayPoint } from './hive-model'

export type Role = 'BEEKEEPER' | 'HELPER'

export interface SafeUser {
  id: string
  name: string
  displayName: string | null
  avatar: string | null
  role: Role
}

/** Имя для показа в интерфейсе: displayName или логин. */
export function userLabel(u: Pick<SafeUser, 'name' | 'displayName'>): string {
  return (u.displayName ?? '').trim() || u.name
}

/** Улей в реальном режиме: суточные точки телеметрии уже собраны на сервере. */
export interface ApiHive {
  id: string
  number: number
  name: string
  familyNote: string
  series: DayPoint[]
  humiditySensorOk: boolean
  humidityOfflineFrom: string | null
  readingCount: number
  lastTs: string | null
}

export interface SiteDto {
  id: string
  name: string
  honeyPlant: string
  bloomWindow: string
  distanceKm: number
  weatherNote: string
  risks: string
  score: number
  verdict: string
}

export interface EventDto {
  id: string
  hiveNumber: number
  hiveName: string
  ts: string
  type: string
  note: string
  authorName: string
}

export interface ChatHistoryItem {
  id: string
  role: 'user' | 'agent'
  text: string
  agentJson: string | null
  createdAt: string
}

export interface ApiData {
  user: SafeUser
  hives: ApiHive[]
  sites: SiteDto[]
  events: EventDto[]
  apiKey: string | null
  counts: {
    measurements: number
    events: number
  }
}

/* ------------------------------------------------------------------ */
/* Напоминания                                                         */
/* ------------------------------------------------------------------ */

export interface ReminderDto {
  id: string
  text: string
  remindAt: string // ISO
  /** Заметка без времени — «в течение дня» (оповещение в 09:00). */
  allDay: boolean
  done: boolean
  notifiedAt: string | null
  hiveNumber: number | null
  hiveName: string | null
}

/* ------------------------------------------------------------------ */
/* Точки пасеки на карте и датчики ульев                                */
/* ------------------------------------------------------------------ */

/** Показания датчика улья; без датчика или при выключенном — данных нет. */
export interface SensorReading {
  on: boolean
  reason: 'active' | 'off' | 'none'
  tempC: number | null
  humidityPct: number | null
  weightKg: number | null
  noiseDb: number | null
  updatedAt: string
}

export interface MapPointDto {
  id: string
  name: string
  lat: number
  lon: number
  hiveCount: number
  /** Номер улья на корпусе — «Улей №ХХХ» в интерфейсе (жёсткая привязка датчика). */
  hiveNumber: number | null
  hasSensor: boolean
  sensorOn: boolean
  /** Код датчика на корпусе, по которому привязан улей. */
  sensorCode: string | null
  /** contact — контактный | ir — инфракрасный. */
  sensorKind: 'contact' | 'ir'
  /** center — центр гнезда | periphery — периферия клуба/расплода. */
  sensorPlacement: 'center' | 'periphery'
  /** URL снимка/потока камеры наблюдения на точке. */
  cameraUrl: string | null
  sensor: SensorReading
}

/** Датчик из каталога: код на корпусе и GPS-позиция, которую он передаёт. */
export interface SensorCatalogItem {
  code: string
  model: string
  lat: number
  lon: number
  note: string
  /** field — пасека в поле подальше от города; city — ближе к городу;
   *  sterlitamak — собственная пасека в Стерлитамаке (режим «Мои данные»). */
  zone: 'field' | 'city' | 'sterlitamak'
}

/** Ответ GET /api/map-points: точки пользователя + каталог датчиков. */
export interface MapPointsResponse {
  points: MapPointDto[]
  catalog: SensorCatalogItem[]
}

/* ------------------------------------------------------------------ */
/* Погода (Open-Meteo)                                                 */
/* ------------------------------------------------------------------ */

export type WeatherIconKind = 'sun' | 'sun-cloud' | 'cloud' | 'rain' | 'snow' | 'storm'

export interface WeatherNow {
  tempC: number
  feelsC: number
  humidityPct: number
  windKmh: number
  pressureMm: number // мм рт. ст.
  icon: WeatherIconKind
  text: string // «Пасмурно, небольшой дождь»
}

export interface WeatherForecastDay {
  date: string // yyyy-MM-dd
  weekday: string // «ср»
  dayLabel: string // «Сегодня» / «Завтра» / «10 ноября»
  tMax: number
  tMin: number
  precipProb: number
  windMaxKmh: number
  icon: WeatherIconKind
}

export interface WeatherResponse {
  source: 'open-meteo' | 'offline'
  place: string
  updatedAt: string
  now: WeatherNow
  days: WeatherForecastDay[]
}

/* ------------------------------------------------------------------ */
/* История событий: почасовой журнал датчиков                          */
/* ------------------------------------------------------------------ */

/** Улей с журналом показаний. */
export interface HistoryPointDto {
  id: string
  name: string
}

/** Пасека для каскадного выбора «пасека → улей»: место, где ульи стоят рядом. */
export interface HistoryGroupDto {
  id: string
  name: string
  /** Идентификаторы ульев этой пасеки. */
  pointIds: string[]
}

/** Доступный диапазон журнала (ключи UTC-дат yyyy-MM-dd). */
export interface HistoryRangeDto {
  from: string
  to: string
}

/** Одна почасовая запись датчика (scope=day). */
export interface HistoryLogDto {
  pointId: string
  recordedAt: string // ISO (UTC)
  weightKg: number
  tempC: number
  humidityPct: number
  /** Тревожное событие: перегрев, переохлаждение, сырость/сухость, падение веса. */
  alarm: boolean
}

/** Сводка по одному улью за день (scope=month; строки таблицы при наведении). */
export interface HistoryDayPointDto {
  pointId: string
  avgTempC: number
  minTempC: number
  maxTempC: number
  avgHumidityPct: number
  minHumidityPct: number
  maxHumidityPct: number
  startWeightKg: number
  endWeightKg: number
  deltaWeightKg: number
  logs: number
  alarms: number
}

export interface HistoryDaySummaryDto {
  date: string // yyyy-MM-dd
  perPoint: HistoryDayPointDto[]
}

/** Сводка по одному улью за месяц (scope=year). */
export interface HistoryMonthPointDto {
  pointId: string
  avgTempC: number
  avgHumidityPct: number
  deltaWeightKg: number
  logs: number
  alarms: number
}

export interface HistoryMonthSummaryDto {
  month: string // yyyy-MM
  perPoint: HistoryMonthPointDto[]
}

export type HistoryScope = 'day' | 'month' | 'year'

/** Один вывод ИИ-анализа журнала за период. */
export interface HistoryInsightDto {
  id: string
  severity: 'danger' | 'warn' | 'ok'
  title: string
  /** Что не так — с цифрами из журнала. */
  problem: string
  /** Как исправить — кратко и по делу. */
  fix: string
  metrics: { label: string; value: string }[]
  /** Улей, к которому относится вывод; null — вся пасека. */
  pointName: string | null
}

/** Ответ GET /api/history/ai — ИИ-анализ выбранного периода журнала. */
export interface HistoryAiResponse {
  scope: HistoryScope
  date: string
  /** Улей, по которому сделан анализ; null — вся пасека. */
  pointName: string | null
  findings: HistoryInsightDto[]
}

/** Ответ GET /api/history — данные выбранного периода. */
export interface HistoryResponse {
  scope: HistoryScope
  /** Выбранный период: yyyy-MM-dd (день), yyyy-MM (месяц) или yyyy (год). */
  date: string
  points: HistoryPointDto[]
  /** Пасеки для каскадного выбора: группа точек, стоящих рядом. */
  groups: HistoryGroupDto[]
  range: HistoryRangeDto
  /** scope=day: все почасовые записи дня. */
  logs: HistoryLogDto[] | null
  /** scope=month: сводка по дням месяца. */
  days: HistoryDaySummaryDto[] | null
  /** scope=year: сводка по месяцам года. */
  months: HistoryMonthSummaryDto[] | null
}
