import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { db } from '@/lib/db'
import type { SafeUser } from '@/lib/api-types'

/**
 * Профиль пользователя: обновление отображаемого имени и фото.
 * Фото приходит как data-URL (клиент уже сжал до 256px JPEG, лимит 400 КБ).
 * Доступно обеим ролям.
 */

const MAX_AVATAR_CHARS = 400_000

export async function PATCH(req: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Нужен вход в систему' }, { status: 401 })
  }
  try {
    const body = (await req.json()) as { displayName?: string | null; avatar?: string | null }
    const data: { displayName?: string | null; avatar?: string | null } = {}

    if (body.displayName !== undefined) {
      const dn = (body.displayName ?? '').trim()
      if (dn.length > 60) {
        return NextResponse.json({ error: 'Имя: до 60 символов' }, { status: 400 })
      }
      data.displayName = dn || null
    }

    if (body.avatar !== undefined) {
      const av = body.avatar
      if (av === null || av === '') {
        data.avatar = null
      } else if (typeof av === 'string' && av.startsWith('data:image/') && av.length <= MAX_AVATAR_CHARS) {
        data.avatar = av
      } else {
        return NextResponse.json({ error: 'Фото: изображение до 400 КБ' }, { status: 400 })
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Нет данных для обновления' }, { status: 400 })
    }

    const updated = await db.user.update({ where: { id: user.id }, data })
    const safe: SafeUser = {
      id: updated.id,
      name: updated.name,
      displayName: updated.displayName,
      avatar: updated.avatar,
      role: updated.role as SafeUser['role'],
    }
    return NextResponse.json({ ok: true, user: safe })
  } catch (e) {
    console.error('profile patch error', e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
