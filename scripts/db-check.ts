/** Быстрый осмотр БД: ульи, точки, измерения. */
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
const hives = await db.hive.findMany({ include: { _count: { select: { measurements: true } } } })
console.log('HIVES:', hives.map(h => `${h.number}:${h.name}(${h._count.measurements})`).join(', '))
const pts = await db.apiaryPoint.findMany({ orderBy: { createdAt: 'asc' } })
console.log('POINTS:', pts.map(p => `${p.userId.slice(-6)}:${p.name}:${p.sensorCode}:${p.lat.toFixed(3)},${p.lon.toFixed(3)}`).join(' | '))
console.log('MEASUREMENTS total:', await db.measurement.count())
process.exit(0)
