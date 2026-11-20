import { NextResponse } from 'next/server'

/**
 * Обратное геокодирование для выбора города пасеки на карте:
 * координаты → ближайший город/район. Серверный прокси к BigDataCloud
 * (бесплатно, без ключа; Nominatim для прототипа недоступен — Access denied).
 * Кэш 10 минут в памяти; при недоступности сервиса отдаём координаты.
 *
 * GET /api/geocode?lat=54.738&lon=55.972&lang=ru → { name, country }
 */
const TTL_MS = 10 * 60 * 1000
const cache = new Map<string, { ts: number; data: { name: string; country: string } }>()

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const lat = Number(sp.get('lat'))
  const lon = Number(sp.get('lon'))
  const lang = (sp.get('lang') || 'ru').slice(0, 5)
  if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon) || Math.abs(lon) > 180) {
    return NextResponse.json({ error: 'bad coords' }, { status: 400 })
  }

  const key = `${lat.toFixed(3)},${lon.toFixed(3)},${lang}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.ts < TTL_MS) {
    return NextResponse.json(hit.data)
  }

  const fallback = { name: `${lat.toFixed(3)}, ${lon.toFixed(3)}`, country: '' }
  try {
    const url =
      `https://api.bigdatacloud.net/data/reverse-geocode-client` +
      `?latitude=${lat}&longitude=${lon}&localityLanguage=${encodeURIComponent(lang)}`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const j = (await res.json()) as {
      city?: string
      locality?: string
      principalSubdivision?: string
      countryName?: string
    }
    const name = (j.city || j.locality || j.principalSubdivision || '').trim() || fallback.name
    const data = { name, country: (j.countryName || '').trim() }
    cache.set(key, { ts: Date.now(), data })
    return NextResponse.json(data)
  } catch {
    // сервис недоступен: координаты вместо города — интерфейс остаётся рабочим
    return NextResponse.json(fallback)
  }
}
