import { NextResponse } from 'next/server'
import { requireBeekeeper } from '@/lib/auth'
import { db } from '@/lib/db'
import { randomBytes } from 'node:crypto'

/** Перевыпуск API-ключа для приёма телеметрии. Только пасечник. */
export async function POST() {
  const guard = await requireBeekeeper()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const value = randomBytes(16).toString('hex')
  await db.appSetting.upsert({
    where: { key: 'apiKey' },
    update: { value },
    create: { key: 'apiKey', value },
  })
  return NextResponse.json({ ok: true, apiKey: value })
}
