'use client'

/**
 * «Датчики ульев»: показания датчиков, установленных в ульи на карте пасеки.
 * Датчик контролирует температуру, массу, шум и влажность внутри улья.
 * Если датчика нет или он выключен — данных об улье нет (честный пустой блок).
 * Точки и статусы — из БД (/api/map-points), те же, что на карте и дашборде.
 * Показания «оживают» на сервере, клиент опрашивает их каждые 5 секунд.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AudioLines,
  Droplets,
  MapPin,
  PowerOff,
  RadioTower,
  RefreshCcw,
  Thermometer,
  Weight,
} from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { useT } from '@/lib/i18n'
import { useAppState } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { MapPointDto } from '@/lib/api-types'

const POLL_MS = 5000

const ease = { duration: 0.3, ease: 'easeOut' as const }

/** Метрика с плавным обновлением значения. */
function Metric({
  icon,
  label,
  value,
  unit,
}: {
  icon: React.ReactNode
  label: string
  value: string
  unit: string
}) {
  return (
    <div className="rounded-xl border border-red-100 bg-red-50/40 px-3 py-2.5 dark:bg-[#2C211C]">
      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
        {icon} {label}
      </p>
      <div className="mt-1 flex items-baseline gap-1">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={value}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={ease}
            className="text-lg font-extrabold tabular-nums text-[#2A1A12]"
          >
            {value}
          </motion.span>
        </AnimatePresence>
        <span className="text-[11px] font-semibold text-gray-400">{unit}</span>
      </div>
    </div>
  )
}

