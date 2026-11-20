import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'

/**
 * Правка и удаление своего напоминания.
 * PATCH: { done?: boolean } — отметить выполненным; { notified?: true } —
 * пометить, что приложение уже показало оповещение (чтобы не дублировать).
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Нужен вход в систему' }, { status: 401 })
  }
  const { id } = await params
  const item = await db.reminder.findUnique({ where: { id } })
  if (!item || item.userId !== user.id) {
    return NextResponse.json({ error: 'Напоминание не найдено' }, { status: 404 })
  }
  const body = (await req.json().catch(() => ({}))) as { done?: boolean; notified?: boolean }
  const data: { done?: boolean; doneAt?: Date | null; notifiedAt?: Date } = {}
  if (typeof body.done === 'boolean') {
    data.done = body.done
    data.doneAt = body.done ? new Date() : null
  }
  if (body.notified) {
    data.notifiedAt = new Date()
  }
  const updated = await db.reminder.update({ where: { id }, data })
  return NextResponse.json({
    ok: true,
    reminder: {
      id: updated.id,
      text: updated.text,
      remindAt: updated.remindAt.toISOString(),
      allDay: updated.allDay,
      done: updated.done,
      notifiedAt: updated.notifiedAt ? updated.notifiedAt.toISOString() : null,
      hiveNumber: null,
      hiveName: null,
    },
  })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Нужен вход в систему' }, { status: 401 })
  }
  const { id } = await params
  const item = await db.reminder.findUnique({ where: { id } })
  if (!item || item.userId !== user.id) {
    return NextResponse.json({ error: 'Напоминание не найдено' }, { status: 404 })
  }
  await db.reminder.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
