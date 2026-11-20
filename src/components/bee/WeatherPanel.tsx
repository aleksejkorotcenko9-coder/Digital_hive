'use client'

/**
 * Панель погоды как на референсе: карточка «Погода на пасеке» (текущая
 * температура, описание, ощущается как, ветер/влажность/давление) и список
 * «Погода на 10 дней» (день/ночь, ветер, осадки).
 * Данные — реальный метеосервис из интернета через /api/weather; если сервис
 * недоступен, панель честно помечает прогноз как приблизительный (source:
 * 'offline') — название источника в интерфейсе не показывается.
 * coords/place — координаты пасеки: в демо — город из профиля (меняется на
 * карте), в реальном режиме — точка, где стоят датчики.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Cloudy,
  Droplets,
  Flower2,
  Gauge,
  RefreshCcw,
  Wind,
} from 'lucide-react'
import type { WeatherResponse } from '@/lib/api-types'
import { nearestBloom } from '@/lib/demo-hives'
import { useAppState } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { WeatherGlyph } from './weather-glyph'

export function WeatherPanel({
  compact = false,
  coords,
  place,
}: {
  compact?: boolean
  /** Координаты пасеки: прогноз именно там, где стоят ульи. */
  coords?: [number, number]
  /** Название места для подписи в карточке (например «Стерлитамак»). */
  place?: string
}) {
  const t = useT()
  const lang = useAppState((s) => s.lang)
  const [data, setData] = useState<WeatherResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const url = useMemo(() => {
    const sp = new URLSearchParams()
    if (coords) {
      sp.set('lat', coords[0].toFixed(4))
      sp.set('lon', coords[1].toFixed(4))
    }
    if (place) sp.set('place', place)
    const qs = sp.toString()
    return '/api/weather' + (qs ? `?${qs}` : '')
  }, [coords?.[0], coords?.[1], place])

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData((await res.json()) as WeatherResponse)
    } catch {
      setError(t('dash.weather.error'))
    }
  }, [url, t])

  useEffect(() => {
    void load()
    const timer = setInterval(() => void load(), 15 * 60 * 1000)
    return () => clearInterval(timer)
  }, [load])

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-white p-4 text-sm text-gray-500 shadow-sm dark:bg-[#221814]">
        <p>{error}</p>
        <button
          onClick={() => void load()}
          className="mt-2 inline-flex items-center gap-1.5 font-bold text-red-600 hover:text-red-700"
        >
          <RefreshCcw className="h-3.5 w-3.5" /> {t('dash.weather.refresh')}
        </button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-3">
        <div className="h-44 animate-pulse rounded-2xl bg-red-50/70" />
        <div className="h-72 animate-pulse rounded-2xl bg-red-50/50" />
      </div>
    )
  }

  const offlineNote =
    data.source === 'offline'
      ? t('dash.weather.offline')
      : t('dash.weather.updated', { t: new Date(data.updatedAt).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' }) })

  return (
    <div className="space-y-3">
      {/* Текущая погода */}
      <section className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm md:p-5 dark:bg-[#221814]">
        <h2 className="text-sm font-bold text-[#2A1A12]">{t('dash.weather.title')}</h2>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-5xl font-extrabold tracking-tight text-[#2A1A12]">
              {Math.round(data.now.tempC)}°
            </span>
            <div className="text-xs leading-snug text-gray-500">
              <p className="font-semibold text-gray-700">{data.now.text}</p>
              <p>{t('dash.weather.feels', { n: Math.round(data.now.feelsC) })}</p>
              <p className="mt-1 text-[11px] text-gray-400">{data.place} · {offlineNote}</p>
            </div>
          </div>
          <WeatherGlyph kind={data.now.icon} className="float-y h-10 w-10" />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2.5 rounded-xl bg-red-50 px-3 py-2.5 dark:bg-[#2C211C]">
            <Wind className="h-4.5 w-4.5 text-red-400" />
            <div className="text-xs leading-tight">
              <p className="font-bold text-gray-800">{data.now.windKmh} {t('weather.kmH')}</p>
              <p className="text-gray-400">{t('dash.weather.wind')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl bg-red-50 px-3 py-2.5 dark:bg-[#2C211C]">
            <Droplets className="h-4.5 w-4.5 text-red-400" />
            <div className="text-xs leading-tight">
              <p className="font-bold text-gray-800">{data.now.humidityPct}%</p>
              <p className="text-gray-400">{t('dash.weather.humidity')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl bg-red-50 px-3 py-2.5 dark:bg-[#2C211C]">
            <Gauge className="h-4.5 w-4.5 text-red-400" />
            <div className="text-xs leading-tight">
              <p className="font-bold text-gray-800">{data.now.pressureMm}</p>
              <p className="text-gray-400">{t('dash.weather.pressure')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl bg-red-50 px-3 py-2.5 dark:bg-[#2C211C]">
            <Cloudy className="h-4.5 w-4.5 text-red-400" />
            <div className="text-xs leading-tight">
              <p className="font-bold text-gray-800">{data.days[0]?.precipProb ?? 0}%</p>
              <p className="text-gray-400">{t('dash.weather.precip')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Прогноз на 10 дней */}
      {!compact && (
        <section className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm md:p-5 dark:bg-[#221814]">
          <h2 className="text-sm font-bold text-[#2A1A12]">{t('dash.weather.days10')}</h2>
          <ul className="mt-2 divide-y divide-red-50">
            {data.days.map((d, i) => (
              <li key={d.date} className="hover-wiggle flex items-center gap-3 py-2.5">
                <div className="w-[86px] shrink-0 leading-tight">
                  <p className="text-xs font-bold text-gray-800">
                    {i === 0 ? t('dash.weather.today') : i === 1 ? t('dash.weather.tomorrow') : d.date.slice(8) + ' ' + d.weekday}
                  </p>
                  <p className="text-[11px] text-gray-400">{i > 1 ? d.dayLabel : d.weekday}</p>
                </div>
                <WeatherGlyph kind={d.icon} className="h-5 w-5 shrink-0 hover-wiggle-target" />
                {d.precipProb >= 30 ? (
                  <span className="shrink-0 text-[11px] font-semibold text-red-400">{d.precipProb}%</span>
                ) : (
                  <span className="w-[30px] shrink-0" />
                )}
                <span className="ml-auto shrink-0 text-[11px] text-gray-400">
                  {t('dash.weather.day')} <span className="font-bold text-gray-800">{d.tMax > 0 ? `+${d.tMax}°` : `${d.tMax}°`}</span>
                </span>
                <span className="w-[58px] shrink-0 text-right text-xs text-gray-500">
                  {t('dash.weather.night')} <span className="font-bold text-gray-700">{d.tMin > 0 ? `+${d.tMin}°` : `${d.tMin}°`}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/**
 * Компактный погодный виджет для шапки дашборда: температура, влажность,
 * ветер (м/с) и прогноз цветения ближайшего медоноса — как на референсе
 * «🌤 +26°C | Влажн. 52% | Ветер 2 м/с | Прогноз цветения липы: ~4 дня».
 */
export function WeatherChip({ coords, place }: { coords: [number, number]; place?: string }) {
  const t = useT()
  const [data, setData] = useState<WeatherResponse | null>(null)

  const url = useMemo(() => {
    const sp = new URLSearchParams()
    sp.set('lat', coords[0].toFixed(4))
    sp.set('lon', coords[1].toFixed(4))
    if (place) sp.set('place', place)
    return '/api/weather?' + sp.toString()
  }, [coords[0], coords[1], place])

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const res = await fetch(url, { cache: 'no-store' })
        if (!res.ok) return
        const j = (await res.json()) as WeatherResponse
        if (alive) setData(j)
      } catch {
        // тихо: чип просто появится, когда погода загрузится
      }
    }
    void load()
    const timer = setInterval(() => void load(), 15 * 60 * 1000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [url])

  const bloom = nearestBloom()

  if (!data) {
    return (
      <div className="inline-flex h-9 items-center gap-2 rounded-full border border-red-100 bg-white px-3 text-xs font-semibold text-gray-300 shadow-sm dark:bg-[#221814]">
        <span className="h-2 w-2 animate-pulse rounded-full bg-red-200" />
        …
      </div>
    )
  }

  const windMs = Math.round((data.now.windKmh / 3.6) * 10) / 10
  const temp = Math.round(data.now.tempC)

  return (
    <div
      title={`${data.place} · ${t('dash.weather.title')}`}
      className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-red-100 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 shadow-sm dark:bg-[#221814]"
    >
      <WeatherGlyph kind={data.now.icon} className="h-5 w-5 shrink-0" />
      <span className="font-extrabold text-[#2A1A12]">{temp > 0 ? `+${temp}` : temp}°C</span>
      <span className="text-red-200">|</span>
      <span className="inline-flex items-center gap-1">
        <Droplets className="h-3.5 w-3.5 text-red-400" />
        {t('dash.weather.humidity')} <b className="text-gray-800">{data.now.humidityPct}%</b>
      </span>
      <span className="hidden text-red-200 sm:inline">|</span>
      <span className="hidden items-center gap-1 sm:inline-flex">
        <Wind className="h-3.5 w-3.5 text-red-400" />
        {t('dash.weather.wind')} <b className="text-gray-800">{windMs}</b> {t('common.windMs')}
      </span>
      <span className="text-red-200">|</span>
      <span className="inline-flex items-center gap-1 text-amber-700">
        <Flower2 className="h-3.5 w-3.5 text-amber-500" />
        {bloom.paused ? t('dash.weather.bloomPaused') : t('dash.weather.bloom', { name: bloom.name, n: bloom.daysLeft })}
      </span>
    </div>
  )
}
