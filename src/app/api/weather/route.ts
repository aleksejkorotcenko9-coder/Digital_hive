import { NextResponse } from 'next/server'
import { DEFAULT_LAT, DEFAULT_LON, DEFAULT_PLACE, fetchWeatherFor } from '@/lib/weather-server'

/**
 * Погода: реальный метеосервис из интернета (без ключа), кэш 10 минут на
 * сервере (см. weather-server.ts). Без параметров — Уфа (как в сюжете «Пасека
 * Уфа»); с ?lat=&lon= — любая точка на карте (округление до 0.25°, чтобы
 * соседние клики делили кэш); ?place= — человеческое название места в ответе
 * (например «Стерлитамак»). Источник в интерфейсе не показывается.
 * Если метеосервис недоступен, отдаём честный офлайн-фолбэк:
 * детерминированный приблизительный прогноз с пометкой source: 'offline' —
 * интерфейс показывает только то, что прогноз приблизительный.
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  // ВАЖНО: sp.get() возвращает null, а Number(null) = 0 — без явной проверки
  // отсутствующих параметров запрос уходил бы в точку 0°, 0° (экватор).
  const latRaw = sp.get('lat')
  const lonRaw = sp.get('lon')
  const qLat = latRaw === null ? NaN : Number(latRaw)
  const qLon = lonRaw === null ? NaN : Number(lonRaw)
  const hasCoords =
    Number.isFinite(qLat) && Math.abs(qLat) <= 90 && Number.isFinite(qLon) && Math.abs(qLon) <= 180
  const lat = hasCoords ? qLat : DEFAULT_LAT
  const lon = hasCoords ? qLon : DEFAULT_LON
  const placeRaw = (sp.get('place') ?? '').trim().slice(0, 60)
  const place = hasCoords ? (placeRaw || undefined) : placeRaw || DEFAULT_PLACE
  const data = await fetchWeatherFor(lat, lon, place)
  return NextResponse.json(data)
}