export function SensorsView() {
  const user = useAppState((s) => s.user)
  const { toast } = useToast()
  const t = useT()
  const [points, setPoints] = useState<MapPointDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const aliveRef = useRef(true)

  const isBeekeeper = user?.role === 'BEEKEEPER'

  const load = useCallback(async (silent = false) => {
    if (!silent) setError(null)
    try {
      const res = await fetch('/api/map-points', { cache: 'no-store' })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }
      const j = (await res.json()) as { points: MapPointDto[] }
      if (aliveRef.current) setPoints(j.points)
    } catch (e) {
      if (aliveRef.current) {
        if (!silent || !points) setError(e instanceof Error ? e.message : t('sensors.error.load'))
      }
    }
  }, [points, t])

  useEffect(() => {
    aliveRef.current = true
    void load()
    const timer = setInterval(() => void load(true), POLL_MS)
    return () => {
      aliveRef.current = false
      clearInterval(timer)
    }
  }, [load])

  const patch = async (p: MapPointDto, body: Record<string, unknown>, okMsg: string) => {
    setBusyId(p.id)
    try {
      const res = await fetch(`/api/map-points/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast({ title: t('sensors.toast.failed'), description: j.error ?? t('sensors.toast.server-error'), variant: 'destructive' })
        return
      }
      toast({ title: okMsg })
      await load(true)
    } finally {
      setBusyId(null)
    }
  }

  const removePoint = async (p: MapPointDto) => {
    setBusyId(p.id)
    try {
      const res = await fetch(`/api/map-points/${p.id}`, { method: 'DELETE' })
      if (!res.ok) {
        toast({ title: t('sensors.toast.remove-failed'), variant: 'destructive' })
        return
      }
      setPoints((prev) => prev?.filter((x) => x.id !== p.id) ?? null)
      toast({ title: t('sensors.toast.removed'), description: t('sensors.toast.removed-desc', { name: p.name, n: p.hiveCount }) })
    } finally {
      setBusyId(null)
    }
  }

  if (error && !points) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#2A1A12]">{t('sensors.title')}</h1>
        <Card className="border-red-200">
          <CardContent className="flex flex-col items-start gap-3 p-5">
            <p className="text-sm font-semibold text-red-600">{t('sensors.error.details', { error })}</p>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void load()}>
              <RefreshCcw className="h-3.5 w-3.5" /> {t('sensors.retry')}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const list = points ?? []
  const activeSensors = list.filter((p) => p.hasSensor && p.sensorOn).length
  const totalHives = list.reduce((s, p) => s + p.hiveCount, 0)

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#2A1A12]">
            {t('sensors.title')}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">{t('sensors.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-semibold text-gray-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          {t('sensors.refresh-note')}
        </div>
      </div>

      {/* Сводка */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: t('sensors.summary.points'), value: list.length },
          { label: t('sensors.summary.sensors'), value: activeSensors },
          { label: t('sensors.summary.hives'), value: totalHives },
        ].map((s, i) => (
          <motion.span
            key={s.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...ease, delay: i * 0.06 }}
            className="inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 shadow-sm dark:bg-[#221814]"
          >
            <span className="text-red-600">{s.value}</span> {s.label}
          </motion.span>
        ))}
      </div>

      {/* Карточки точек */}
      {!points ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl bg-red-100/50" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card className="border-dashed border-red-200 bg-red-50/30 dark:bg-[#221814]">
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
            <RadioTower className="h-8 w-8 text-red-300" />
            <p className="font-bold text-[#2A1A12]">{t('sensors.empty.title')}</p>
            <p className="max-w-sm text-sm text-gray-500">{t('sensors.empty.desc')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false}>
            {list.map((p, idx) => {
              const active = p.sensor.reason === 'active'
              const off = p.sensor.reason === 'off'
              return (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ ...ease, delay: Math.min(idx * 0.05, 0.25) }}
                >
                  <Card className={cn('h-full shadow-sm transition-shadow hover:shadow-md', active ? 'border-emerald-200' : 'border-red-100')}>
                    <CardContent className="space-y-3 p-4">
                      {/* Шапка карточки */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-bold text-[#2A1A12]">
                            {p.hiveNumber ? (
                              <>
                                Улей №{p.hiveNumber}
                                <span className="ml-1.5 text-[11px] font-semibold text-gray-400">· {p.name}</span>
                              </>
                            ) : (
                              p.name
                            )}
                          </p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-gray-400">
                            <MapPin className="h-3 w-3" />
                            {p.lat.toFixed(3)}, {p.lon.toFixed(3)}
                            <span className="ml-1 rounded-full bg-red-50 px-1.5 font-bold text-red-600 dark:bg-[#2C211C]">
                              {p.hiveNumber ? `№${p.hiveNumber}` : t('sensors.card.hives', { n: p.hiveCount })}
                            </span>
                            {/* тип и место датчика: сильно влияют на показания (п. 5 ТЗ) */}
                            <span className="rounded-full bg-stone-100 px-1.5 font-semibold text-stone-600 dark:bg-[#2C2416]">
                              {t(p.sensorKind === 'ir' ? 'map.dialog.kind.ir' : 'map.dialog.kind.contact')}
                            </span>
                            <span className="rounded-full bg-stone-100 px-1.5 font-semibold text-stone-600 dark:bg-[#2C2416]">
                              {t(p.sensorPlacement === 'periphery' ? 'map.dialog.place.periphery' : 'map.dialog.place.center')}
                            </span>
                          </p>
                        </div>
                        <span
                          className={cn(
                            'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold',
                            active && 'bg-emerald-100 text-emerald-700',
                            off && 'bg-amber-100 text-amber-700',
                            !active && !off && 'bg-gray-100 text-gray-500',
                          )}
                        >
                          {active && (
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                              <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-600" />
                            </span>
                          )}
                          {active && <RadioTower className="h-3 w-3" />}
                          {off && <PowerOff className="h-3 w-3" />}
                          {active ? t('sensors.status.active') : off ? t('sensors.status.off') : t('sensors.status.none')}
                        </span>
                      </div>

                      {/* Показания или честное «данных нет» */}
                      {active ? (
                        <div className="grid grid-cols-2 gap-2">
                          <Metric
                            icon={<Thermometer className="h-3 w-3 text-red-500" />}
                            label={t('sensors.metric.temp')}
                            value={String(p.sensor.tempC)}
                            unit="°C"
                          />
                          <Metric
                            icon={<Droplets className="h-3 w-3 text-sky-500" />}
                            label={t('sensors.metric.humidity')}
                            value={String(p.sensor.humidityPct)}
                            unit="%"
                          />
                          <Metric
                            icon={<Weight className="h-3 w-3 text-amber-500" />}
                            label={t('sensors.metric.weight')}
                            value={String(p.sensor.weightKg)}
                            unit={t('sensors.unit.kg')}
                          />
                          <Metric
                            icon={<AudioLines className="h-3 w-3 text-purple-500" />}
                            label={t('sensors.metric.noise')}
                            value={String(p.sensor.noiseDb)}
                            unit={t('sensors.unit.db')}
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-red-200 bg-red-50/30 px-3 py-6 text-center dark:bg-[#221814]">
                          <RadioTower className="h-6 w-6 text-red-200" />
                          <p className="text-sm font-bold text-gray-500">{t('sensors.nodata.title')}</p>
                          <p className="text-[11px] leading-relaxed text-gray-400">
                            {off ? t('sensors.nodata.off') : t('sensors.nodata.none')}
                          </p>
                          {isBeekeeper && (
                            <Button
                              size="sm"
                              disabled={busyId === p.id}
                              className="mt-1 gap-1 bg-gradient-to-r from-red-600 to-orange-500 font-bold active:scale-95"
                              onClick={() =>
                                off
                                  ? void patch(p, { sensorOn: true }, t('sensors.toast.sensor-on'))
                                  : void patch(p, { hasSensor: true }, t('sensors.toast.sensor-installed'))
                              }
                            >
                              {off ? t('sensors.action.turn-on') : t('sensors.action.install')}
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Управление */}
                      <div className="flex items-center justify-between border-t border-red-50 pt-2.5">
                        <span className="text-[10px] tabular-nums text-gray-400" suppressHydrationWarning>
                          {t('sensors.updated-at')}{' '}
                          {format(new Date(p.sensor.updatedAt), 'HH:mm:ss')}
                        </span>
                        {isBeekeeper && (
                          <div className="flex items-center gap-2">
                            {p.hasSensor ? (
                              <>
                                <span className="text-[10px] font-semibold text-gray-400">{t('sensors.card.sensor-word')}</span>
                                <Switch
                                  checked={p.sensorOn}
                                  disabled={busyId === p.id}
                                  onCheckedChange={(v) =>
                                    void patch(
                                      p,
                                      { sensorOn: v },
                                      v ? t('sensors.toast.switch-on') : t('sensors.toast.sensor-off'),
                                    )
                                  }
                                  aria-label={t('sensors.aria.sensor-switch')}
                                />
                              </>
                            ) : null}
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busyId === p.id}
                              className="h-7 gap-1 px-2 text-[10px] font-semibold text-gray-400 hover:text-red-600"
                              onClick={() => void removePoint(p)}
                            >
                              {t('sensors.action.remove')}
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      <p className="text-xs leading-relaxed text-gray-400">{t('sensors.footer')}</p>
    </div>
  )
}
