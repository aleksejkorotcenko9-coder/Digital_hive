import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'

/**
 * Отдельный чат ИИ-агента: только владелец может править и удалять.
 * PATCH — переименовать ({ title }), DELETE — удалить чат вместе с
 * сообщениями (каскад по схеме).
 */
async function ownedSession(id: string, userId: string) {
  const session = await db.chatSession.findUnique({ where: { id } })
  if (!session || session.userId !== userId) return null
  return session
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Нужен вход в систему' }, { status: 401 })
  }
  const { id } = await params
  const session = await ownedSession(id, user.id)
  if (!session) {
    return NextResponse.json({ error: 'Чат не найден' }, { status: 404 })
  }
  const body = (await req.json().catch(() => ({}))) as { title?: string }
  const title = (body.title ?? '').trim().slice(0, 80)
  if (!title) {
    return NextResponse.json({ error: 'Пустое название чата' }, { status: 400 })
  }
  const updated = await db.chatSession.update({ where: { id }, data: { title } })
  return NextResponse.json({
    session: {
      id: updated.id,
      title: updated.title,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Нужен вход в систему' }, { status: 401 })
  }
  const { id } = await params
  const session = await ownedSession(id, user.id)
  if (!session) {
    return NextResponse.json({ error: 'Чат не найден' }, { status: 404 })
  }
  await db.chatSession.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
