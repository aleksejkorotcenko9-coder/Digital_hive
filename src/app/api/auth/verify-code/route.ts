import { NextResponse } from 'next/server'
import { consumeVerificationCode } from '@/lib/verification'

const CODE_RE = /^\d{6}$/

/**
 * POST /api/auth/verify-code  { email, code }
 * Подтверждение email кодом из письма (основной способ).
 *   • ok      → 200 «Email подтверждён. Теперь вы можете войти»
 *   • invalid → 400 «Неверный код»
 *   • expired → 400 «Код истёк. Запросите новый код»
 *   • locked  → 429 после 5 неверных попыток
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: string; code?: string }
    const email = (body.email ?? '').trim().toLowerCase()
    const code = (body.code ?? '').replace(/\s+/g, '')

    if (!CODE_RE.test(code)) {
      return NextResponse.json({ error: 'Введите 6-значный код из письма' }, { status: 400 })
    }

    const result = await consumeVerificationCode(email, code)

    if (result === 'ok') {
      return NextResponse.json({ message: 'Email подтверждён. Теперь вы можете войти' })
    }
    if (result === 'expired') {
      return NextResponse.json({ error: 'Код истёк. Запросите новый код' }, { status: 400 })
    }
    if (result === 'locked') {
      return NextResponse.json(
        { error: 'Слишком много неверных попыток. Запросите новый код и попробуйте снова' },
        { status: 429 },
      )
    }
    return NextResponse.json({ error: 'Неверный код' }, { status: 400 })
  } catch (e) {
    console.error('verify-code error', e)
    return NextResponse.json({ error: 'Ошибка сервера. Попробуйте позже.' }, { status: 500 })
  }
}
