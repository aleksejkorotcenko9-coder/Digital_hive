'use client'

/**
 * Клиентский слой реального режима: маппинг DTO из /api/data в структуры
 * приложения (Hive / MigrationSite) и контекст для ИИ-агента.
 */
import { useEffect } from 'react'
import { makeContext, type AgentContext } from './agent'
import type { ApiData, ApiHive, SiteDto, SafeUser } from './api-types'
import { weightDeltaOver, type DayPoint, type Hive, type MigrationSite, type WeatherDay } from './hive-model'
import type { AgentWeatherNow } from './weather-days'
import { useAppState } from './store'

/** Улей из базы → структура, с которой работают графики, статус и агент. */
export function apiHiveToHive(h: ApiHive): Hive {
  return {
    id: h.number,
    label: h.name,
    familyNote: h.familyNote,
    humiditySensorOk: h.humiditySensorOk,
    humidityOfflineFrom: h.humidityOfflineFrom,
    series: h.series,
  }
}

/** Детерминированные позиции на стилизованной карте (у реальных площадок их нет). */
const SITE_POS: Array<{ x: number; y: number }> = [
  { x: 0.78, y: 0.3 },
  { x: 0.3, y: 0.62 },
  { x: 0.16, y: 0.22 },
  { x: 0.62, y: 0.78 },
  { x: 0.85, y: 0.58 },
  { x: 0.42, y: 0.18 },
]

const SITE_LETTERS = 'ABCDEF'

export function siteDtoToSite(s: SiteDto, index: number): MigrationSite {
  const pos = SITE_POS[index % SITE_POS.length]
  return {
    id: SITE_LETTERS[index % SITE_LETTERS.length] + String(index),
    name: s.name,
    distanceKm: s.distanceKm,
    honeyPlant: s.honeyPlant || '—',
    bloomWindow: s.bloomWindow || '—',
    weatherNote: s.weatherNote || '—',
    risks: s.risks,
    score: s.score,
    verdict: (s.verdict === 'recommend' || s.verdict === 'avoid' ? s.verdict : 'backup') as MigrationSite['verdict'],
    map: pos,
  }
}

/** Контекст агента из реальных данных. Погода (Open-Meteo) и сводка «сейчас»
 *  подставляются вызывающим кодом; если их нет — агент честно скажет об этом. */
export function buildRealContext(
  data: ApiData,
  weather: WeatherDay[] | null = null,
  weatherNow: AgentWeatherNow | null = null,
): AgentContext {
  return makeContext(data.hives.map(apiHiveToHive), {
    weather,
    weatherNow,
    sites: data.sites.map(siteDtoToSite),
    apiaryName: 'Моя пасека',
  })
}

/** Последнее значение веса (для KPI с прочерком). */
export function lastWeightOrNull(h: Hive): number | null {
  return h.series.length ? h.series[h.series.length - 1].weightKg : null
}

/** Безопасное к пропускам изменение веса за back дней (календарный поиск). */
export function weightDeltaSafe(h: Hive, back = 2): number | null {
  return weightDeltaOver(h, back)
}

/** Подпись периода для KPI: «за месяц» или честное «за N дн.» */
export function periodCaption(h: Hive): string {
  if (h.series.length < 2) return 'данных мало'
  const a = new Date(h.series[0].date).getTime()
  const b = new Date(h.series[h.series.length - 1].date).getTime()
  const days = Math.round((b - a) / 86400000) + 1
  return days >= 25 ? 'за месяц' : `за ${days} дн.`
}

export type { ApiData, ApiHive, SiteDto, SafeUser, DayPoint }

/** Хук реальных данных: подтягивает /api/data для вошедшего пользователя. */
export function useRealData(): {
  status: 'idle' | 'loading' | 'ready' | 'error'
  data: ApiData | null
  reload: () => void
} {
  const status = useAppState((s) => s.realStatus)
  const data = useAppState((s) => s.real)
  const user = useAppState((s) => s.user)

  useEffect(() => {
    if (user && (status === 'idle' || status === 'error')) {
      void useAppState.getState().loadReal()
    }
  }, [user, status])

  return { status, data, reload: () => void useAppState.getState().loadReal() }
}
