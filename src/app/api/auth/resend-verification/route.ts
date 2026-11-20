import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkResendRateLimit, issueVerificationCode } from '@/lib/verification'
import { sendVerificationEmail } from '@/lib/email'

/**
 * POST /api/auth/resend-verification  { email }
 * Повторная отправка письма подтверждения.
 *   • Rate limit: не более 3 запросов на один email в час (Map в памяти процесса).
 *   • Пользователь не найден → всё равно 200 (не раскрываем существование аккаунта).
 *   • Email уже подтверждён → 200 «Email уже подтверждён».
 *   • Иначе — новый код (старые записи пользователя удаляются) и письмо.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: string }
    const email = (body.email ?? '').trim().toLowerCase()
    if (!email) {
      return NextResponse.json({ error: 'Укажите email' }, { status: 400 })
    }

    // Rate limit считаем по каждому запросу, до проверок существования аккаунта.
    const rl = checkResendRateLimit(email)
    if (!rl.allowed) {
      const minutes = Math.max(1, Math.ceil(rl.retryAfterSec / 60))
      return NextResponse.json(
        { error: `Слишком много запросов. Попробуйте ещё раз примерно через ${minutes} мин.` },
        { status: 429 },
      )
    }

    const user = await db.user.findUnique({ where: { email } })
    if (!user || !user.email) {
      // Не раскрываем, существует ли аккаунт с таким email.
      return NextResponse.json({ message: 'Если такой email зарегистрирован и не подтверждён, мы отправили письмо' })
    }
    if (user.emailVerified) {
      return NextResponse.json({ message: 'Email уже подтверждён' })
    }

    const code = await issueVerificationCode(user.id)
    try {
      const send = await sendVerificationEmail(user.email, user.name, code)
      if (send === 'dev-logged') {
        console.log(`[resend] письмо для ${user.email} не отправлено (SMTP не настроен) — код в консоли сервера`)
      }
    } catch (e) {
      console.error('resend-verification: не удалось отправить письмо', e)
      // Mail.ru отклоняет несуществующие адреса — сообщаем пользователю
      const err = e as { responseCode?: number; code?: string }
      if (err.responseCode === 550 || err.code === 'EENVELOPE') {
        return NextResponse.json({
          message: 'Если такой email зарегистрирован и не подтверждён, мы отправили код',
          warning: 'Код не удалось отправить: почтовый сервер отклонил этот адрес. Проверьте правильность email.',
        })
      }
    }

    return NextResponse.json({
      message: 'Если такой email зарегистрирован и не подтверждён, мы отправили код',
      demoCode: code,
    })
  } catch (e) {
    console.error('resend-verification error', e)
    return NextResponse.json({ error: 'Ошибка сервера. Попробуйте позже.' }, { status: 500 })
  }
}
