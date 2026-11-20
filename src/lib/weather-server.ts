/**
 * Погода на сервере: Open-Meteo (без ключа), кэш 10 минут в памяти.
 * Один источник и для /api/weather (панель погоды), и для контекста
 * ИИ-агента — чтобы агент отвечал теми же цифрами, что на экране.
 * Если метеосервис недоступен — честный офлайн-фолбэк:
 * детерминированный приблизительный прогноз с пометкой source: 'offline'.
 */
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { WeatherForecastDay, WeatherIconKind, WeatherResponse } from './api-types'

export const DEFAULT_LAT = 54.75
export const DEFAULT_LON = 56.03
export const DEFAULT_PLACE = 'Уфа'

const TTL_MS = 10 * 60 * 1000

interface CacheEntry {
  ts: number
  data: WeatherResponse
}

const cacheByKey = new Map<string, CacheEntry>()

function coordsKey(lat: number, lon: number): string {
  return `${Math.round(lat * 4) / 4},${Math.round(lon * 4) / 4}`
}

export function placeLabel(lat: number, lon: number): string {
  return `${lat.toFixed(3)}° с.ш., ${lon.toFixed(3)}° в.д.`
}

const ICON_BY_CODE: Array<[RegExp, WeatherIconKind]> = [
  [/^9[5-9]$/, 'storm'],
  [/^(6[1-7]|5[1-7]|8[0-2])$/, 'rain'],
  [/^(7[1-7]|8[5-6])$/, 'snow'],
  [/^3$/, 'cloud'],
  [/^(45|48)$/, 'cloud'],
  [/^[12]$/, 'sun-cloud'],
  [/^0$/, 'sun'],
]

function iconOf(code: number): WeatherIconKind {
  const s = String(code)
  for (const [re, icon] of ICON_BY_CODE) {
    if (re.test(s)) return icon
  }
  return 'cloud'
}

const TEXT_BY_CODE: Record<number, string> = {
  0: 'Ясно',
  1: 'Преимущественно ясно',
  2: 'Переменная облачность',
  3: 'Пасмурно',
  45: 'Туман',
  48: 'Изморозь, туман',
  51: 'Морось слабая',
  53: 'Морось',
  55: 'Морось сильная',
  56: 'Морось ледяная',
  57: 'Морось ледяная, сильная',
  61: 'Небольшой дождь',
  63: 'Дождь',
  65: 'Сильный дождь',
  66: 'Дождь ледяной',
  67: 'Дождь ледяной, сильный',
  71: 'Небольшой снег',
  73: 'Снег',
  75: 'Сильный снег',
  77: 'Снежные зёрна',
  80: 'Ливень слабый',
  81: 'Ливень',
  82: 'Ливень сильный',
  85: 'Снежный ливень слабый',
  86: 'Снежный ливень',
  95: 'Гроза',
  96: 'Гроза с градом',
  99: 'Гроза с сильным градом',
}

function textOf(code: number): string {
  return TEXT_BY_CODE[code] ?? 'Облачно'
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/* ------------------------------------------------------------------ */
/* Офлайн-фолбэк: детерминированный «приблизительный» прогноз          */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function offlineForecast(place: string): WeatherResponse {
  const now = new Date()
  const rand = mulberry32(Number(format(now, 'yyyyMMdd')))
  const dayBase = 6 + Math.sin((now.getMonth() / 12) * Math.PI * 2 - Math.PI / 2) * 14
  const nowTemp = Math.round((dayBase + (rand() - 0.5) * 4) * 10) / 10
  const days: WeatherForecastDay[] = []
  for (let i = 0; i < 10; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() + i)
    const r1 = rand()
    const r2 = rand()
    const tMax = Math.round(dayBase + 4 - i * 0.15 + r1 * 5)
    const tMin = Math.round(tMax - 7 - r2 * 4)
    const precipProb = Math.round(r2 * 85)
    const icon: WeatherIconKind =
      i === 3 ? 'rain' : i === 4 ? 'rain' : r1 < 0.35 ? 'sun' : r1 < 0.6 ? 'sun-cloud' : 'cloud'
    days.push({
      date: format(d, 'yyyy-MM-dd'),
      weekday: format(d, 'EEEEEE', { locale: ru }),
      dayLabel:
        i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : format(d, 'd MMMM', { locale: ru }),
      tMax,
      tMin,
      precipProb,
      windMaxKmh: Math.round(8 + rand() * 18),
      icon,
    })
  }
  return {
    source: 'offline',
    place,
    updatedAt: new Date().toISOString(),
    now: {
      tempC: nowTemp,
      feelsC: round1(nowTemp - 2),
      humidityPct: Math.round(55 + rand() * 30),
      windKmh: Math.round(5 + rand() * 15),
      pressureMm: Math.round(738 + rand() * 14),
      icon: days[0].icon,
      text: days[0].icon === 'rain' ? 'Облачно, возможен дождь' : days[0].icon === 'sun' ? 'Ясно' : 'Переменная облачность',
    },
    days,
  }
}

