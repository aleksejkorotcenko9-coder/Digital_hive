import { NextResponse } from 'next/server'
import { ensureSeeded } from '@/lib/bootstrap'
import { getSessionUser } from '@/lib/auth'

/** Проверка сессии: { user } или { user: null }. Служит «пингом» живой базы. */
export async function GET() {
  try {
    await ensureSeeded()
    const user = await getSessionUser()
    return NextResponse.json({ user })
  } catch (e) {
    console.error('me error', e)
    return NextResponse.json({ user: null, error: 'База данных недоступна' }, { status: 500 })
  }
}
