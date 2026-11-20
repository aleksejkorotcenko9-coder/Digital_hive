import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/** Приём телеметрии от датчиков/скриптов. Авторизация — API-ключ
 *  в заголовке x-api-key (или в поле apiKey). Принимает один объект
 *  {hiveNumber, ts?, weightKg?, tempC?, humidityPct?} или массив таких объектов. */
export async function POST(req: Request) {
  try {
    const settings = await db.appSetting.findMany()
    const expectedKey = settings.find((s) => s.key === 'apiKey')?.value
    const headerKey = req.headers.get('x-api-key')
    let body: unknown = null
    try {
      body = await req.json()
    } catch {
      body = null
    }
    const bodyKey =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as { apiKey?: string }).apiKey
        : undefined

    if (!expectedKey) {
      return NextResponse.json({ error: 'API-ключ ещё не создан' }, { status: 500 })
    }
    if (headerKey !== expectedKey && bodyKey !== expectedKey) {
      return NextResponse.json({ error: 'Неверный API-ключ (заголовок x-api-key)' }, { status: 401 })
    }

    const items = Array.isArray(body) ? body : [body]
    const toInsert: Array<{
      hiveId: string
      ts: Date
      weightKg: number | null
      tempC: number | null
      humidityPct: number | null
      source: string
    }> = []
    const errors: string[] = []

    const hives = await db.hive.findMany({ orderBy: { number: 'asc' } })

    for (let i = 0; i < items.length; i++) {
      const item = items[i] as {
        hiveNumber?: number
        hive?: number
        ts?: string
        weightKg?: number
        tempC?: number
        humidityPct?: number
      } | null
      if (!item || typeof item !== 'object') {
        errors.push(`Элемент ${i + 1}: не объект`)
        continue
      }
      const hiveNumber = Number(item.hiveNumber ?? item.hive ?? NaN)
      const hive = hives.find((h) => h.number === hiveNumber)
      if (!hive) {
        errors.push(`Элемент ${i + 1}: улей №${item.hiveNumber ?? item.hive ?? '?'} не найден`)
        continue
      }
      const weightKg = item.weightKg != null ? Number(item.weightKg) : null
      const tempC = item.tempC != null ? Number(item.tempC) : null
      const humidityPct = item.humidityPct != null ? Number(item.humidityPct) : null
      if (weightKg === null && tempC === null && humidityPct === null) {
        errors.push(`Элемент ${i + 1}: нет ни одного значения`)
        continue
      }
      const ts = item.ts ? new Date(item.ts) : new Date()
      if (Number.isNaN(ts.getTime())) {
        errors.push(`Элемент ${i + 1}: неверная дата «${item.ts}»`)
        continue
      }
      if (
        (weightKg !== null && !Number.isFinite(weightKg)) ||
        (tempC !== null && !Number.isFinite(tempC)) ||
        (humidityPct !== null && !Number.isFinite(humidityPct))
      ) {
        errors.push(`Элемент ${i + 1}: значения должны быть числами`)
        continue
      }
      toInsert.push({
        hiveId: hive.id,
        ts,
        weightKg,
        tempC,
        humidityPct,
        source: 'api',
      })
    }

    if (toInsert.length) {
      await db.measurement.createMany({ data: toInsert })
    }
    return NextResponse.json({ ok: true, inserted: toInsert.length, errors })
  } catch (e) {
    console.error('telemetry error', e)
    return NextResponse.json({ error: 'Ошибка сервера при приёме телеметрии' }, { status: 500 })
  }
}
