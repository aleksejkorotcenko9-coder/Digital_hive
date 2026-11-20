import { NextResponse } from 'next/server'
import { getSessionUser, requireBeekeeper } from '@/lib/auth'
import { ensureSeeded } from '@/lib/bootstrap'
import { db } from '@/lib/db'
import {
  AGRO_CULTURES,
  estimateBloomWindow,
  formatBloomWindow,
  isBlooming,
  planDistribution,
  recommendFamilies,
  type BloomWindow,
  type PesticideTreatment,
} from '@/lib/agro-catalog'
import { seasonInfo } from '@/lib/season'

/**
 * Справочник Минсельхоза области: посевные площади медоносов, даты посева,
 * обработки пестицидами + расчётные окна цветения (от даты посева) и
 * рекомендации ИИ по числу семей (нормативы НИИ пчеловодства, Рыбново).
 *
 * GET  ?families=N — список полей с расчётом + план распределения N семей.
 * POST — добавить своё поле (дата посева → цветение пересчитывается).
 * PATCH { id, sowingDate?, ... } — поправить дату посева своего поля.
 */

export interface CropFieldDto {
  id: string
  ownerKey: string
  /** Моё поле или региональный справочник. */
  isMinselhoz: boolean
  culture: string
  cultureName: string
  cultureNote: string
  name: string
  district: string
  areaHa: number
  lat: number | null
  lon: number | null
  sowingDate: string | null
  distanceKm: number
  /** Расчётное окно цветения (от даты посева или эталон). */
  bloomText: string
  bloomStart: string | null
  bloomEnd: string | null
  bloomSource: 'sowing' | 'etalon' | null
  /** Отклонение от эталона, дней (плюс — позже). */
  bloomDeviationDays: number | null
  /** Цветёт ли сейчас (по сезону). */
  bloomingNow: boolean
  honeyYieldKgHa: [number, number]
  familiesPerHa: [number, number]
  recommend: {
    min: number
    max: number
    optimal: number
    honeyPerFamilyKg: number
    oversaturation: boolean
    note: string
  } | null
  treatments: PesticideTreatment[]
}

function toDto(f: { id: string; ownerKey: string; culture: string; name: string; district: string; areaHa: number; lat: number | null; lon: number | null; sowingDate: Date | null; distanceKm: number; treatmentsJson: string }, now: Date, phase: string): CropFieldDto {
  const culture = AGRO_CULTURES[f.culture]
  const bloom: BloomWindow | null = estimateBloomWindow(f.culture, f.sowingDate, now.getFullYear())
  let treatments: PesticideTreatment[] = []
  try {
    treatments = JSON.parse(f.treatmentsJson) as PesticideTreatment[]
  } catch {
    treatments = []
  }
  const rec = recommendFamilies(f.culture, f.areaHa)
  const sowing = f.sowingDate ? f.sowingDate.toISOString().slice(0, 10) : null
  return {
    id: f.id,
    ownerKey: f.ownerKey,
    isMinselhoz: f.ownerKey === 'minselhoz',
    culture: f.culture,
    cultureName: culture?.name ?? f.culture,
    cultureNote: culture?.note ?? '',
    name: f.name,
    district: f.district,
    areaHa: f.areaHa,
    lat: f.lat,
    lon: f.lon,
    sowingDate: sowing,
    distanceKm: f.distanceKm,
    bloomText: formatBloomWindow(bloom) || (culture ? `${culture.etalonStart.replace('-', '.')}–${culture.etalonEnd.replace('-', '.')}` : ''),
    bloomStart: bloom ? bloom.start.toISOString().slice(0, 10) : null,
    bloomEnd: bloom ? bloom.end.toISOString().slice(0, 10) : null,
    bloomSource: bloom?.source ?? null,
    bloomDeviationDays: bloom?.deviationDays ?? null,
    bloomingNow: isBlooming(bloom, now, phase as never),
    honeyYieldKgHa: culture ? [culture.honeyYieldMin, culture.honeyYieldMax] : [0, 0],
    familiesPerHa: culture ? [culture.familiesPerHaMin, culture.familiesPerHaMax] : [0, 0],
    recommend: rec
      ? {
          min: rec.min,
          max: rec.max,
          optimal: rec.optimal,
          honeyPerFamilyKg: rec.honeyPerFamilyKg,
          oversaturation: rec.oversaturation,
          note: rec.note,
        }
      : null,
    treatments,
  }
}

