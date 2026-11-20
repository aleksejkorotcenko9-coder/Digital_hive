'use client'

/**
 * «Карта пасеки» (Яндекс Карты, JS API 2.1 — без ключа, подключение через src/lib/ymaps.ts).
 * — Карта показывает ульи пользователя (точки ApiaryPoint в БД, привязанные
 *   по кодам датчиков).
 * — Клик по карте выбирает точку: карточка погоды в этом месте (реальные данные
 *   через /api/weather?lat&lon: сейчас + 3 дня, влажность, ветер, давление).
 * — Кнопка «Добавить улей»: вводим код датчика с его корпуса — датчик находится
 *   в каталоге (lib/sensor-catalog.ts), его GPS-позиция сразу показывается на
 *   карте (синяя метка-превью), после подтверждения улей привязывается в этой
 *   точке. Лимита на число ульев нет — один датчик ставится в один улей.
 * — Список точек справа: переключение датчика, удаление, перелёт к точке.
 * Анимации: появление карточки погоды, маркеров, превью GPS и пунктов списка.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CircleAlert, CircleCheck, Cctv, MapPin, MapPinPlus, Move, RefreshCcw, Settings2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { useT } from '@/lib/i18n'
import { seasonPhase } from '@/lib/season'
import { useAppState } from '@/lib/store'
import { cn } from '@/lib/utils'
import { WeatherGlyph } from './weather-glyph'
import type { MapPointDto, WeatherResponse } from '@/lib/api-types'
import { findSensor, normalizeCode, DEFAULT_PLACE, SENSOR_CATALOG } from '@/lib/sensor-catalog'
import { loadYmaps } from '@/lib/ymaps'
import type {
  YmapsApi,
  YmapsCoords,
  YmapsCursorHandle,
  YmapsGeoCollection,
  YmapsGeoObject,
  YmapsMap,
} from '@/lib/ymaps'
import type { SensorDevice } from '@/lib/sensor-catalog'

const ease = { duration: 0.3, ease: 'easeOut' as const }

const SENSOR_LABEL_KEY = { active: 'map.sensor.active', off: 'map.sensor.off', none: 'map.sensor.none' } as const

/** Подписи зон в подсказке диалога привязки. */
const ZONE_LABEL_KEY: Record<SensorDevice['zone'], string> = {
  field: 'map.zone.field',
  city: 'map.zone.city',
  sterlitamak: 'map.zone.sterlitamak',
}

/** HTML-макет метки улья для Яндекс Карт: круг с 🐝 + подпись «N ул.» снизу. */
const HIVE_ICON_TPL =
  '<div style="position:relative;width:34px;height:34px;">' +
  '<div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:{{ properties.color }};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);font-size:16px;">🐝</div>' +
  '<span style="position:absolute;left:50%;top:37px;transform:translateX(-50%);background:#2A1A12;color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:9999px;white-space:nowrap;">{{ properties.label }}</span>' +
  '</div>'

/** Область клика метки: круг + подпись (пиксели относительно точки привязки). */
const HIVE_ICON_SHAPE = { type: 'Rectangle', coordinates: [[-17, -17], [17, 39]] }

/** Подпись метки: «Улей №12» при жёсткой привязке или «N ул.». */
function markerLabel(p: MapPointDto, t: (k: string, v?: Record<string, string | number>) => string): string {
  return p.hiveNumber ? `Улей №${p.hiveNumber}` : t('map.marker.hives', { n: p.hiveCount })
}

/** Режим «ждём клик по карте»: место для нового улья или перенос существующего. */
type PickMode = { kind: 'new' } | { kind: 'move'; id: string; name: string }