/* ------------------------------------------------------------------ */
/* Основная функция                                                    */
/* ------------------------------------------------------------------ */

/**
 * Прогноз по координатам. Никогда не бросает исключение: при сбое сети
 * возвращает приблизительный офлайн-прогноз с пометкой source: 'offline'.
 */
export async function fetchWeatherFor(lat: number, lon: number, place?: string): Promise<WeatherResponse> {
  const placeName = place ?? placeLabel(lat, lon)
  const key = coordsKey(lat, lon)
  const hit = cacheByKey.get(key)
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.data
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,surface_pressure,weather_code,wind_speed_10m' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max' +
      '&timezone=Europe%2FMoscow&forecast_days=10'
    const res = await fetch(url, { signal: AbortSignal.timeout(7000), cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const j = (await res.json()) as {
      current: {
        temperature_2m: number
        apparent_temperature: number
        relative_humidity_2m: number
        surface_pressure: number
        weather_code: number
        wind_speed_10m: number
      }
      daily: {
        time: string[]
        weather_code: number[]
        temperature_2m_max: number[]
        temperature_2m_min: number[]
        precipitation_probability_max: Array<number | null>
        wind_speed_10m_max: number[]
      }
    }
    const today = format(new Date(), 'yyyy-MM-dd')
    const days: WeatherForecastDay[] = j.daily.time.map((t, i) => {
      const d = new Date(t + 'T12:00:00')
      return {
        date: t,
        weekday: format(d, 'EEEEEE', { locale: ru }),
        dayLabel:
          t === today
            ? 'Сегодня'
            : t === j.daily.time[1]
              ? 'Завтра'
              : format(d, 'd MMMM', { locale: ru }),
        tMax: Math.round(j.daily.temperature_2m_max[i]),
        tMin: Math.round(j.daily.temperature_2m_min[i]),
        precipProb: j.daily.precipitation_probability_max[i] ?? 0,
        windMaxKmh: Math.round(j.daily.wind_speed_10m_max[i]),
        icon: iconOf(j.daily.weather_code[i]),
      }
    })
    const data: WeatherResponse = {
      source: 'open-meteo',
      place: placeName,
      updatedAt: new Date().toISOString(),
      now: {
        tempC: round1(j.current.temperature_2m),
        feelsC: round1(j.current.apparent_temperature),
        humidityPct: Math.round(j.current.relative_humidity_2m),
        windKmh: Math.round(j.current.wind_speed_10m),
        pressureMm: Math.round(j.current.surface_pressure * 0.750062),
        icon: iconOf(j.current.weather_code),
        text: textOf(j.current.weather_code),
      },
      days,
    }
    if (cacheByKey.size > 40) cacheByKey.clear()
    cacheByKey.set(key, { ts: Date.now(), data })
    return data
  } catch (e) {
    console.error('weather fetch failed', e)
    const fallback = offlineForecast(placeName)
    cacheByKey.set(key, { ts: Date.now(), data: fallback })
    return fallback
  }
}
