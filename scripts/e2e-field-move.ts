// Проверка переноса полевых датчиков: точка tmp-пользователя имеет новые
// координаты (поле у Белебея), каталог отдаёт новые позиции, погода работает.
export {} // модульный файл (не глобальный скрипт) — без конфликтов имён в tsc
const BASE = 'http://localhost:3000'
async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'tmp-field-test', password: 'uley2026' }),
  })
  if (!login.ok) throw new Error(`login failed: ${login.status}`)
  const cookie = (login.headers.getSetCookie?.() ?? [login.headers.get('set-cookie') ?? ''])
    .map((c) => c.split(';')[0])
    .join('; ')
  const res = await fetch(`${BASE}/api/map-points`, { headers: { Cookie: cookie } })
  const j: { points: Array<{ name: string; lat: number; lon: number; sensorCode: string; sensor: { tempC: number; weightKg: number } }> } = await res.json()
  const p = j.points.find((x) => x.sensorCode === 'SN-2518-0711')
  const ok = !!p && p.lat === 54.0265 && p.lon === 55.7391 && typeof p.sensor.tempC === 'number'
  console.log(ok
    ? `OK: точка «${p!.name}» у Белебея (${p!.lat}, ${p!.lon}), датчик активен: t=${p!.sensor.tempC}°C, вес=${p!.sensor.weightKg} кг`
    : `FAIL: ${JSON.stringify(j.points)}`)
}
main()
