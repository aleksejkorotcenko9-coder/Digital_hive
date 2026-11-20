import { NextResponse } from 'next/server'
import { requireBeekeeper } from '@/lib/auth'
import { db } from '@/lib/db'

/**
 * Правка и удаление точки пасеки на карте. Только пасечник.
 * PATCH: { sensorOn?, hasSensor?, name?, hiveCount?, hiveNumber?, sensorKind?,
 * sensorPlacement?, cameraUrl?, lat?, lon? } — включить/выключить датчик,
 * установить датчик, переименовать точку, изменить число ульев, задать
 * номер улья (жёсткая привязка «Улей №ХХХ»), тип и место установки датчика,
 * URL камеры или перенести улей на новое место.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireBeekeeper()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { id } = await params
  const item = await db.apiaryPoint.findUnique({ where: { id } })
  if (!item || item.userId !== guard.user.id) {
    return NextResponse.json({ error: 'Точка не найдена' }, { status: 404 })
  }
  const body = (await req.json().catch(() => ({}))) as {
    sensorOn?: boolean
    hasSensor?: boolean
    name?: string
    hiveCount?: number
    hiveNumber?: number | null
    sensorKind?: string
    sensorPlacement?: string
    cameraUrl?: string | null
    lat?: number
    lon?: number
  }
  const data: {
    sensorOn?: boolean
    hasSensor?: boolean
    name?: string
    hiveCount?: number
    hiveNumber?: number | null
    sensorKind?: string
    sensorPlacement?: string
    cameraUrl?: string | null
    lat?: number
    lon?: number
  } = {}
  if (typeof body.sensorOn === 'boolean') data.sensorOn = body.sensorOn
  if (typeof body.hasSensor === 'boolean') {
    data.hasSensor = body.hasSensor
    // установили датчик — он включён; сняли — значит выключен
    data.sensorOn = body.hasSensor
  }
  if (body.name !== undefined) {
    const name = body.name.trim()
    if (!name || name.length > 60) {
      return NextResponse.json({ error: 'Название точки: от 1 до 60 символов' }, { status: 400 })
    }
    data.name = name
  }
  if (body.hiveCount !== undefined) {
    const hiveCount = Number(body.hiveCount)
    if (!Number.isInteger(hiveCount) || hiveCount < 1 || hiveCount > 999) {
      return NextResponse.json({ error: 'Число ульев: целое от 1 до 999' }, { status: 400 })
    }
    data.hiveCount = hiveCount
  }
  // Жёсткая привязка датчика к номеру улья: «Улей №ХХХ» в интерфейсе.
  if (body.hiveNumber !== undefined) {
    if (body.hiveNumber === null) {
      data.hiveNumber = null
    } else {
      const hn = Number(body.hiveNumber)
      if (!Number.isInteger(hn) || hn < 1 || hn > 9999) {
        return NextResponse.json({ error: 'Номер улья: целое от 1 до 9999 (или null, чтобы сбросить)' }, { status: 400 })
      }
      data.hiveNumber = hn
    }
  }
  // Тип датчика: контактный (в гнезде) или инфракрасный (без контакта).
  if (body.sensorKind !== undefined) {
    data.sensorKind = body.sensorKind === 'ir' ? 'ir' : 'contact'
  }
  // Место установки: центр гнезда или периферия клуба/расплода.
  if (body.sensorPlacement !== undefined) {
    data.sensorPlacement = body.sensorPlacement === 'periphery' ? 'periphery' : 'center'
  }
  // URL камеры наблюдения на точке (http-снапшот/MJPEG или локальный демо-путь
  // вида /cameras/cam-1.jpg), null — снять камеру.
  if (body.cameraUrl !== undefined) {
    const url = body.cameraUrl === null ? null : body.cameraUrl.trim()
    if (url && !/^https?:\/\//i.test(url) && !url.startsWith('/')) {
      return NextResponse.json({ error: 'URL камеры должен начинаться с http(s):// или /' }, { status: 400 })
    }
    if (url && url.length > 500) {
      return NextResponse.json({ error: 'URL камеры: до 500 символов' }, { status: 400 })
    }
    data.cameraUrl = url || null
  }
  // Перенос улья на новое место: нужны обе координаты сразу и в разумных границах
  if (body.lat !== undefined || body.lon !== undefined) {
    const latN = Number(body.lat)
    const lonN = Number(body.lon)
    if (
      !Number.isFinite(latN) ||
      !Number.isFinite(lonN) ||
      Math.abs(latN) > 90 ||
      Math.abs(lonN) > 180
    ) {
      return NextResponse.json({ error: 'Некорректные координаты нового места' }, { status: 400 })
    }
    data.lat = latN
    data.lon = lonN
  }
  await db.apiaryPoint.update({ where: { id }, data })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireBeekeeper()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { id } = await params
  const item = await db.apiaryPoint.findUnique({ where: { id } })
  if (!item || item.userId !== guard.user.id) {
    return NextResponse.json({ error: 'Точка не найдена' }, { status: 404 })
  }
  await db.apiaryPoint.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
