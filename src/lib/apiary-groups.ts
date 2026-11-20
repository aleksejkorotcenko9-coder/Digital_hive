/**
 * Группировка точек пасеки в «пасеки» — для каскадного выбора
 * «пасека → улей» в разделе «История событий».
 *
 * Одна точка на карте = один улей; пасека — это место, где ульи стоят рядом.
 * Правила группировки (в порядке приоритета):
 *  1) общий префикс имени до тире: «Поле у Белебея — улей 1», «Поле у Белебея —
 *     улей 2» → одна пасека «Поле у Белебея»;
 *  2) зона датчика из каталога (по коду на корпусе): если у датчиков этой зоны
 *     совпадает подсказка места до запятой («Поле за Стерлитамаком, …») —
 *     одна пасека с этим именем, иначе — общее имя зоны;
 *  3) остальное — точка без пары: своя пасека с именем точки.
 */
import { findSensor, type SensorDevice } from './sensor-catalog'

export interface ApiaryGroupDto {
  id: string
  name: string
  pointIds: string[]
}

/** Минимальный набор полей точки для группировки. */
export interface GroupablePoint {
  id: string
  name: string
  sensorCode: string | null
}

const ZONE_LABEL: Record<SensorDevice['zone'], string> = {
  field: 'Пасека в поле',
  city: 'Пасека у города',
  sterlitamak: 'Пасека за Стерлитамаком',
}

/** «Поле у Белебея — улей 1» → «Поле у Белебея»; тире нет — null. */
function namePrefix(name: string): string | null {
  const m = name.match(/^(.+?)\s+—\s+/)
  return m ? m[1].trim() : null
}

/** Подсказка места до первой запятой: «Поле за Стерлитамаком, у лесополосы» → «Поле за Стерлитамаком». */
function notePrefix(note: string): string {
  const i = note.indexOf(',')
  return (i > 0 ? note.slice(0, i) : note).trim()
}

/** Точки пасеки пользователя → список пасек с ульями (стабильный порядок). */
export function groupApiaryPoints(points: GroupablePoint[]): ApiaryGroupDto[] {
  // 1) общий префикс имени (только если он объединяет ≥ 2 точки)
  const byPrefix = new Map<string, string[]>()
  for (const p of points) {
    const pref = namePrefix(p.name)
    if (!pref) continue
    const arr = byPrefix.get(pref) ?? []
    arr.push(p.id)
    byPrefix.set(pref, arr)
  }

  // 2) зоны датчиков из каталога
  const byZone = new Map<SensorDevice['zone'], { ids: string[]; notes: string[] }>()
  for (const p of points) {
    const pref = namePrefix(p.name)
    if (pref && (byPrefix.get(pref)?.length ?? 0) >= 2) continue // уже сгруппирована по имени
    const dev = p.sensorCode ? findSensor(p.sensorCode) : null
    if (!dev) continue
    const rec = byZone.get(dev.zone) ?? { ids: [], notes: [] }
    rec.ids.push(p.id)
    rec.notes.push(notePrefix(dev.note))
    byZone.set(dev.zone, rec)
  }

  const groups: ApiaryGroupDto[] = []
  const used = new Set<string>()

  for (const [pref, ids] of byPrefix) {
    if (ids.length < 2) continue
    groups.push({ id: `p${groups.length}`, name: pref, pointIds: [...new Set(ids)] })
    for (const id of ids) used.add(id)
  }

  for (const [zone, rec] of byZone) {
    const ids = rec.ids.filter((id) => !used.has(id))
    if (ids.length === 0) continue
    const uniqueNotes = [...new Set(rec.notes.filter((n) => n.length > 0))]
    const label = uniqueNotes.length === 1 ? uniqueNotes[0] : ZONE_LABEL[zone]
    groups.push({ id: `z${groups.length}`, name: label, pointIds: ids })
    for (const id of ids) used.add(id)
  }

  // 3) точки без пары — своя пасека
  for (const p of points) {
    if (!used.has(p.id)) groups.push({ id: `s${groups.length}`, name: p.name, pointIds: [p.id] })
  }

  // стабильный порядок — как точки пришли из БД (createdAt asc);
  // финальные идентификаторы g1, g2, … — по итоговому порядку
  const order = new Map(points.map((p, i) => [p.id, i]))
  groups.sort((a, b) => (order.get(a.pointIds[0]) ?? 0) - (order.get(b.pointIds[0]) ?? 0))
  return groups.map((g, i) => ({ ...g, id: `g${i + 1}` }))
}
