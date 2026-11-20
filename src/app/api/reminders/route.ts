import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { ensureSeeded } from '@/lib/bootstrap'
import { db } from '@/lib/db'
import type { ReminderDto } from '@/lib/api-types'

/**
 * Напоминания пользователя: список (GET) и создание (POST).
 * Доступно обеим ролям — напоминания личные, не данные пасеки.
 */

function toDto(r: {
  id: string
  text: string
  remindAt: Date
  allDay: boolean
  done: boolean
  notifiedAt: Date | null
  hive: { number: number; name: string } | null
}): ReminderDto {
  return {
    id: r.id,
    text: r.text,
    remindAt: r.remindAt.toISOString(),
    allDay: r.allDay,
    done: r.done,
    notifiedAt: r.notifiedAt ? r.notifiedAt.toISOString() : null,
    hiveNumber: r.hive?.number ?? null,
    hiveName: r.hive?.name ?? null,
  }
}

export async function GET() {
  await ensureSeeded()
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Нужен вход в систему' }, { status: 401 })
  }
  const rows = await db.reminder.findMany({
    where: { userId: user.id },
    orderBy: { remindAt: 'asc' },
    include: { hive: { select: { number: true, name: true } } },
    take: 200,
  })
  return NextResponse.json({ reminders: rows.map(toDto) })
}

export async function POST(req: Request) {
  await ensureSeeded()
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Нужен вход в систему' }, { status: 401 })
  }
  try {
    const body = (await req.json()) as {
      text?: string
      date?: string // yyyy-MM-dd
      time?: string | null // HH:mm | null — «в течение дня»
      hiveId?: string | null
    }
    const text = (body.text ?? '').trim()
    if (!text || text.length > 300) {
      return NextResponse.json({ error: 'Текст напоминания: от 1 до 300 символов' }, { status: 400 })
    }
    if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      return NextResponse.json({ error: 'Укажите дату напоминания' }, { status: 400 })
    }
    // Без времени — заметка «в течение дня»: оповещение придёт в 09:00
    const time = body.time && /^\d{2}:\d{2}$/.test(body.time) ? body.time : null
    const allDay = time === null
    const remindAt = new Date(`${body.date}T${time ?? '09:00'}:00`)
    if (Number.isNaN(remindAt.getTime())) {
      return NextResponse.json({ error: 'Некорректная дата или время' }, { status: 400 })
    }
    let hiveId: string | null = null
    if (body.hiveId) {
      const hive = await db.hive.findUnique({ where: { id: body.hiveId } })
      if (hive) hiveId = hive.id
    }
    const created = await db.reminder.create({
      data: { userId: user.id, text, remindAt, allDay, hiveId },
      include: { hive: { select: { number: true, name: true } } },
    })
    return NextResponse.json({ ok: true, reminder: toDto(created) })
  } catch (e) {
    console.error('reminder create error', e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
