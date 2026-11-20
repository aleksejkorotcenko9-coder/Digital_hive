import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
async function main() {
  const rows = await db.apiaryPoint.findMany({
    select: { id: true, userId: true, name: true, lat: true, lon: true, sensorCode: true },
    orderBy: { createdAt: 'asc' },
  })
  const users = await db.user.findMany({ select: { id: true, name: true } })
  const uName = new Map(users.map((u) => [u.id, u.name]))
  for (const r of rows) console.log(`${uName.get(r.userId) ?? r.userId} | ${r.name} | ${r.lat}, ${r.lon} | ${r.sensorCode}`)
  console.log('total:', rows.length)
}
main().finally(() => process.exit(0))
