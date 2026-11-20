import { NextResponse } from 'next/server'
import { ensureSeeded } from '@/lib/bootstrap'
import { loginUser, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth'

/**
 * Вход по имени и паролю.
 * Если email пользователя ещё не подтверждён (emailVerified = null)
 * — 403 «Подтвердите email. Проверьте почту.», сессия НЕ создаётся.
 */
export async function POST(req: Request) {
  try {
    await ensureSeeded()
    const body = (await req.json()) as { name?: string; password?: string }
    const name = (body.name ?? '').trim()
    const password = body.password ?? ''
    if (!name || !password) {
      return NextResponse.json({ error: 'Введите имя и пароль' }, { status: 400 })
    }
    const result = await loginUser(name, password)

    if (result.status === 'invalid') {
      return NextResponse.json({ error: 'Неверное имя или пароль' }, { status: 401 })
    }
    if (result.status === 'unverified') {
      return NextResponse.json(
        {
          error: 'Подтвердите email. Проверьте почту.',
          needsVerification: true,
          // email вернём только после успешной проверки пароля — это сам владелец аккаунта
          email: result.email,
        },
        { status: 403 },
      )
    }

    const out = NextResponse.json({ user: result.result.user })
    out.cookies.set(SESSION_COOKIE, result.result.token, sessionCookieOptions)
    return out
  } catch (e) {
    console.error('login error', e)
    return NextResponse.json({ error: 'Ошибка сервера при входе' }, { status: 500 })
  }
}
