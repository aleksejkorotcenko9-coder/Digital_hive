import { NextResponse } from 'next/server'
import { ensureSeeded } from '@/lib/bootstrap'
import { registerUser, activateAndLogin, EMAIL_VERIFICATION_REQUIRED, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth'
import { issueVerificationCode } from '@/lib/verification'
import { sendVerificationEmail } from '@/lib/email'
import type { Role } from '@/lib/api-types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Человекочитаемое предупреждение при неудачной отправке кода.
 * Mail.ru проверяет существование ящика получателя и отклоняет
 * несуществующие адреса (550 non-local recipient verification failed) —
 * показываем это пользователю сразу, чтобы он поправил опечатку в email.
 */
function smtpWarning(e: unknown): string {
  const err = e as { responseCode?: number; code?: string }
  if (err.responseCode === 550 || err.code === 'EENVELOPE') {
    return 'Код не удалось отправить: почтовый сервер отклонил этот адрес. Проверьте правильность email и отправьте код повторно.'
  }
  return 'Не удалось отправить код на почту. Воспользуйтесь кнопкой «Отправить код повторно».'
}

/**
 * Регистрация нового пользователя: имя + email + пароль.
 * Подтверждение email сейчас ВЫКЛЮЧЕНО (EMAIL_VERIFICATION_REQUIRED = false):
 * аккаунт сразу активируется, создаётся сессия и пользователь попадает
 * в приложение без письма и кода.
 * Если флаг вернуть в true — включится прежний сценарий: код на почту,
 * экран «Проверьте почту», вход только после подтверждения.
 */
export async function POST(req: Request) {
  try {
    await ensureSeeded()
    const body = (await req.json()) as { name?: string; email?: string; password?: string; role?: string }
    const name = (body.name ?? '').trim()
    const email = (body.email ?? '').trim().toLowerCase()
    const password = body.password ?? ''
    const role = body.role === 'BEEKEEPER' ? 'BEEKEEPER' : 'HELPER'

    if (name.length < 2 || name.length > 40) {
      return NextResponse.json({ error: 'Имя: от 2 до 40 символов' }, { status: 400 })
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Введите корректный email' }, { status: 400 })
    }
    if (password.length < 4) {
      return NextResponse.json({ error: 'Пароль — минимум 4 символа' }, { status: 400 })
    }

    const res = await registerUser(name, email, password, role as Role)
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: 400 })
    }

    // Подтверждение почты отключено: активируем аккаунт и сразу входим.
    if (!EMAIL_VERIFICATION_REQUIRED) {
      const auth = await activateAndLogin(res.user.id)
      if (!auth) {
        return NextResponse.json({ error: 'Ошибка сервера при регистрации' }, { status: 500 })
      }
      const out = NextResponse.json({
        user: auth.user,
        message: 'Регистрация успешна. Добро пожаловать в «Цифровой улей»!',
      })
      out.cookies.set(SESSION_COOKIE, auth.token, sessionCookieOptions)
      return out
    }

    // ——— Сценарий с подтверждением email (EMAIL_VERIFICATION_REQUIRED = true) ———
    // Код подтверждения: в БД только SHA-256 хеш, сырой код уходит в письме.
    const code = await issueVerificationCode(res.user.id)
    let warning: string | null = null
    try {
      const send = await sendVerificationEmail(email, name, code)
      if (send === 'dev-logged') {
        console.log(`[register] письмо для ${email} не отправлено (SMTP не настроен) — код в консоли сервера`)
      }
    } catch (e) {
      // Аккаунт уже создан: не откатываем регистрацию, пусть пользователь
      // воспользуется «Отправить код повторно».
      console.error('register: не удалось отправить письмо', e)
      warning = smtpWarning(e)
    }

    // Никакой сессии и никакого редиректа в приложение — только сообщение.
    // demoCode — фолбэк для демо-режима: если письмо отфильтровано почтой
    // (Yandex нередко прячет письма Mail.ru в «Спам»), пользователь может
    // открыть код прямо в приложении. В письме код всё равно отправлен.
    return NextResponse.json({
      message: 'Регистрация успешна. Проверьте почту для подтверждения аккаунта',
      demoCode: code,
      ...(warning ? { warning } : {}),
    })
  } catch (e) {
    console.error('register error', e)
    return NextResponse.json({ error: 'Ошибка сервера при регистрации' }, { status: 500 })
  }
}
