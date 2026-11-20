import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
const rows = await db.apiaryPoint.findMany({ select: { id: true, name: true, lat: true, lon: true, hiveCount: true, hasSensor: true, sensorOn: true, sensorCode: true, userId: true }, orderBy: { createdAt: 'asc' } })
console.log(JSON.stringify(rows, null, 1))
await db.$disconnect()
