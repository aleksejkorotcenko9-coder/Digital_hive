import { NextResponse } from 'next/server'
import { requireBeekeeper } from '@/lib/auth'
import { db } from '@/lib/db'
import { decodeCsvBuffer, parseCsv } from '@/lib/csv-parse'

/** Загрузка CSV с телеметрией. Только пасечник.
 *  multipart/form-data: file (обязателен), hiveNumber (фолбэк, если в файле нет колонки «улей»). */
export async function POST(req: Request) {
  const guard = await requireBeekeeper()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Файл не передан' }, { status: 400 })
    }
    const fallbackHiveRaw = form.get('hiveNumber')
    const fallbackHive = fallbackHiveRaw != null && fallbackHiveRaw !== '' ? Number(fallbackHiveRaw) : null

    const text = decodeCsvBuffer(await file.arrayBuffer())
    const parsed = parseCsv(text)

    const hives = await db.hive.findMany({ orderBy: { number: 'asc' } })
    const toInsert: Array<{
      hiveId: string
      ts: Date
      weightKg: number | null
      tempC: number | null
      humidityPct: number | null
      source: string
    }> = []
    const errors: string[] = [...parsed.errors]

    for (const row of parsed.rows) {
      const hiveNumber = row.hiveNumber ?? fallbackHive
      const hive = hives.find((h) => h.number === hiveNumber)
      if (!hive) {
        errors.push(
          `${row.ts.toISOString().slice(0, 16).replace('T', ' ')}: улей ${
            row.hiveNumber ?? fallbackHive ?? '—'
          } не найден`,
        )
        continue
      }
      toInsert.push({
        hiveId: hive.id,
        ts: row.ts,
        weightKg: row.weightKg,
        tempC: row.tempC,
        humidityPct: row.humidityPct,
        source: 'csv',
      })
    }

    if (toInsert.length) {
      await db.measurement.createMany({ data: toInsert })
    }

    const byHive = new Map<number, number>()
    for (const r of toInsert) {
      const hive = hives.find((h) => h.id === r.hiveId)
      if (hive) byHive.set(hive.number, (byHive.get(hive.number) ?? 0) + 1)
    }

    return NextResponse.json({
      ok: true,
      inserted: toInsert.length,
      skipped: errors.length,
      errors: errors.slice(0, 12),
      delimiter: parsed.delimiter,
      byHive: Object.fromEntries(byHive),
    })
  } catch (e) {
    console.error('csv upload error', e)
    return NextResponse.json({ error: 'Не удалось разобрать файл' }, { status: 500 })
  }
}

/** Шаблон CSV для скачивания. */
export async function GET() {
  const csv = [
    '\uFEFFдата;улей;вес, кг;температура, °C;влажность, %',
    '18.07.2026 08:00;1;152,4;34,9;45',
    '18.07.2026 20:00;1;152,8;35,0;46',
    '18.07.2026 08:00;4;157,6;35,0;45',
    '19.07.2026 08:00;4;158,1;35,1;44',
  ].join('\n')
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="uley-telemetry-template.csv"',
    },
  })
}
