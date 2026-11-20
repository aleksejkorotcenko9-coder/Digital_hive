import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'
import type { ChatHistoryItem } from '@/lib/api-types'

const DEFAULT_TITLE = 'Новый чат'

/**
 * Сообщения одного чата ИИ-агента (sessionId) — чаты изолированы по
 * пользователям. Без sessionId отдаём последний чат текущего пользователя:
 * так чат при открытии продолжает последний разговор, а не общую ленту.
 */
export async function GET(req: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Нужен вход в систему' }, { status: 401 })
  }
  const url = new URL(req.url)
  const sessionId = url.searchParams.get('sessionId')

  let targetSessionId: string | null = null
  if (sessionId) {
    const session = await db.chatSession.findUnique({ where: { id: sessionId } })
    if (!session || session.userId !== user.id) {
      return NextResponse.json({ error: 'Чат не найден' }, { status: 404 })
    }
    targetSessionId = session.id
  } else {
    // последний чат пользователя (для продолжения при открытии экрана)
    const last = await db.chatSession.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    })
    targetSessionId = last?.id ?? null
  }

  if (!targetSessionId) return NextResponse.json({ items: [], sessionId: null })

  const messages = await db.chatMessage.findMany({
    where: { sessionId: targetSessionId },
    orderBy: { createdAt: 'asc' },
    take: 100,
  })

  const items: ChatHistoryItem[] = messages.map((m) => ({
    id: m.id,
    role: m.role === 'agent' ? 'agent' : 'user',
    text: m.text,
    agentJson: m.agentJson,
    createdAt: m.createdAt.toISOString(),
  }))

  return NextResponse.json({ items, sessionId: targetSessionId })
}

/**
 * Сохранение обмена: вопрос пчеловода + ответ агента — в указанный чат
 * (только владелец). Первый вопрос даёт чату заголовок. Доступно обеим ролям.
 */
export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Нужен вход в систему' }, { status: 401 })
  }
  try {
    const body = (await req.json()) as {
      sessionId?: string | null
      hiveNumber?: number | null
      userText?: string
      agent?: unknown
      agentText?: string
    }
    const userText = (body.userText ?? '').trim()
    if (!userText) {
      return NextResponse.json({ error: 'Пустой вопрос' }, { status: 400 })
    }
    let hiveId: string | null = null
    if (body.hiveNumber != null) {
      const hive = await db.hive.findUnique({ where: { number: Number(body.hiveNumber) } })
      hiveId = hive?.id ?? null
    }
    const agentText = (body.agentText ?? '').trim()
    const agentJson =
      body.agent && typeof body.agent === 'object' ? JSON.stringify(body.agent) : null

    // Чат: только свой; без sessionId — пишем без сессии (не попадёт в списки).
    let sessionId: string | null = null
    if (body.sessionId) {
      const session = await db.chatSession.findUnique({ where: { id: body.sessionId } })
      if (session && session.userId === user.id) sessionId = session.id
    }

    await db.chatMessage.createMany({
      data: [
        { hiveId, role: 'user', text: userText, author: user.name, userId: user.id, sessionId },
        ...(agentText
          ? [{ hiveId, role: 'agent', text: agentText, agentJson, author: 'agent', userId: user.id, sessionId }]
          : []),
      ],
    })

    // Первый вопрос становится заголовком чата + трогаем updatedAt.
    let sessionTitle: string | null = null
    if (sessionId) {
      const session = await db.chatSession.findUnique({ where: { id: sessionId } })
      if (session) {
        const data: { updatedAt?: Date; title?: string } = { updatedAt: new Date() }
        if (session.title === DEFAULT_TITLE) {
          data.title = userText.slice(0, 60)
          sessionTitle = data.title
        }
        await db.chatSession.update({ where: { id: sessionId }, data })
      }
    }

    return NextResponse.json({ ok: true, sessionId, title: sessionTitle })
  } catch (e) {
    console.error('chat save error', e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
