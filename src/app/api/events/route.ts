import { NextResponse } from 'next/server'
import { requireBeekeeper } from '@/lib/auth'
import { db } from '@/lib/db'

const EVENT_TYPES = ['осмотр', 'подкормка', 'расширение', 'лечение', 'кочёвка', 'план', 'прочее']

/** Добавление записи в журнал событий. Только пасечник. */
export async function POST(req: Request) {
  const guard = await requireBeekeeper()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  try {
    const body = (await req.json()) as { hiveNumber?: number; type?: string; note?: string; ts?: string }
    const hiveNumber = Number(body.hiveNumber)
    const hive = await db.hive.findUnique({ where: { number: hiveNumber } })
    if (!hive) {
      return NextResponse.json({ error: `Улей №${body.hiveNumber} не найден` }, { status: 400 })
    }
    const type = EVENT_TYPES.includes(body.type ?? '') ? (body.type as string) : 'прочее'
    const note = (body.note ?? '').trim()
    if (!note) {
      return NextResponse.json({ error: 'Опишите, что произошло' }, { status: 400 })
    }
    const ts = body.ts ? new Date(body.ts) : new Date()
    if (Number.isNaN(ts.getTime())) {
      return NextResponse.json({ error: 'Неверная дата' }, { status: 400 })
    }
    const event = await db.event.create({
      data: { hiveId: hive.id, ts, type, note, authorName: guard.user.name },
      include: { hive: true },
    })
    return NextResponse.json({
      ok: true,
      event: {
        id: event.id,
        hiveNumber: event.hive.number,
        hiveName: event.hive.name,
        ts: event.ts.toISOString(),
        type: event.type,
        note: event.note,
        authorName: event.authorName,
      },
    })
  } catch (e) {
    console.error('events error', e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
