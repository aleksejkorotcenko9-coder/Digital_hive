import { NextResponse } from 'next/server'
import { requireBeekeeper } from '@/lib/auth'
import { db } from '@/lib/db'

const VERDICTS = ['recommend', 'backup', 'avoid']

/** Площадки кочёвки: добавление (POST) и удаление (DELETE). Только пасечник. */
export async function POST(req: Request) {
  const guard = await requireBeekeeper()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  try {
    const body = (await req.json()) as {
      name?: string
      honeyPlant?: string
      bloomWindow?: string
      distanceKm?: number
      weatherNote?: string
      risks?: string
      score?: number
      verdict?: string
    }
    const name = (body.name ?? '').trim()
    if (!name) {
      return NextResponse.json({ error: 'Название участка обязательно' }, { status: 400 })
    }
    const score = Math.min(10, Math.max(0, Number(body.score ?? 5)))
    const verdict = VERDICTS.includes(body.verdict ?? '') ? (body.verdict as string) : 'backup'
    const site = await db.migrationSite.create({
      data: {
        name,
        honeyPlant: (body.honeyPlant ?? '').trim(),
        bloomWindow: (body.bloomWindow ?? '').trim(),
        distanceKm: Math.max(0, Number(body.distanceKm ?? 0)),
        weatherNote: (body.weatherNote ?? '').trim(),
        risks: (body.risks ?? '').trim(),
        score,
        verdict,
      },
    })
    return NextResponse.json({ ok: true, site })
  } catch (e) {
    console.error('site create error', e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const guard = await requireBeekeeper()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Не указана площадка' }, { status: 400 })
  }
  await db.migrationSite.delete({ where: { id } }).catch(() => undefined)
  return NextResponse.json({ ok: true })
}
