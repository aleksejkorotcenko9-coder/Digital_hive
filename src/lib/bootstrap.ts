/**
 * Первичное наполнение базы при первом запуске (идемпотентно):
 * API-ключ для приёма телеметрии. Пользователи регистрируются сами
 * с подтверждением email; ульи привязываются по кодам датчиков на карте.
 * Вызывается из API-маршрутов и из prisma/seed.ts.
 */
import { randomBytes } from 'node:crypto'
import { db } from './db'

let done = false

export async function ensureSeeded(): Promise<void> {
  if (done) return
  done = true
  try {
    // Старые аккаунты без email (до введения подтверждения почты) помечаем
    // подтверждёнными, чтобы их вход продолжал работать. Новые регистрации
    // с email не затрагиваются.
    await db.user.updateMany({
      where: { email: null, emailVerified: null },
      data: { emailVerified: new Date() },
    })

    // API-ключ для приёма телеметрии от датчиков
    await db.appSetting.upsert({
      where: { key: 'apiKey' },
      update: {},
      create: { key: 'apiKey', value: randomBytes(16).toString('hex') },
    })

    // Справочник Минсельхоза области: посевные площади медоносов, даты посева,
    // обработки пестицидами (для раздела «Кочёвка» и расчёта цветения ИИ).
    await seedCropFields()

    // Риски площадок кочёвки: правим seeded-строки под реальную агрономию —
    // ЛЭП и грунтовки рисками не являются (п.2 ТЗ), вместо них водоём,
    // жилой массив, кондитерка и химические обработки.
    await seedMigrationRisks()

    // Демо-камеры наблюдения: первые две точки без камеры получают снимки
    // из /public/cameras (CameraPanel подставляет сезонный вариант файла).
    const usersWithPoints = await db.user.findMany({
      select: { id: true, apiaryPoints: { orderBy: { createdAt: 'asc' }, select: { id: true, cameraUrl: true } } },
    })
    for (const u of usersWithPoints) {
      const pointsWithoutCam = u.apiaryPoints.filter((p) => !p.cameraUrl)
      if (pointsWithoutCam.length === 0) continue
      const demoUrls = ['/cameras/cam-1.jpg', '/cameras/cam-2.jpg']
      const taken = new Set(u.apiaryPoints.map((p) => p.cameraUrl).filter((x): x is string => Boolean(x)))
      let slot = 0
      for (const p of pointsWithoutCam) {
        while (slot < demoUrls.length && taken.has(demoUrls[slot])) slot++
        if (slot >= demoUrls.length) break
        await db.apiaryPoint.update({ where: { id: p.id }, data: { cameraUrl: demoUrls[slot] } })
        taken.add(demoUrls[slot])
        slot++
      }
    }
  } catch (e) {
    done = false // позволяем повторить при следующем запросе
    throw e
  }
}

/* ------------------------------------------------------------------ */
/* Сиды: поля Минсельхоза и риски площадок кочёвки                     */
/* ------------------------------------------------------------------ */

interface SeedCropField {
  culture: string
  name: string
  district: string
  areaHa: number
  lat: number
  lon: number
  sowingDate: string | null // 'YYYY-MM-DD' | null — не сеется (лес)
  distanceKm: number
  treatments: Array<{ date: string; drug: string; hazardClass: string; note: string }>
}

