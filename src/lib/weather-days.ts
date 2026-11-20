/**
 * Мост между прогнозом Open-Meteo (/api/weather) и контекстом ИИ-агента:
 * WeatherResponse → WeatherDay[] (окна лёта) + сводка «погода сейчас».
 * Используется и на сервере (маршрут агента), и на клиенте (фолбэк-движок).
 */
import type { WeatherResponse, WeatherIconKind } from './api-types'
import type { FlightWindow, WeatherDay, WeatherIcon } from './hive-model'

/** Сводка «погода сейчас» для контекста агента. */
export interface AgentWeatherNow {
  tempC: number
  feelsC: number
  humidityPct: number
  windKmh: number
  pressureMm: number
  text: string
  source: 'open-meteo' | 'offline'
}

function iconToAgent(kind: WeatherIconKind): WeatherIcon {
  return kind === 'sun' ? 'sun' : kind === 'sun-cloud' ? 'sun-cloud' : kind === 'cloud' ? 'cloud' : 'rain'
}

/** Окно лёта пчёл: тепло, тихо и без осадков — хорошо; дождь/сильный ветер — плохо. */
function flightOf(tMax: number, windMs: number, precipProb: number): FlightWindow {
  if (precipProb >= 55 || windMs > 10) return 'bad'
  if (tMax >= 18 && tMax <= 32 && windMs <= 6 && precipProb < 40) return 'good'
  return 'fair'
}

export function weatherResponseToDays(resp: WeatherResponse): {
  days: WeatherDay[]
  now: AgentWeatherNow
} {
  const days: WeatherDay[] = resp.days.map((d) => {
    const windMs = Math.round((d.windMaxKmh / 3.6) * 10) / 10
    return {
      date: d.date,
      weekday: d.weekday,
      full: d.dayLabel,
      icon: iconToAgent(d.icon),
      tMax: d.tMax,
      tMin: d.tMin,
      windMs,
      precipProb: d.precipProb,
      flight: flightOf(d.tMax, windMs, d.precipProb),
    }
  })
  return {
    days,
    now: {
      tempC: resp.now.tempC,
      feelsC: resp.now.feelsC,
      humidityPct: resp.now.humidityPct,
      windKmh: resp.now.windKmh,
      pressureMm: resp.now.pressureMm,
      text: resp.now.text,
      source: resp.source,
    },
  }
}
