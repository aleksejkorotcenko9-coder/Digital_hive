import { NextResponse } from 'next/server'
import { consumeVerificationToken } from '@/lib/verification'

/**
 * GET /api/auth/verify?token={rawToken} — переход по ссылке из письма (legacy).
 * Ответ — ТОЛЬКО редирект (не JSON):
 *   • токен валиден и не истёк → User.emailVerified = текущая дата, запись
 *     токена удалена, редирект на /login?verified=true
 *   • токен невалиден / истёк / отсутствует → редирект на /login?error=invalid_token
 */
export async function GET(req: Request) {
  // Базу редиректа берём из самого запроса (учитывая x-forwarded-proto за прокси),
  // чтобы браузер остался на том же домене, с которого открыл ссылку.
  const url = new URL(req.url)
  const proto = req.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')
  const host = req.headers.get('host') ?? url.host
  const base = `${proto}://${host}`

  const token = url.searchParams.get('token')
  const ok = await consumeVerificationToken(token).catch(() => ({ ok: false as const }))

  if (!ok.ok) {
    return NextResponse.redirect(`${base}/login?error=invalid_token`)
  }
  return NextResponse.redirect(`${base}/login?verified=true`)
}