export function MapPointsView() {
  const user = useAppState((s) => s.user)
  const { toast } = useToast()
  const t = useT()
  const isBeekeeper = user?.role === 'BEEKEEPER'

  // В диалоге привязки показываем весь каталог: датчики полей и города
  const zones: SensorDevice['zone'][] = ['field', 'city', 'sterlitamak']

  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<YmapsMap | null>(null)
  const ymRef = useRef<YmapsApi | null>(null)
  const pointsColRef = useRef<YmapsGeoCollection | null>(null)
  const selColRef = useRef<YmapsGeoCollection | null>(null)
  const prevColRef = useRef<YmapsGeoCollection | null>(null)
  const markerRefs = useRef<Map<string, YmapsGeoObject>>(new Map())
  const layoutRef = useRef<unknown>(null)
  const clickRef = useRef<(lat: number, lon: number) => void>(() => undefined)
  const cursorRef = useRef<YmapsCursorHandle | null>(null)
  const pickRef = useRef<PickMode | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)

  const [points, setPoints] = useState<MapPointDto[] | null>(null)
  const [selected, setSelected] = useState<{ lat: number; lon: number } | null>(null)
  const [weather, setWeather] = useState<WeatherResponse | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)

  // диалог привязки улья по коду датчика
  const [dialogOpen, setDialogOpen] = useState(false)
  // диалог камер: добавить/исправить камеру на любой точке (п. 6 ТЗ)
  const [camOpen, setCamOpen] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  // номер улья и параметры датчика — жёсткая привязка «Улей №ХХХ» (п. 5 ТЗ)
  const [hiveNumber, setHiveNumber] = useState('')
  const [sensorKind, setSensorKind] = useState<'contact' | 'ir'>('contact')
  const [sensorPlacement, setSensorPlacement] = useState<'center' | 'periphery'>('center')
  // редактор точки (номер улья, тип/место датчика, камера)
  const [editId, setEditId] = useState<string | null>(null)

  // Место улья: по GPS датчика (по умолчанию) или точка, выбранная кликом по карте.
  // pick — режим «ждём клик по карте»: место для нового улья или перенос существующего.
  const [placeMode, setPlaceMode] = useState<'gps' | 'manual'>('gps')
  const [manualPos, setManualPos] = useState<{ lat: number; lon: number } | null>(null)
  const [pick, setPick] = useState<PickMode | null>(null)
  useEffect(() => {
    pickRef.current = pick
  }, [pick])

  // Как только введён код из каталога — сразу знаем GPS-позицию датчика
  const found = useMemo(() => findSensor(code), [code])
  const showNotFound = normalizeCode(code).length >= 4 && !found

  /* ---------- карта (Яндекс Карты) ---------- */
  useEffect(() => {
    let disposed = false
    void (async () => {
      let ym: YmapsApi
      try {
        ym = await loadYmaps()
      } catch (err) {
        if (!disposed) {
          setMapError(err instanceof Error ? err.message : 'map.error.load')
        }
        return
      }
      if (disposed || !containerRef.current) return

      // controls: переключатель «Схема / Спутник / Гибрид» + масштаб и геолокация;
      // suppressMapOpenBlock — без блока «Открыть в Яндекс Картах»
      const map = new ym.Map(containerRef.current, {
        // стартовый центр — запасной; как только точки загрузятся, перелетаем к пасеке
        center: [...DEFAULT_PLACE.center] as YmapsCoords,
        zoom: 12,
        controls: ['zoomControl', 'typeSelector', 'fullscreenControl', 'geolocationControl', 'rulerControl'],
        suppressMapOpenBlock: true,
      })
      map.behaviors.enable('scrollZoom')

      // События меток всплывают до карты: выбираем точку только по клику «в пустое место»
      map.events.add('click', (e) => {
        if (e.get('target') !== map) return
        const coords = e.get('coords') as YmapsCoords | undefined
        if (!coords) return
        clickRef.current(coords[0], coords[1])
      })

      const pointsCol = new ym.GeoObjectCollection()
      const selCol = new ym.GeoObjectCollection()
      const prevCol = new ym.GeoObjectCollection()
      map.geoObjects.add(pointsCol).add(selCol).add(prevCol)

      // HTML-макет метки улья (круг 🐝 + подпись с числом ульев)
      layoutRef.current = ym.templateLayoutFactory.createClass(HIVE_ICON_TPL)

      ymRef.current = ym
      mapRef.current = map
      pointsColRef.current = pointsCol
      selColRef.current = selCol
      prevColRef.current = prevCol
      setMapReady(true)
    })()
    return () => {
      disposed = true
      mapRef.current?.destroy()
      mapRef.current = null
      pointsColRef.current = null
      selColRef.current = null
      prevColRef.current = null
      markerRefs.current.clear()
      setMapReady(false)
    }
  }, [])

  /* ---------- данные точек ---------- */
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/map-points', { cache: 'no-store' })
      if (!res.ok) return
      const j = (await res.json()) as { points: MapPointDto[] }
      setPoints(j.points)
    } catch {
      // карта и погода продолжают работать, точки подтянутся при следующем обновлении
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Первый успешный приход точек: подгоняем камеру так, чтобы КАЖДЫЙ улей был
  // в кадре. Раньше камера летела к среднему центру с зумом 12 — ульи,
  // разбросанные на десятки километров, оставались за кадром и выглядели
  // «непривязанными». Один улей — крупный зум на его место. fittedRef —
  // чтобы не дёргать камеру на каждом опросе.
  const fittedRef = useRef(false)
  useEffect(() => {
    if (!mapReady || fittedRef.current) return
    if (!points || points.length === 0) return
    fittedRef.current = true
    const map = mapRef.current
    if (!map) return
    if (points.length === 1) {
      map.setCenter([points[0].lat, points[0].lon], 13)
      return
    }
    const lats = points.map((p) => p.lat)
    const lons = points.map((p) => p.lon)
    map.setBounds(
      [
        [Math.min(...lats), Math.min(...lons)],
        [Math.max(...lats), Math.max(...lons)],
      ],
      { checkZoomRange: true, zoomMargin: 50, duration: 700 },
    )
  }, [points, mapReady])

  /* ---------- полёт камеры, перенос улья и выбор места ---------- */
  /** Плавный перелёт к точке: зум до 12, полёт Яндекса, затем открываем балун метки. */
  const flyMapTo = useCallback((lat: number, lon: number, balloonId?: string) => {
    const map = mapRef.current
    if (!map) return
    if (map.getZoom() < 12) map.setZoom(12)
    map.panTo([lat, lon], { duration: 700, flying: true })
    if (balloonId) {
      setTimeout(() => markerRefs.current.get(balloonId)?.balloon.open(), 750)
    }
  }, [])

  /** Перенос существующего улья на новое место (клик по карте в режиме переноса). */
  const movePoint = useCallback(
    async (id: string, lat: number, lon: number) => {
      try {
        const res = await fetch(`/api/map-points/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lon }),
        })
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        if (!res.ok) {
          toast({ title: t('map.toast.failed'), description: j.error ?? t('map.toast.server-error'), variant: 'destructive' })
          return
        }
        setPoints((prev) => (prev ? prev.map((x) => (x.id === id ? { ...x, lat, lon } : x)) : prev))
        toast({ title: t('map.toast.moved'), description: t('map.toast.moved-desc', { lat: lat.toFixed(4), lon: lon.toFixed(4) }) })
        flyMapTo(lat, lon, id)
        void load()
      } catch {
        toast({ title: t('map.toast.failed'), description: t('map.toast.network-error'), variant: 'destructive' })
      }
    },
    [toast, flyMapTo, load, t],
  )

  /** Кнопка «Выбрать место на карте»: прячем диалог, ждём клик по карте. */
  const startPickPlace = () => {
    setPick({ kind: 'new' })
    setDialogOpen(false)
  }

  /** Кнопка «Перенести» в карточке улья: ждём клик по карте. */
  const startMove = (p: MapPointDto) => {
    setPick({ kind: 'move', id: p.id, name: p.name })
  }

  const onMapClick = useCallback(
    (lat: number, lon: number) => {
      const cur = pickRef.current
      if (cur?.kind === 'new') {
        // выбрали место для нового улья — возвращаемся в диалог привязки
        setManualPos({ lat, lon })
        setPick(null)
        setDialogOpen(true)
        return
      }
      if (cur?.kind === 'move') {
        setPick(null)
        void movePoint(cur.id, lat, lon)
        return
      }
      // Клик по карте — выбор точки для погоды; место улья задаётся в диалоге
      // (GPS датчика или клик по карте в режиме выбора)
      setSelected({ lat, lon })
    },
    [movePoint],
  )

  useEffect(() => {
    clickRef.current = onMapClick
  }, [onMapClick])

  // Курсор: ладошка в обычном режиме, перекрестие при выборе места на карте
  useEffect(() => {
    if (!mapReady) return
    const map = mapRef.current
    if (!map) return
    cursorRef.current?.remove()
    cursorRef.current = map.cursors.push(pick ? 'crosshair' : 'grab')
  }, [mapReady, pick])

  /* ---------- маркеры точек ---------- */
  useEffect(() => {
    const ym = ymRef.current
    const col = pointsColRef.current
    const layout = layoutRef.current
    if (!mapReady || !ym || !col || layout === null || !points) return
    col.removeAll()
    markerRefs.current.clear()
    for (const p of points) {
      const active = p.sensor.reason === 'active'
      const color = active ? '#22c55e' : p.hasSensor ? '#f59e0b' : '#94a3b8'
      const readings = active
        ? t('map.balloon.readings', {
            temp: String(p.sensor.tempC),
            hum: String(p.sensor.humidityPct),
            weight: String(p.sensor.weightKg),
            noise: String(p.sensor.noiseDb),
          })
        : `<br><i>${t('map.balloon.no-data', { state: t(SENSOR_LABEL_KEY[p.sensor.reason]) })}</i>`
      const pm = new ym.Placemark(
        [p.lat, p.lon],
        {
          color,
          label: markerLabel(p, t),
          balloonContentHeader: p.hiveNumber ? `Улей №${p.hiveNumber} · ${p.name}` : p.name,
          balloonContentBody:
            t('map.balloon.body', {
              code: p.sensorCode ?? '—',
              lat: p.lat.toFixed(4),
              lon: p.lon.toFixed(4),
              state: t(SENSOR_LABEL_KEY[p.sensor.reason]),
            }) + readings,
        },
        {
          iconLayout: layout,
          iconShape: HIVE_ICON_SHAPE,
          iconOffset: [-17, -17],
          hideIconOnBalloonOpen: false,
        },
      )
      col.add(pm)
      markerRefs.current.set(p.id, pm)
    }
  }, [points, mapReady, t])

  /* ---------- маркер выбранной точки ---------- */
  useEffect(() => {
    const ym = ymRef.current
    const col = selColRef.current
    if (!mapReady || !ym || !col) return
    col.removeAll()
    if (!selected) return
    col.add(
      new ym.Placemark(
        [selected.lat, selected.lon],
        { balloonContentBody: t('map.balloon.selected') },
        { preset: 'islands#redDotIcon', iconColor: '#ef4444', hideIconOnBalloonOpen: false },
      ),
    )
  }, [selected, mapReady, t])

  /* ---------- превью позиции: GPS датчика или выбранное на карте место ---------- */
  useEffect(() => {
    const ym = ymRef.current
    const col = prevColRef.current
    const map = mapRef.current
    if (!mapReady || !ym || !col) return
    col.removeAll()
    // Пока ждём клик по карте — превью не показываем
    if (pick) return
    let target: { lat: number; lon: number } | null = null
    let header = ''
    let body = ''
    if (dialogOpen && placeMode === 'manual') {
      if (!manualPos) return
      target = manualPos
      header = t('map.balloon.place-picked')
      body = t('map.balloon.will-place', {
        code: normalizeCode(code) || '—',
        lat: manualPos.lat.toFixed(4),
        lon: manualPos.lon.toFixed(4),
      })
    } else if (dialogOpen && found) {
      // Синяя метка «здесь будет улей»: позиция, которую передаёт датчик
      target = { lat: found.lat, lon: found.lon }
      header = t('map.balloon.gps-header')
      body = t('map.balloon.gps-body', {
        code: found.code,
        model: found.model,
        lat: found.lat.toFixed(4),
        lon: found.lon.toFixed(4),
        note: found.note,
      })
    }
    if (!target) return
    col.add(
      new ym.Placemark(
        [target.lat, target.lon],
        { balloonContentHeader: header, balloonContentBody: body },
        { preset: 'islands#blueCircleDotIcon', iconColor: '#2563eb', hideIconOnBalloonOpen: false },
      ),
    )
    if (map) {
      if (map.getZoom() < 12) map.setZoom(12)
      map.panTo([target.lat, target.lon], { duration: 700, flying: true })
    }
  }, [dialogOpen, found, manualPos, placeMode, mapReady, pick, code, t])

  /* ---------- погода выбранной точки ---------- */
  useEffect(() => {
    if (!selected) {
      setWeather(null)
      return
    }
    const ctl = new AbortController()
    setWeatherLoading(true)
    setWeather(null)
    fetch(`/api/weather?lat=${selected.lat}&lon=${selected.lon}`, {
      signal: ctl.signal,
      cache: 'no-store',
    })
      .then((r) => r.json() as Promise<WeatherResponse>)
      .then((j) => setWeather(j))
      .catch(() => undefined)
      .finally(() => {
        if (!ctl.signal.aborted) setWeatherLoading(false)
      })
    return () => ctl.abort()
  }, [selected])

  /** Плавный перелёт к точке: зум до 12, полёт Яндекса, затем открываем балун метки. */
  // flyMapTo объявлен выше — рядом с переносом улья и выбором места

  /* ---------- привязать улей по коду датчика ---------- */
  const place = async () => {
    if (!found) return
    if (placeMode === 'manual' && !manualPos) return
    setBusy(true)
    try {
      const manual = placeMode === 'manual' && manualPos !== null
      const res = await fetch('/api/map-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sensorCode: found.code,
          name: name.trim(),
          ...(manual && manualPos ? { lat: manualPos.lat, lon: manualPos.lon } : {}),
          ...(hiveNumber ? { hiveNumber: Number(hiveNumber) } : {}),
          sensorKind,
          sensorPlacement,
        }),
      })
      const j = (await res.json().catch(() => ({}))) as { point?: MapPointDto; error?: string }
      if (!res.ok || !j.point) {
        toast({ title: t('map.toast.failed'), description: j.error ?? t('map.toast.server-error'), variant: 'destructive' })
        return
      }
      setPoints((prev) => [...(prev ?? []), j.point as MapPointDto])
      toast({
        title: t('map.toast.added'),
        description: manual
          ? t('map.toast.added-manual', { lat: j.point.lat.toFixed(4), lon: j.point.lon.toFixed(4), code: String(j.point.sensorCode) })
          : t('map.toast.added-gps', { code: String(j.point.sensorCode), lat: j.point.lat.toFixed(4), lon: j.point.lon.toFixed(4) }),
      })
      setDialogOpen(false)
      setCode('')
      setName('')
      setHiveNumber('')
      setSensorKind('contact')
      setSensorPlacement('center')
      setPlaceMode('gps')
      setManualPos(null)
      flyMapTo(j.point.lat, j.point.lon, j.point.id)
    } finally {
      setBusy(false)
    }
  }

  const patchSensor = async (
    p: MapPointDto,
    body: { sensorOn?: boolean; hasSensor?: boolean },
    okMsg: string,
  ) => {
    const res = await fetch(`/api/map-points/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      toast({ title: t('map.toast.failed'), variant: 'destructive' })
      return
    }
    toast({ title: okMsg })
    // оптимистично правим карточку, серверный ответ уточнит детали
    setPoints((prev) =>
      prev
        ? prev.map((x) => {
            if (x.id !== p.id) return x
            const hasSensor = body.hasSensor ?? x.hasSensor
            const sensorOn = body.sensorOn ?? (body.hasSensor !== undefined ? body.hasSensor : x.sensorOn)
            return { ...x, hasSensor, sensorOn }
          })
        : prev,
    )
    void load()
  }

  const removePoint = async (p: MapPointDto) => {
    const res = await fetch(`/api/map-points/${p.id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast({ title: t('map.toast.remove-failed'), variant: 'destructive' })
      return
    }
    setPoints((prev) => prev?.filter((x) => x.id !== p.id) ?? null)
    toast({ title: t('map.toast.removed') })
  }

  const flyTo = (p: MapPointDto) => flyMapTo(p.lat, p.lon, p.id)

  const list = points ?? []
  const summary = useMemo(() => {
    const hives = list.reduce((s, p) => s + p.hiveCount, 0)
    const sensors = list.filter((p) => p.hasSensor && p.sensorOn).length
    return { hives, sensors }
  }, [list])

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Шапка */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#2A1A12]">
            {t('map.title')}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">{t('map.subtitle')}</p>
        </div>
        {isBeekeeper && (
          <div className="flex items-center gap-2">
            {/* Кнопка камер: добавить/исправить камеру на любой точке */}
            <Button
              variant="outline"
              onClick={() => setCamOpen(true)}
              className="gap-1.5 border-red-200 font-bold text-red-700 hover:bg-red-50 active:scale-95"
            >
              <Cctv className="h-4 w-4" />
              {t('map.cameras.button')}
            </Button>
            <Button
              onClick={() => {
                // свежий черновик при открытии из шапки; черновик сохраняется,
                // если диалог прятали ради выбора места на карте
                setCode('')
                setName('')
                setPlaceMode('gps')
                setManualPos(null)
                setDialogOpen(true)
              }}
              className="gap-1.5 bg-gradient-to-r from-red-600 to-orange-500 font-bold active:scale-95"
            >
              <MapPinPlus className="h-4 w-4" />
              {t('map.add-hive')}
            </Button>
          </div>
        )}
      </div>

      {/* Карта + правая колонка */}
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={ease}
          className="relative overflow-hidden rounded-2xl border border-red-100 shadow-sm"
        >
          <div ref={containerRef} className="h-[440px] w-full md:h-[520px]" />
          {/* Режим выбора места: баннер над картой */}
          {pick && (
            <div className="absolute inset-x-3 top-3 z-[30] flex items-center justify-between gap-2 rounded-xl bg-[#2A1A12]/95 px-3 py-2 text-xs font-bold text-white shadow-lg">
              <span>
                {pick.kind === 'new'
                  ? t('map.pick.new')
                  : t('map.pick.move', { name: pick.name })}
              </span>
              <button
                type="button"
                onClick={() => {
                  const wasNew = pick.kind === 'new'
                  setPick(null)
                  if (wasNew) setDialogOpen(true)
                }}
                className="shrink-0 rounded-lg bg-white/10 px-2 py-1 font-bold transition hover:bg-white/20"
              >
                {t('map.cancel')}
              </button>
            </div>
          )}
          {!mapReady && !mapError && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-red-50/60 text-xs font-semibold text-gray-500">
              <RefreshCcw className="h-4 w-4 animate-spin" /> {t('map.loading')}
            </div>
          )}
          {mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-50/90 px-6 text-center text-xs font-semibold text-red-700">
              {mapError === 'map.error.load' ? t('map.error.load') : mapError}
            </div>
          )}
        </motion.div>

        <div className="space-y-4">
          {/* Погода выбранной точки */}
          <Card className="border-red-100 shadow-sm">
            <CardContent className="p-4">
              <h2 className="flex items-center gap-2 text-sm font-bold text-[#2A1A12]">
                <MapPin className="h-4 w-4 text-red-600" />
                {t('map.weather.title')}
                {selected && (
                  <span className="ml-auto text-[10px] font-medium tabular-nums text-gray-400">
                    {selected.lat.toFixed(3)}, {selected.lon.toFixed(3)}
                  </span>
                )}
              </h2>

              {!selected && (
                <p className="mt-3 text-xs text-gray-500">{t('map.weather.hint')}</p>
              )}

              <AnimatePresence mode="wait">
                {selected && (
                  <motion.div
                    key={`${selected.lat.toFixed(4)},${selected.lon.toFixed(4)}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={ease}
                    className="mt-3"
                  >
                    {weatherLoading || !weather ? (
                      <div className="flex items-center justify-center gap-2 py-8 text-xs text-gray-400">
                        <RefreshCcw className="h-4 w-4 animate-spin" /> {t('map.weather.loading')}
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <WeatherGlyph kind={weather.now.icon} className="h-9 w-9" />
                          <div>
                            <p className="text-3xl font-extrabold leading-none text-[#2A1A12]">
                              {Math.round(weather.now.tempC)}°
                            </p>
                            <p className="mt-1 text-xs font-semibold text-gray-500">{weather.now.text}</p>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          {[
                            [t('map.weather.feels'), `${Math.round(weather.now.feelsC)}°`],
                            [t('map.weather.humidity'), `${weather.now.humidityPct} %`],
                            [t('map.weather.wind'), t('map.weather.wind-value', { n: weather.now.windKmh })],
                            [t('map.weather.pressure'), t('map.weather.pressure-value', { n: weather.now.pressureMm })],
                          ].map(([k, v], i) => (
                            <motion.div
                              key={k}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ ...ease, delay: 0.05 * i }}
                              className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50/40 px-2.5 py-1.5 dark:bg-[#2C211C]"
                            >
                              <span className="text-gray-500">{k}</span>
                              <span className="font-bold text-[#2A1A12]">{v}</span>
                            </motion.div>
                          ))}
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-2">
                          {weather.days.slice(0, 3).map((d) => (
                            <div
                              key={d.date}
                              className="flex flex-col items-center gap-0.5 rounded-lg border border-red-100 px-1 py-2 text-center"
                            >
                              <span className="text-[10px] font-bold uppercase text-gray-400">{d.weekday}</span>
                              <WeatherGlyph kind={d.icon} className="h-4 w-4" />
                              <span className="text-[11px] font-bold text-[#2A1A12]">
                                {d.tMax}° <span className="font-medium text-gray-400">{d.tMin}°</span>
                              </span>
                              <span className="text-[9px] text-sky-500">💧 {d.precipProb} %</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>

          {/* Точки с ульями */}
          <Card className="border-red-100 shadow-sm">
            <CardContent className="p-4">
              <h2 className="flex items-center gap-2 text-sm font-bold text-[#2A1A12]">
                {t('map.hives.title')}
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600 dark:bg-[#2C211C]">
                  {list.length}
                </span>
                <span className="ml-auto text-[10px] font-medium tabular-nums text-gray-400">
                  {t('map.hives.summary', { hives: summary.hives, sensors: summary.sensors })}
                </span>
              </h2>

              {!points ? (
                <div className="mt-3 space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-12 animate-pulse rounded-xl bg-red-100/50" />
                  ))}
                </div>
              ) : list.length === 0 ? (
                <p className="mt-3 text-xs text-gray-500">
                  {isBeekeeper ? t('map.hives.empty-keeper') : t('map.hives.empty-viewer')}
                </p>
              ) : (
                <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                  <AnimatePresence initial={false}>
                    {list.map((p, i) => (
                      <motion.li
                        key={p.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ ...ease, delay: Math.min(i * 0.04, 0.2) }}
                        className="relative rounded-xl border border-red-100 bg-white px-3 py-2.5 dark:bg-[#221814]"
                      >
                        <button onClick={() => flyTo(p)} className="min-w-0 flex-1 text-left" aria-label={t('map.hives.show', { name: p.name })}>
                          <p className="truncate text-sm font-bold text-[#2A1A12]">
                            {p.hiveNumber && (
                              <span className="mr-1.5 inline-flex rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-extrabold text-red-700 dark:bg-[#2C211C]">
                                №{p.hiveNumber}
                              </span>
                            )}
                            {p.name}
                          </p>
                          <p className="mt-0.5 text-[11px] text-gray-400">
                            <span className="font-mono font-bold text-gray-500">{p.sensorCode ?? '—'}</span> ·{' '}
                            {t(p.sensorKind === 'ir' ? 'map.dialog.kind.ir' : 'map.dialog.kind.contact')} ·{' '}
                            {t(p.sensorPlacement === 'periphery' ? 'map.dialog.place.periphery' : 'map.dialog.place.center')} ·{' '}
                            {p.lat.toFixed(3)}, {p.lon.toFixed(3)} · {t('map.hives.sensor-word')}{' '}
                            <span
                              className={cn(
                                'font-bold',
                                p.sensor.reason === 'active'
                                  ? 'text-emerald-600'
                                  : p.sensor.reason === 'off'
                                    ? 'text-amber-600'
                                    : 'text-gray-400',
                              )}
                            >
                              {t(SENSOR_LABEL_KEY[p.sensor.reason])}
                            </span>
                          </p>
                        </button>
                        {isBeekeeper && (
                          <button
                            onClick={() => setEditId(editId === p.id ? null : p.id)}
                            className="absolute right-3 top-2.5 rounded-lg p-1 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-[#2C211C]"
                            aria-label={t('map.hives.edit')}
                            title={t('map.hives.edit')}
                          >
                            <Settings2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {isBeekeeper && editId === p.id && (
                          <PointSettingsPanel
                            p={p}
                            t={t}
                            onSaved={() => void load()}
                          />
                        )}
                        {isBeekeeper && (
                          <div className="mt-2 flex items-center justify-between border-t border-red-50 pt-2">
                            {p.hasSensor ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-semibold text-gray-400">{t('map.hives.sensor-word')}</span>
                                <Switch
                                  checked={p.sensorOn}
                                  onCheckedChange={(v) =>
                                    void patchSensor(p, { sensorOn: v }, v ? t('map.toast.sensor-on') : t('map.toast.sensor-off'))
                                  }
                                  aria-label={t('map.aria.sensor-switch')}
                                />
                              </div>
                            ) : (
                              <button
                                onClick={() => void patchSensor(p, { hasSensor: true }, t('map.toast.sensor-installed'))}
                                className="text-[10px] font-bold text-red-600 hover:underline"
                              >
                                {t('map.hives.install-sensor')}
                              </button>
                            )}
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => startMove(p)}
                                aria-label={t('map.aria.move')}
                                title={t('map.aria.move-title')}
                                className="rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-[#2C211C]"
                              >
                                <Move className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => void removePoint(p)}
                                aria-label={t('map.aria.remove')}
                                title={t('map.aria.remove-title')}
                                className="rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-[#2C211C]"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Камера наблюдения на точке (п. 6 ТЗ): снимок/поток с автообновлением */}
          <CameraPanel points={list} t={t} />
        </div>
      </div>

      {/* Диалог привязки улья по коду датчика */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!busy) setDialogOpen(v) }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-[#2A1A12]">{t('map.add-hive')}</DialogTitle>
            <DialogDescription>{t('map.dialog.desc')}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              void place()
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="pt-code">{t('map.dialog.code-label')}</Label>
              <Input
                id="pt-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t('map.dialog.code-placeholder')}
                aria-label={t('map.dialog.code-label')}
                className="font-mono uppercase"
                maxLength={20}
                autoFocus
              />
            </div>

            <AnimatePresence mode="wait">
              {found ? (
                <motion.div
                  key="found"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={ease}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs dark:bg-[#1C2A20]"
                >
                  <p className="flex items-center gap-1.5 font-bold text-emerald-700">
                    <CircleCheck className="h-4 w-4 shrink-0" /> {t('map.dialog.found', { model: found.model })}
                  </p>
                  {placeMode === 'gps' ? (
                    <>
                      <p className="mt-1.5 font-semibold text-[#2A1A12]">
                        {t('map.dialog.gps', { lat: found.lat.toFixed(4), lon: found.lon.toFixed(4) })}
                      </p>
                      <p className="mt-0.5 text-gray-500">{found.note}</p>
                    </>
                  ) : (
                    <p className="mt-1.5 text-gray-500">{t('map.dialog.place-manual-hint')}</p>
                  )}
                </motion.div>
              ) : showNotFound ? (
                <motion.div
                  key="notfound"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={ease}
                  className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs dark:bg-[#2C2416]"
                >
                  <p className="flex items-center gap-1.5 font-bold text-amber-700">
                    <CircleAlert className="h-4 w-4 shrink-0" /> {t('map.dialog.not-found')}
                  </p>
                  <p className="mt-1 text-gray-500">{t('map.dialog.not-found-hint')}</p>
                </motion.div>
              ) : (
                <motion.div
                  key="hint"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={ease}
                  className="text-[11px] leading-relaxed text-gray-400"
                >
                  {zones.map((zone) => (
                    <div key={zone} className="mt-1.5 first:mt-0">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{t(ZONE_LABEL_KEY[zone])}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {SENSOR_CATALOG.filter((s) => s.zone === zone).map((s) => (
                          <button
                            key={s.code}
                            type="button"
                            onClick={() => setCode(s.code)}
                            aria-label={t('map.dialog.fill-code', { code: s.code })}
                            className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold text-gray-600 shadow-sm ring-1 ring-red-100 transition hover:bg-red-50 hover:text-red-700 dark:bg-[#221814] dark:ring-[#2C211C]"
                          >
                            {s.code}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1.5">
              <Label htmlFor="pt-name">
                {t('map.dialog.name-label')} <span className="font-normal text-gray-400">{t('map.dialog.name-optional')}</span>
              </Label>
              <Input
                id="pt-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('map.dialog.name-placeholder')}
                aria-label={t('map.dialog.name-label')}
                maxLength={60}
              />
            </div>

            {/* Жёсткая привязка датчика к номеру улья + тип и место установки (п. 5 ТЗ) */}
            <div className="space-y-1.5">
              <Label htmlFor="pt-hive-no">{t('map.dialog.hiveNo-label')}</Label>
              <Input
                id="pt-hive-no"
                value={hiveNumber}
                onChange={(e) => setHiveNumber(e.target.value.replace(/\D/g, '').slice(0, 4))}
                inputMode="numeric"
                placeholder={t('map.dialog.hiveNo-placeholder')}
              />
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setSensorKind('contact')}
                  className={cn(
                    'rounded-lg border px-2 py-1.5 text-[11px] font-bold transition',
                    sensorKind === 'contact' ? 'border-red-300 bg-red-50 text-red-700 dark:bg-[#2C211C]' : 'border-red-100 bg-white text-gray-500 dark:bg-[#221814]',
                  )}
                >
                  {t('map.dialog.kind.contact')}
                </button>
                <button
                  type="button"
                  onClick={() => setSensorKind('ir')}
                  className={cn(
                    'rounded-lg border px-2 py-1.5 text-[11px] font-bold transition',
                    sensorKind === 'ir' ? 'border-red-300 bg-red-50 text-red-700 dark:bg-[#2C211C]' : 'border-red-100 bg-white text-gray-500 dark:bg-[#221814]',
                  )}
                >
                  {t('map.dialog.kind.ir')}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setSensorPlacement('center')}
                  className={cn(
                    'rounded-lg border px-2 py-1.5 text-[11px] font-bold transition',
                    sensorPlacement === 'center' ? 'border-red-300 bg-red-50 text-red-700 dark:bg-[#2C211C]' : 'border-red-100 bg-white text-gray-500 dark:bg-[#221814]',
                  )}
                >
                  {t('map.dialog.place.center')}
                </button>
                <button
                  type="button"
                  onClick={() => setSensorPlacement('periphery')}
                  className={cn(
                    'rounded-lg border px-2 py-1.5 text-[11px] font-bold transition',
                    sensorPlacement === 'periphery' ? 'border-red-300 bg-red-50 text-red-700 dark:bg-[#2C211C]' : 'border-red-100 bg-white text-gray-500 dark:bg-[#221814]',
                  )}
                >
                  {t('map.dialog.place.periphery')}
                </button>
              </div>
              <p className="text-[10px] leading-relaxed text-gray-400">{t('map.dialog.sensorHint')}</p>
            </div>

            {/* Место улья: по GPS датчика (по умолчанию) или клик по карте */}
            <div className="space-y-1.5">
              <Label>{t('map.dialog.place-label')}</Label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setPlaceMode('gps')}
                  aria-label={t('map.aria.place-gps')}
                  className={cn(
                    'rounded-lg border px-2 py-1.5 text-[11px] font-bold transition',
                    placeMode === 'gps'
                      ? 'border-red-300 bg-red-50 text-red-700 dark:bg-[#2C211C]'
                      : 'border-red-100 bg-white text-gray-500 hover:bg-red-50/60 dark:bg-[#221814] dark:ring-[#2C211C]',
                  )}
                >
                  {t('map.dialog.place-gps')}
                </button>
                <button
                  type="button"
                  onClick={() => setPlaceMode('manual')}
                  aria-label={t('map.aria.place-manual')}
                  className={cn(
                    'rounded-lg border px-2 py-1.5 text-[11px] font-bold transition',
                    placeMode === 'manual'
                      ? 'border-red-300 bg-red-50 text-red-700 dark:bg-[#2C211C]'
                      : 'border-red-100 bg-white text-gray-500 hover:bg-red-50/60 dark:bg-[#221814] dark:ring-[#2C211C]',
                  )}
                >
                  {t('map.dialog.place-manual')}
                </button>
              </div>
              {placeMode === 'manual' &&
                (manualPos ? (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs dark:bg-[#1C2A20]">
                    <p className="font-bold text-emerald-700">
                      {t('map.dialog.place-chosen', { lat: manualPos.lat.toFixed(4), lon: manualPos.lon.toFixed(4) })}
                    </p>
                    <button
                      type="button"
                      onClick={startPickPlace}
                      className="shrink-0 font-bold text-red-600 hover:underline"
                    >
                      {t('map.dialog.change')}
                    </button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" onClick={startPickPlace} className="w-full">
                    <MapPin className="h-4 w-4" /> {t('map.dialog.pick-place')}
                  </Button>
                ))}
              {placeMode === 'gps' && (
                <p className="text-[11px] leading-relaxed text-gray-400">{t('map.dialog.gps-hint')}</p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t('map.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={!found || busy || (placeMode === 'manual' && !manualPos)}
                className="gap-1 bg-gradient-to-r from-red-600 to-orange-500 font-bold"
              >
                <MapPinPlus className="h-4 w-4" /> {t('map.dialog.bind')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Диалог камер: добавить/исправить/убрать камеру на любой точке */}
      <CamerasDialog open={camOpen} onOpenChange={setCamOpen} points={list} t={t} onSaved={() => void load()} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Настройки точки: номер улья, тип и место датчика, камера            */
/* ------------------------------------------------------------------ */

type TFn = (key: string, vars?: Record<string, string | number>) => string

function PointSettingsPanel({ p, t, onSaved }: { p: MapPointDto; t: TFn; onSaved: () => void }) {
  const { toast } = useToast()
  const [hiveNumber, setHiveNumber] = useState(p.hiveNumber ? String(p.hiveNumber) : '')
  const [kind, setKind] = useState<'contact' | 'ir'>(p.sensorKind)
  const [placement, setPlacement] = useState<'center' | 'periphery'>(p.sensorPlacement)
  const [camera, setCamera] = useState(p.cameraUrl ?? '')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/map-points/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hiveNumber: hiveNumber ? Number(hiveNumber) : null,
          sensorKind: kind,
          sensorPlacement: placement,
          cameraUrl: camera.trim() || null,
        }),
      })
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast({ title: t('map.toast.failed'), description: j.error ?? t('map.toast.server-error'), variant: 'destructive' })
        return
      }
      toast({ title: t('map.settings.saved') })
      onSaved()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-2 space-y-2 rounded-xl bg-red-50/60 p-3 dark:bg-[#2C211C]">
      <div className="flex items-center gap-2">
        <Label htmlFor={`hn-${p.id}`} className="w-28 shrink-0 text-[11px] text-gray-600">
          {t('map.dialog.hiveNo-label')}
        </Label>
        <Input
          id={`hn-${p.id}`}
          value={hiveNumber}
          onChange={(e) => setHiveNumber(e.target.value.replace(/\D/g, '').slice(0, 4))}
          inputMode="numeric"
          placeholder="—"
          className="h-8 w-24"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-28 shrink-0 text-[11px] text-gray-600">{t('map.settings.sensorKind')}</span>
        <div className="grid flex-1 grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setKind('contact')}
            className={cn(
              'rounded-lg border px-2 py-1 text-[11px] font-bold transition',
              kind === 'contact' ? 'border-red-300 bg-red-50 text-red-700 dark:bg-[#2C211C]' : 'border-red-100 bg-white text-gray-500 dark:bg-[#221814]',
            )}
          >
            {t('map.dialog.kind.contact')}
          </button>
          <button
            type="button"
            onClick={() => setKind('ir')}
            className={cn(
              'rounded-lg border px-2 py-1 text-[11px] font-bold transition',
              kind === 'ir' ? 'border-red-300 bg-red-50 text-red-700 dark:bg-[#2C211C]' : 'border-red-100 bg-white text-gray-500 dark:bg-[#221814]',
            )}
          >
            {t('map.dialog.kind.ir')}
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-28 shrink-0 text-[11px] text-gray-600">{t('map.settings.sensorPlace')}</span>
        <div className="grid flex-1 grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setPlacement('center')}
            className={cn(
              'rounded-lg border px-2 py-1 text-[11px] font-bold transition',
              placement === 'center' ? 'border-red-300 bg-red-50 text-red-700 dark:bg-[#2C211C]' : 'border-red-100 bg-white text-gray-500 dark:bg-[#221814]',
            )}
          >
            {t('map.dialog.place.center')}
          </button>
          <button
            type="button"
            onClick={() => setPlacement('periphery')}
            className={cn(
              'rounded-lg border px-2 py-1 text-[11px] font-bold transition',
              placement === 'periphery' ? 'border-red-300 bg-red-50 text-red-700 dark:bg-[#2C211C]' : 'border-red-100 bg-white text-gray-500 dark:bg-[#221814]',
            )}
          >
            {t('map.dialog.place.periphery')}
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor={`cam-${p.id}`} className="w-28 shrink-0 text-[11px] text-gray-600">
          {t('map.settings.camera')}
        </Label>
        <Input
          id={`cam-${p.id}`}
          value={camera}
          onChange={(e) => setCamera(e.target.value)}
          placeholder="http://… / /cameras/cam-1.jpg"
          className="h-8 flex-1 text-xs"
        />
      </div>
      <div className="flex justify-end">
        <Button size="sm" disabled={busy} onClick={() => void save()} className="h-8 bg-orange-500 font-bold hover:bg-orange-600">
          {t('map.settings.save')}
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Диалог камер: добавить/исправить/убрать камеру на любой точке        */
/* ------------------------------------------------------------------ */

/**
 * Кнопка «Камеры» в шапке раздела открывает этот диалог: список всех точек
 * с полем URL камеры — сохранить (PATCH) или убрать (пустое поле → null).
 * После сохранения точки перезагружаются, панель камеры сразу показывает снимок.
 */
function CamerasDialog({
  open,
  onOpenChange,
  points,
  t,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  points: MapPointDto[]
  t: TFn
  onSaved: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Контент монтируется только при открытии: черновики URL всегда
          начинаются с фактических значений точек — без setState в эффекте. */}
      {open && (
        <CamerasDialogContent
          points={points}
          t={t}
          onSaved={onSaved}
          onOpenChange={onOpenChange}
        />
      )}
    </Dialog>
  )
}

function CamerasDialogContent({
  points,
  t,
  onSaved,
  onOpenChange,
}: {
  points: MapPointDto[]
  t: TFn
  onSaved: () => void
  onOpenChange: (v: boolean) => void
}) {
  const { toast } = useToast()
  // черновики URL по точкам: снимок на момент открытия диалога
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(points.map((p) => [p.id, p.cameraUrl ?? ''])),
  )

  const save = async (p: MapPointDto, url: string | null) => {
    try {
      const res = await fetch(`/api/map-points/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cameraUrl: url }),
      })
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast({ title: t('map.toast.failed'), description: j.error ?? t('map.toast.server-error'), variant: 'destructive' })
        return
      }
      toast({ title: url ? t('map.camera.saved') : t('map.camera.removed'), description: p.hiveNumber ? `Улей №${p.hiveNumber}` : p.name })
      onSaved()
    } catch {
      toast({ title: t('map.toast.failed'), description: t('map.toast.network-error'), variant: 'destructive' })
    }
  }

  const pointLabel = (p: MapPointDto) => (p.hiveNumber ? `Улей №${p.hiveNumber}` : p.name)
  const camCount = points.filter((p) => p.cameraUrl).length

  return (
    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cctv className="h-4 w-4 text-red-600" />
            {t('map.cameras.title')}
            {points.length > 0 && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600 dark:bg-[#2C211C]">
                {camCount}/{points.length}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>{t('map.cameras.desc')}</DialogDescription>
        </DialogHeader>

        {points.length === 0 ? (
          <p className="py-4 text-center text-xs text-gray-400">{t('map.cameras.empty')}</p>
        ) : (
          <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {points.map((p) => (
              <li key={p.id} className="rounded-xl border border-red-100 bg-white p-3 dark:bg-[#221814]">
                <p className="flex items-center gap-2 text-sm font-bold text-[#2A1A12]">
                  <Cctv className={cn('h-3.5 w-3.5', p.cameraUrl ? 'text-red-500' : 'text-gray-300')} />
                  {pointLabel(p)}
                  {p.cameraUrl && (
                    <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-extrabold text-red-600 dark:bg-[#2C211C]">LIVE</span>
                  )}
                </p>
                <Input
                  value={values[p.id] ?? ''}
                  onChange={(e) => setValues((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  placeholder="http://… / /cameras/cam-1.jpg"
                  aria-label={t('map.cameras.input-aria', { name: pointLabel(p) })}
                  className="mt-2 h-8 text-xs"
                />
                <div className="mt-2 flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!p.cameraUrl}
                    onClick={() => void save(p, null)}
                    className="h-8 text-xs text-gray-500 hover:text-red-600"
                  >
                    {t('map.cameras.remove')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void save(p, (values[p.id] ?? '').trim() || null)}
                    className="h-8 bg-orange-500 font-bold text-white hover:bg-orange-600"
                  >
                    {t('map.cameras.save')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('map.cameras.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
  )
}

/* ------------------------------------------------------------------ */
/* Камера наблюдения на точке пасекы (п. 6 ТЗ)                          */
/* ------------------------------------------------------------------ */

/**
 * Панель камеры: снимок или MJPEG-поток с точки. Демо-камеры (пути
 * /cameras/cam-N.jpg) подставляют сезонный вариант файла: cam-N-winter.jpg
 * зимой и cam-N-summer.jpg в сезон. Реальные URL показываются как есть.
 * Снимок обновляется каждые 10 секунд (cache-buster) — имитация потока.
 */
function CameraPanel({ points, t }: { points: MapPointDto[]; t: TFn }) {
  const withCam = points.filter((p) => p.cameraUrl)
  const [idx, setIdx] = useState(0)
  const [tick, setTick] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setTick((v) => v + 1), 10000)
    return () => clearInterval(timer)
  }, [])

  // При изменении набора точек сбрасываем выбор камеры через «ключ рендера»:
  // вместо setState в эффекте используем производное состояние.
  const camCount = withCam.length
  const camIdx = camCount > 0 ? idx % camCount : 0

  if (withCam.length === 0) {
    return (
      <Card className="border-dashed border-red-100 shadow-sm">
        <CardContent className="flex items-center gap-2 p-3 text-[11px] leading-relaxed text-gray-400">
          <Cctv className="h-4 w-4 shrink-0 text-gray-300" />
          {t('map.camera.none')}
        </CardContent>
      </Card>
    )
  }

  const p = withCam[camIdx]
  const winter = seasonPhase() === 'winter_rest'
  // Демо-камера: подменяем файл на сезонный вариант.
  const url = p.cameraUrl?.startsWith('/cameras/')
    ? p.cameraUrl.replace(/\.jpg$/, winter ? '-winter.jpg' : '-summer.jpg')
    : p.cameraUrl ?? ''
  const bust = `${url}${url.includes('?') ? '&' : '?'}t=${tick}`

  return (
    <Card className="overflow-hidden border-red-100 shadow-sm">
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <Cctv className="h-4 w-4 text-red-500" />
          <p className="min-w-0 flex-1 truncate text-sm font-bold text-[#2A1A12]">
            {p.hiveNumber ? `Улей №${p.hiveNumber}` : p.name}
          </p>
          {withCam.length > 1 && (
            <button
              onClick={() => {
                setIdx((v) => v + 1)
                setFailed(false)
              }}
              className="rounded-lg border border-red-100 px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-50"
            >
              {t('map.camera.next')}
            </button>
          )}
          <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-extrabold text-red-600 dark:bg-[#2C211C]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> LIVE
          </span>
        </div>
        {!failed ? (
           
          <img
            key={`${p.id}-${bust}`}
            src={bust}
            alt={t('map.camera.alt', { name: p.hiveNumber ? `Улей №${p.hiveNumber}` : p.name })}
            className="mt-2 h-44 w-full rounded-xl border border-red-100 object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="mt-2 flex h-44 w-full items-center justify-center rounded-xl border border-red-100 bg-red-50/50 text-xs font-semibold text-gray-400 dark:bg-[#2C211C]">
            {t('map.camera.offline')}
          </div>
        )}
        <p className="mt-1.5 text-[10px] leading-relaxed text-gray-400">{t('map.camera.hint')}</p>
      </CardContent>
    </Card>
  )
}
