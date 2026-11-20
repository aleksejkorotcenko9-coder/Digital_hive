import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { destroySessionByToken, SESSION_COOKIE } from '@/lib/auth'

export async function POST() {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  await destroySessionByToken(token)
  const out = NextResponse.json({ ok: true })
  out.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
  return out
}
