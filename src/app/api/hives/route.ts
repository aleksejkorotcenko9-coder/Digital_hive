import { NextResponse } from 'next/server'
import { requireBeekeeper } from '@/lib/auth'
import { db } from '@/lib/db'

/** Справочник ульев: добавление (POST) и правка описания семьи (PATCH). Только пасечник. */
export async function POST(req: Request) {
  const guard = await requireBeekeeper()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  try {
    const body = (await req.json()) as { number?: number; name?: string; familyNote?: string }
    const number = Number(body.number)
    if (!Number.isInteger(number) || number < 1 || number > 999) {
      return NextResponse.json({ error: 'Номер улья: целое число от 1 до 999' }, { status: 400 })
    }
    const exists = await db.hive.findUnique({ where: { number } })
    if (exists) {
      return NextResponse.json({ error: `Улей №${number} уже есть в справочнике` }, { status: 400 })
    }
    const name = (body.name ?? '').trim() || `Улей №${number}`
    const hive = await db.hive.create({
      data: { number, name, familyNote: (body.familyNote ?? '').trim() },
    })
    return NextResponse.json({ ok: true, hive: { id: hive.id, number: hive.number, name: hive.name } })
  } catch (e) {
    console.error('hive create error', e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const guard = await requireBeekeeper()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  try {
    const body = (await req.json()) as { id?: string; familyNote?: string; name?: string }
    if (!body.id) {
      return NextResponse.json({ error: 'Не указан улей' }, { status: 400 })
    }
    const data: { familyNote?: string; name?: string } = {}
    if (body.familyNote !== undefined) data.familyNote = body.familyNote.trim()
    if (body.name !== undefined && body.name.trim()) data.name = body.name.trim()
    await db.hive.update({ where: { id: body.id }, data })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('hive patch error', e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
