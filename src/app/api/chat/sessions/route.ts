import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'

/**
 * Чаты ИИ-агента: у каждого пользователя свой список.
 * GET — список чатов текущего пользователя (заголовок, превью последнего
 * вопроса, время обновления). POST — создать новый чат.
 */
export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Нужен вход в систему' }, { status: 401 })
  }
  const sessions = await db.chatSession.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  })
  // Превью — последний вопрос пользователя в каждом чате (одним запросом).
  const lastQuestions = await db.chatMessage.findMany({
    where: { sessionId: { in: sessions.map((s) => s.id) }, role: 'user' },
    orderBy: { createdAt: 'desc' },
    select: { sessionId: true, text: true },
  })
  const previewBy = new Map<string, string>()
  for (const m of lastQuestions) {
    if (m.sessionId && !previewBy.has(m.sessionId)) {
      previewBy.set(m.sessionId, m.text.slice(0, 80))
    }
  }
  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      title: s.title,
      preview: previewBy.get(s.id) ?? '',
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    })),
  })
}

/** Новый чат текущего пользователя. */
export async function POST() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Нужен вход в систему' }, { status: 401 })
  }
  const session = await db.chatSession.create({ data: { userId: user.id } })
  return NextResponse.json({
    session: {
      id: session.id,
      title: session.title,
      preview: '',
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    },
  })
}
