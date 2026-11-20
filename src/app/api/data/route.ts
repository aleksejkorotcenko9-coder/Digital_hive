import { NextResponse } from 'next/server'
import { ensureSeeded } from '@/lib/bootstrap'
import { getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { buildDailySeries, humidityMeta } from '@/lib/series'
import type { ApiData, ApiHive, EventDto, SiteDto } from '@/lib/api-types'

/** Все данные реального режима одним запросом: ульи с суточными рядами,
 *  площадки кочёвки, журнал событий, API-ключ (только пасечнику), счётчики. */
export async function GET() {
  try {
    await ensureSeeded()
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Нужен вход в систему' }, { status: 401 })
    }

    const [hiveRows, siteRows, eventRows, settings, measurementsCount] = await Promise.all([
      db.hive.findMany({
        orderBy: { number: 'asc' },
        include: {
          measurements: {
            orderBy: { ts: 'asc' },
            select: { ts: true, weightKg: true, tempC: true, humidityPct: true },
          },
        },
      }),
      db.migrationSite.findMany({ orderBy: [{ score: 'desc' }, { name: 'asc' }] }),
      db.event.findMany({ orderBy: { ts: 'desc' }, take: 60, include: { hive: true } }),
      db.appSetting.findMany(),
      db.measurement.count(),
    ])

    const hives: ApiHive[] = hiveRows.map((h) => {
      const series = buildDailySeries(
        h.measurements.map((m) => ({ ts: m.ts, weightKg: m.weightKg, tempC: m.tempC, humidityPct: m.humidityPct })),
      )
      const hum = humidityMeta(series)
      const lastTs = h.measurements.length ? h.measurements[h.measurements.length - 1].ts.toISOString() : null
      return {
        id: h.id,
        number: h.number,
        name: h.name,
        familyNote: h.familyNote,
        series,
        humiditySensorOk: hum.ok,
        humidityOfflineFrom: hum.offlineFrom,
        readingCount: h.measurements.length,
        lastTs,
      }
    })

    const sites: SiteDto[] = siteRows.map((s) => ({
      id: s.id,
      name: s.name,
      honeyPlant: s.honeyPlant,
      bloomWindow: s.bloomWindow,
      distanceKm: s.distanceKm,
      weatherNote: s.weatherNote,
      risks: s.risks,
      score: s.score,
      verdict: s.verdict,
    }))

    const events: EventDto[] = eventRows.map((e) => ({
      id: e.id,
      hiveNumber: e.hive.number,
      hiveName: e.hive.name,
      ts: e.ts.toISOString(),
      type: e.type,
      note: e.note,
      authorName: e.authorName,
    }))

    const apiKeySetting = settings.find((s) => s.key === 'apiKey')

    const data: ApiData = {
      user,
      hives,
      sites,
      events,
      apiKey: user.role === 'BEEKEEPER' ? apiKeySetting?.value ?? null : null,
      counts: { measurements: measurementsCount, events: eventRows.length },
    }

    return NextResponse.json(data)
  } catch (e) {
    console.error('data error', e)
    return NextResponse.json({ error: 'Ошибка сервера при чтении данных' }, { status: 500 })
  }
}