const CROP_FIELDS: SeedCropField[] = [
  {
    culture: 'buckwheat',
    name: 'Гречишное поле «Заречное»',
    district: 'Рыбновский район',
    areaHa: 240,
    lat: 54.786,
    lon: 39.622,
    sowingDate: '2026-05-18',
    distanceKm: 6.5,
    treatments: [
      { date: '2026-06-10', drug: 'Инсектицид (краевые полосы от гречишного долгоносика)', hazardClass: '3', note: 'только края поля, до цветения' },
    ],
  },
  {
    culture: 'buckwheat',
    name: 'Гречишное поле «Южное»',
    district: 'Рязанский район',
    areaHa: 180,
    lat: 54.552,
    lon: 39.81,
    sowingDate: '2026-05-25',
    distanceKm: 11.2,
    treatments: [],
  },
  {
    culture: 'linden',
    name: 'Липовый массив «Дубрава»',
    district: 'Рязанский район',
    areaHa: 90,
    lat: 54.68,
    lon: 39.995,
    sowingDate: null, // лесной массив, посева нет
    distanceKm: 8.0,
    treatments: [],
  },
  {
    culture: 'melilot',
    name: 'Донниковое поле «Пойма Оки»',
    district: 'Старожиловский район',
    areaHa: 150,
    lat: 54.42,
    lon: 39.72,
    sowingDate: '2025-05-12', // двулетник: цветение на следующий год
    distanceKm: 14.0,
    treatments: [],
  },
  {
    culture: 'sunflower',
    name: 'Подсолнечник «Полевой»',
    district: 'Рыбновский район',
    areaHa: 320,
    lat: 54.81,
    lon: 39.5,
    sowingDate: '2026-05-20',
    distanceKm: 5.2,
    treatments: [
      { date: '2026-05-22', drug: 'Протравитель семян (до всходов)', hazardClass: '2', note: 'на поле, до цветения — безопасно' },
      { date: '2026-07-28', drug: 'Фунгицид от белой гнили', hazardClass: '3', note: 'до массового цветения — вывоз до этой даты' },
    ],
  },
  {
    culture: 'sainfoin',
    name: 'Эспарцет «Степной»',
    district: 'Кораблинский район',
    areaHa: 110,
    lat: 54.12,
    lon: 39.65,
    sowingDate: '2024-08-30',
    distanceKm: 18.5,
    treatments: [],
  },
  {
    culture: 'phacelia',
    name: 'Фацелия «Пчелоучасток»',
    district: 'Рыбновский район',
    areaHa: 45,
    lat: 54.76,
    lon: 39.7,
    sowingDate: '2026-05-01',
    distanceKm: 2.5,
    treatments: [],
  },
]

async function seedCropFields(): Promise<void> {
  const existing = await db.cropField.findMany({ where: { ownerKey: 'minselhoz' }, select: { name: true } })
  const known = new Set(existing.map((e) => e.name))
  for (const f of CROP_FIELDS) {
    if (known.has(f.name)) continue
    await db.cropField.create({
      data: {
        ownerKey: 'minselhoz',
        culture: f.culture,
        name: f.name,
        district: f.district,
        areaHa: f.areaHa,
        lat: f.lat,
        lon: f.lon,
        sowingDate: f.sowingDate ? new Date(`${f.sowingDate}T00:00:00`) : null,
        distanceKm: f.distanceKm,
        treatmentsJson: JSON.stringify(f.treatments),
      },
    })
  }
}

/** Обновление рисков существующих площадок кочёвки (п. 2–3 ТЗ). */
async function seedMigrationRisks(): Promise<void> {
  const updates: Array<{ name: string; risks: string; bloomWindow: string }> = [
    {
      name: 'Гречишный лог',
      risks: 'Большой пруд между пасекой и массивом (2,5 км) — пчёлы с грузом гибнут на перелёте; в 1 км жилой массив, спрос на мёд и жалобы летом',
      bloomWindow: '20 июня — 15 июля',
    },
    {
      name: 'Липовая роща (ур. Дубрава)',
      risks: 'Кондитерское предприятие в 2 км от точки — отвлекающий фактор для лётной пчелы; подъезд только по просёлку (не риск, учесть при перевозке)',
      bloomWindow: '20 июня — 10 июля',
    },
    {
      name: 'Донниковое поле (Заозёрное)',
      risks: 'Химическая обработка соседнего поля (пестициды, класс опасности 2) — 28 июля в 1,1 км; весной возможна повторная обработка гербицидом',
      bloomWindow: '20 июня — 20 августа',
    },
  ]
  for (const u of updates) {
    await db.migrationSite.updateMany({
      where: { name: u.name },
      data: { risks: u.risks, bloomWindow: u.bloomWindow },
    })
  }
}
