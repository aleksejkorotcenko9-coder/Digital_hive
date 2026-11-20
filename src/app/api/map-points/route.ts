import { NextResponse } from 'next/server'
import { getSessionUser, requireBeekeeper } from '@/lib/auth'
import { ensureSeeded } from '@/lib/bootstrap'
import { db } from '@/lib/db'
import type { MapPointDto, SensorCatalogItem } from '@/lib/api-types'
import { sensorReading, type SensorPointRow } from '@/lib/sensor-sim'
import { findSensor, SENSOR_CATALOG } from '@/lib/sensor-catalog'

/**
 * Точки пасеки на карте: список (GET) и привязка улья (POST).
 *
 * Улей привязывается по КОДУ ДАТЧИКА: по умолчанию позиция берётся из
 * GPS-позиции датчика (каталог датчиков). Если пчеловод выбрал место на карте
 * вручную (lat/lon в запросе) — улей встанет туда: датчик остаётся в улье,
 * а место привязки задаёт пчеловод.
 * Лимита на число ульев нет — один датчик ставится в один улей (датчик нельзя
 * привязать дважды у одного пчеловода). Датчик ставится в улей автоматически
 * (hasSensor + sensorOn). Формула показаний датчика — общая с контекстом
 * ИИ-агента (lib/sensor-sim.ts).
 */

function toDto(r: SensorPointRow & { sensorCode?: string | null; hiveNumber?: number | null; sensorKind?: string | null; sensorPlacement?: string | null; cameraUrl?: string | null }, tSec: number): MapPointDto {
  return {
    id: r.id,
    name: r.name,
    lat: r.lat,
    lon: r.lon,
    hiveCount: r.hiveCount,
    hiveNumber: r.hiveNumber ?? null,
    hasSensor: r.hasSensor,
    sensorOn: r.sensorOn,
    sensorCode: r.sensorCode ?? null,
    sensorKind: r.sensorKind === 'ir' ? 'ir' : 'contact',
    sensorPlacement: r.sensorPlacement === 'periphery' ? 'periphery' : 'center',
    cameraUrl: r.cameraUrl ?? null,
    sensor: sensorReading(r, tSec),
  }
}

export async function GET() {
  await ensureSeeded()
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Нужен вход в систему' }, { status: 401 })
  }
  const rows = await db.apiaryPoint.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
  })
  const tSec = Date.now() / 1000
  const catalog: SensorCatalogItem[] = SENSOR_CATALOG.map(({ code, model, lat, lon, note, zone }) => ({
    code,
    model,
    lat,
    lon,
    note,
    zone,
  }))
  return NextResponse.json({ points: rows.map((r) => toDto(r, tSec)), catalog })
}

export async function POST(req: Request) {
  const guard = await requireBeekeeper()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  try {
    const body = (await req.json()) as {
      sensorCode?: string
      name?: string
      lat?: number
      lon?: number
      hiveNumber?: number
      sensorKind?: string
      sensorPlacement?: string
    }
    // Код датчика с корпуса: по нему находим устройство и его GPS-позицию
    const sensor = findSensor(body.sensorCode ?? '')
    if (!sensor) {
      return NextResponse.json(
        { error: 'Датчик с таким кодом не найден — проверьте код на корпусе датчика' },
        { status: 400 },
      )
    }
    // 1 датчик = 1 улей: у пчеловода каждый датчик стоит в одном улье
    // и передаёт одну позицию
    const bound = await db.apiaryPoint.findFirst({
      where: { userId: guard.user.id, sensorCode: sensor.code },
    })
    if (bound) {
      return NextResponse.json({ error: 'Этот датчик уже привязан к улью' }, { status: 400 })
    }
    const name = (body.name ?? '').trim() || 'Мой улей'
    if (name.length > 60) {
      return NextResponse.json({ error: 'Название улья: до 60 символов' }, { status: 400 })
    }
    // Жёсткая привязка датчика к номеру улья (п. 5 ТЗ): «Улей №ХХХ».
    let hiveNumber: number | null = null
    if (body.hiveNumber !== undefined && body.hiveNumber !== null) {
      const hn = Number(body.hiveNumber)
      if (!Number.isInteger(hn) || hn < 1 || hn > 9999) {
        return NextResponse.json({ error: 'Номер улья: целое от 1 до 9999' }, { status: 400 })
      }
      hiveNumber = hn
    }
    const sensorKind = body.sensorKind === 'ir' ? 'ir' : 'contact'
    const sensorPlacement = body.sensorPlacement === 'periphery' ? 'periphery' : 'center'
    // Позиция: по умолчанию GPS датчика; если пчеловод выбрал место на карте —
    // его координаты. Датчик в любом случае ставится в улей автоматически.
    let lat = sensor.lat
    let lon = sensor.lon
    if (body.lat !== undefined || body.lon !== undefined) {
      const latN = Number(body.lat)
      const lonN = Number(body.lon)
      if (
        !Number.isFinite(latN) ||
        !Number.isFinite(lonN) ||
        Math.abs(latN) > 90 ||
        Math.abs(lonN) > 180
      ) {
        return NextResponse.json({ error: 'Некорректные координаты места улья' }, { status: 400 })
      }
      lat = latN
      lon = lonN
    }
    const created = await db.apiaryPoint.create({
      data: {
        userId: guard.user.id,
        name,
        lat,
        lon,
        hiveCount: 1,
        hiveNumber,
        hasSensor: true,
        sensorOn: true,
        sensorCode: sensor.code,
        sensorKind,
        sensorPlacement,
      },
    })
    return NextResponse.json({ ok: true, point: toDto(created, Date.now() / 1000) })
  } catch (e) {
    console.error('map-point create error', e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
