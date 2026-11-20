import { NextResponse } from 'next/server'
import { requireBeekeeper } from '@/lib/auth'
import { db } from '@/lib/db'
import { randomBytes } from 'node:crypto'

/** Ручное измерение: POST /api/measurements. Только пасечник. */
export async function POST(req: Request) {
  const guard = await requireBeekeeper()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  try {
    const body = (await req.json()) as {
      hiveNumber?: number
      ts?: string
      weightKg?: number | string
      tempC?: number | string
      humidityPct?: number | string
    }
    const hiveNumber = Number(body.hiveNumber)
    const hive = await db.hive.findUnique({ where: { number: hiveNumber } })
    if (!hive) {
      return NextResponse.json({ error: `Улей №${body.hiveNumber} не найден` }, { status: 400 })
    }

    const toNum = (v: number | string | undefined): number | null => {
      if (v === undefined || v === null || v === '') return null
      const n = Number(String(v).replace(',', '.'))
      return Number.isFinite(n) ? n : null
    }
    const weightKg = toNum(body.weightKg)
    const tempC = toNum(body.tempC)
    const humidityPct = toNum(body.humidityPct)
    if (weightKg === null && tempC === null && humidityPct === null) {
      return NextResponse.json({ error: 'Заполните хотя бы одно значение' }, { status: 400 })
    }
    if (humidityPct !== null && (humidityPct < 0 || humidityPct > 100)) {
      return NextResponse.json({ error: 'Влажность: 0–100 %' }, { status: 400 })
    }
    const ts = body.ts ? new Date(body.ts) : new Date()
    if (Number.isNaN(ts.getTime())) {
      return NextResponse.json({ error: 'Неверная дата' }, { status: 400 })
    }

    await db.measurement.create({
      data: { hiveId: hive.id, ts, weightKg, tempC, humidityPct, source: 'manual' },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('measurement error', e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