export async function GET(req: Request) {
  await ensureSeeded()
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Нужен вход в систему' }, { status: 401 })
  }
  const url = new URL(req.url)
  const families = Number(url.searchParams.get('families') ?? '0') || 0
  const now = new Date()
  const season = seasonInfo(now)
  const rows = await db.cropField.findMany({
    where: { OR: [{ ownerKey: 'minselhoz' }, { ownerKey: user.id }] },
    orderBy: [{ culture: 'asc' }, { areaHa: 'desc' }],
  })
  const fields = rows.map((r) => toDto(r, now, season.phase))

  // План распределения: не ближе 3 км на том же медоносе или другой медонос
  // с тем же окном цветения → два сорта мёда.
  const distribution =
    families > 0
      ? planDistribution(
          fields.map((f) => ({
            id: f.id,
            name: f.name,
            culture: f.culture,
            distanceKm: f.distanceKm,
            bloom: f.bloomStart && f.bloomEnd ? { start: new Date(f.bloomStart), end: new Date(f.bloomEnd), source: f.bloomSource ?? 'etalon', deviationDays: null } : null,
          })),
          families,
        )
      : []

  return NextResponse.json({
    season: { phase: season.phase, titleKey: season.titleKey, hintKey: season.hintKey },
    fields,
    distribution,
  })
}

export async function POST(req: Request) {
  const guard = await requireBeekeeper()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  try {
    const body = (await req.json()) as {
      culture?: string
      name?: string
      district?: string
      areaHa?: number
      lat?: number
      lon?: number
      sowingDate?: string
      distanceKm?: number
      treatments?: PesticideTreatment[]
    }
    const culture = (body.culture ?? '').trim()
    if (!AGRO_CULTURES[culture]) {
      return NextResponse.json({ error: 'Укажите медонос из справочника' }, { status: 400 })
    }
    const name = (body.name ?? '').trim()
    if (!name || name.length > 80) {
      return NextResponse.json({ error: 'Название поля: от 1 до 80 символов' }, { status: 400 })
    }
    const areaHa = Number(body.areaHa ?? 0)
    if (!Number.isFinite(areaHa) || areaHa <= 0 || areaHa > 100000) {
      return NextResponse.json({ error: 'Площадь поля в гектарах: больше 0' }, { status: 400 })
    }
    let sowing: Date | null = null
    if (body.sowingDate) {
      const d = new Date(`${body.sowingDate}T00:00:00`)
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: 'Некорректная дата посева' }, { status: 400 })
      }
      sowing = d
    }
    const treatments = Array.isArray(body.treatments) ? body.treatments.slice(0, 20) : []
    const distanceKm = Number(body.distanceKm ?? 0)
    const created = await db.cropField.create({
      data: {
        ownerKey: guard.user.id,
        culture,
        name,
        district: (body.district ?? '').trim().slice(0, 80),
        areaHa,
        lat: Number.isFinite(Number(body.lat)) ? Number(body.lat) : null,
        lon: Number.isFinite(Number(body.lon)) ? Number(body.lon) : null,
        sowingDate: sowing,
        distanceKm: Number.isFinite(distanceKm) ? Math.max(0, Math.min(500, distanceKm)) : 0,
        treatmentsJson: JSON.stringify(treatments),
      },
    })
    const now = new Date()
    return NextResponse.json({ ok: true, field: toDto(created, now, seasonInfo(now).phase) })
  } catch (e) {
    console.error('crop-field create error', e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const guard = await requireBeekeeper()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  try {
    const body = (await req.json()) as {
      id?: string
      sowingDate?: string | null
      areaHa?: number
      distanceKm?: number
    }
    if (!body.id) {
      return NextResponse.json({ error: 'Укажите поле' }, { status: 400 })
    }
    const item = await db.cropField.findUnique({ where: { id: body.id } })
    if (!item || item.ownerKey !== guard.user.id) {
      return NextResponse.json({ error: 'Поле не найдено (справочник Минсельхоза изменить нельзя)' }, { status: 404 })
    }
    const data: { sowingDate?: Date | null; areaHa?: number; distanceKm?: number } = {}
    if (body.sowingDate !== undefined) {
      if (body.sowingDate === null || body.sowingDate === '') {
        data.sowingDate = null
      } else {
        const d = new Date(`${body.sowingDate}T00:00:00`)
        if (Number.isNaN(d.getTime())) {
          return NextResponse.json({ error: 'Некорректная дата посева' }, { status: 400 })
        }
        data.sowingDate = d
      }
    }
    if (body.areaHa !== undefined) {
      const a = Number(body.areaHa)
      if (!Number.isFinite(a) || a <= 0 || a > 100000) {
        return NextResponse.json({ error: 'Площадь поля в гектарах: больше 0' }, { status: 400 })
      }
      data.areaHa = a
    }
    if (body.distanceKm !== undefined) {
      const d = Number(body.distanceKm)
      if (!Number.isFinite(d) || d < 0 || d > 500) {
        return NextResponse.json({ error: 'Расстояние: 0–500 км' }, { status: 400 })
      }
      data.distanceKm = d
    }
    await db.cropField.update({ where: { id: body.id }, data })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('crop-field patch error', e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
