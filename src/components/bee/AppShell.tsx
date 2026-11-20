'use client'

/**
 * Каркас приложения в стиле референса: белое боковое меню с логотипом,
 * красной кнопкой «+ Новый улей» и профилем внизу; на мобильных — верхняя
 * панель и нижняя навигация. Здесь же смонтированы: диалог профиля,
 * диалог добавления улья, опрос напоминаний (тосты + системные уведомления).
 */
import { useEffect, useMemo, useState } from 'react'
import {
  AlarmClock,
  BellRing,
  BookOpen,
  Database,
  History,
  LayoutDashboard,
  Map,
  MapPinned,
  MessageSquareText,
  Plus,
  RadioTower,
  RefreshCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { AmbientBackdrop, HexLogo, HoneycombDecor } from './decor'
import { FlyingBees } from './FlyingBees'
import { ProfileDialog, ProfileTrigger, UserAvatar } from './ProfileDialog'
import { RemindersBell } from './RemindersBell'
import { useAppState, type View } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { hiveStatus } from '@/lib/hive-model'
import { hiveWord, pointsToHives } from '@/lib/hive-sync'
import { userLabel } from '@/lib/api-types'
import type { MapPointDto } from '@/lib/api-types'
import { useReminders } from '@/lib/use-reminders'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

const NAV: Array<{ id: View; labelKey: string; shortKey: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', labelKey: 'nav.dashboard', shortKey: 'nav.dashboard.short', icon: LayoutDashboard },
  { id: 'agent', labelKey: 'nav.agent', shortKey: 'nav.agent.short', icon: MessageSquareText },
  { id: 'map', labelKey: 'nav.map', shortKey: 'nav.map.short', icon: Map },
  { id: 'sensors', labelKey: 'nav.sensors', shortKey: 'nav.sensors.short', icon: RadioTower },
  { id: 'history', labelKey: 'nav.history', shortKey: 'nav.history.short', icon: History },
  { id: 'migration', labelKey: 'nav.migration', shortKey: 'nav.migration.short', icon: MapPinned },
  { id: 'data', labelKey: 'nav.data', shortKey: 'nav.data.short', icon: Database },
  { id: 'reminders', labelKey: 'nav.reminders', shortKey: 'nav.reminders.short', icon: AlarmClock },
  { id: 'about', labelKey: 'nav.about', shortKey: 'nav.about.short', icon: BookOpen },
]

/** Счётчик активных напоминаний: просроченные + ближайшие 7 дней. */
function useReminderBadge(): number {
  const reminders = useAppState((s) => s.reminders)
  const user = useAppState((s) => s.user)
  return useMemo(() => {
    if (!user) return 0
    const now = Date.now()
    return reminders.filter(
      (r) => !r.done && new Date(r.remindAt).getTime() <= now + 7 * 86400000,
    ).length
  }, [reminders, user])
}

function NewHiveDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [number, setNumber] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()
  const t = useT()

  const create = async () => {
    const num = Number(number)
    if (!Number.isInteger(num) || num < 1 || num > 999) {
      toast({ title: t('common.hiveN'), description: t('side.newHive'), variant: 'destructive' })
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/hives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: num, familyNote: note.trim() }),
      })
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast({ title: t('common.cancel'), description: j.error ?? t('shell.serverError'), variant: 'destructive' })
        return
      }
      toast({ title: `${t('common.hiveN', { n: num })} ✓`, description: t('side.newHive') })
      onOpenChange(false)
      setNumber('')
      setNote('')
      const store = useAppState.getState()
      void store.loadReal()
      store.setView('data')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-[#2A1A12]">{t('side.newHive')}</DialogTitle>
          <DialogDescription>{t('dash.addHive')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            type="number"
            min={1}
            max={999}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder={t('shell.hiveNumberPh')}
            aria-label={t('shell.hiveNumberAria')}
          />
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('shell.notePh')}
            aria-label={t('shell.noteAria')}
            maxLength={200}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void create()} disabled={busy || !number} className="gap-1 bg-red-600 hover:bg-red-700">
            <Plus className="h-4 w-4" /> {t('shell.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const view = useAppState((s) => s.view)
  const setView = useAppState((s) => s.setView)
  const user = useAppState((s) => s.user)
  const setProfileOpen = useAppState((s) => s.setProfileOpen)
  const mode = useAppState((s) => s.mode)
  const t = useT()

  // опрос напоминаний + оповещения по наступлении срока
  useReminders()
  const reminderBadge = useReminderBadge()
  const [hiveDialogOpen, setHiveDialogOpen] = useState(false)

  // Синхронизация с картой: число ульев и состояние датчиков — из /api/map-points
  // (те же точки, что на карте, вкладке «Датчики» и в контексте агента).
  const [mapPoints, setMapPoints] = useState<MapPointDto[] | null>(null)
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const res = await fetch('/api/map-points', { cache: 'no-store' })
        if (!res.ok) return
        const j = (await res.json()) as { points: MapPointDto[] }
        if (alive) setMapPoints(j.points)
      } catch {
        // повтор на следующем такте
      }
    }
    void load()
    const timer = setInterval(() => void load(), 10000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  // число срочных сигналов: улья с риском роения по точкам карты
  const urgentCount = useMemo(() => {
    if (!mapPoints) return 0
    const hives = pointsToHives(mapPoints)
    return hives.filter((h) => hiveStatus(h, hives).level === 'risk').length
  }, [mapPoints])

  // системная тема: если выбрана «системная», слушаем смену темы ОС
  const theme = useAppState((s) => s.theme)
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => void import('@/lib/store').then((m) => m.applyTheme('system'))
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  const role = user?.role === 'HELPER' ? t('profile.role.helper') : t('profile.role.beekeeper')

  const urgentChip =
    urgentCount > 0 ? (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 dark:bg-[#331B16]">
        <BellRing className="animate-heartbeat h-3.5 w-3.5" /> {t('side.urgent', { n: urgentCount })}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-[#16302A]">
        {t('side.noUrgent')}
      </span>
    )

  const navButton = (item: (typeof NAV)[number], compact = false, idx = 0) => {
    const Icon = item.icon
    const active = view === item.id
    const label = t(compact ? item.shortKey : item.labelKey)
    return (
      <motion.button
        key={item.id}
        onClick={() => setView(item.id)}
        aria-current={active ? 'page' : undefined}
        // каскадное появление меню (только десктоп) + пружинный отклик
        initial={compact ? false : { opacity: 0, x: -14 }}
        animate={{ opacity: 1, x: 0 }}
        transition={compact ? { duration: 0.15 } : { delay: 0.03 * idx, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          'nav-item relative',
          compact
            ? 'flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1.5 text-[10px] font-semibold transition-colors'
            : 'flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors',
          active
            ? compact
              ? 'text-red-600'
              : 'text-white'
            : compact
              ? 'text-gray-400 hover:text-gray-600'
              : 'text-gray-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-[#2C211C]',
        )}
      >
        {/* анимированная пилюля активного пункта: плавно переезжает между пунктами */}
        {active && !compact && (
          <motion.span
            layoutId="nav-pill-desktop"
            className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-600 to-orange-500 shadow-md shadow-red-100"
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          />
        )}
        <span
          className={cn(
            compact
              ? 'flex h-8 w-8 items-center justify-center rounded-lg transition-transform duration-200'
              : 'nav-ico relative flex items-center',
            active && compact ? 'bg-red-50 dark:bg-[#2C211C]' : '',
            compact && active ? 'scale-110' : '',
          )}
        >
          <Icon className={cn(compact ? 'h-4 w-4' : 'h-4.5 w-4.5')} />
          {item.id === 'reminders' && reminderBadge > 0 && (
            <span
              key={reminderBadge}
              className={cn(
                'pop-in absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-extrabold',
                active ? 'bg-white text-red-600 ring-1 ring-red-200' : 'bg-red-600 text-white',
              )}
            >
              {reminderBadge > 9 ? '9+' : reminderBadge}
            </span>
          )}
        </span>
        <span className="relative">{label}</span>
      </motion.button>
    )
  }

  return (
    <div className="flex min-h-screen bg-[#FAF6F3]">
      {/* Амбиент-фон: плывущие тёплые пятна + сетка-соты (за контентом) */}
      <AmbientBackdrop />

      {/* Сайдбар (десктоп) */}
      <aside className="sticky top-0 z-10 hidden h-screen w-[248px] shrink-0 flex-col bg-white px-3.5 py-4 lg:flex dark:bg-[#221814]">
        <button onClick={() => setView('dashboard')} className="mb-4 flex items-center gap-2.5 px-1.5 text-left" aria-label={t('shell.goHomeAria')}>
          <HexLogo className="h-9 w-9 transition-transform duration-300 hover:rotate-12 hover:scale-110" />
          <span className="text-base font-extrabold leading-tight tracking-tight text-[#2A1A12]">
            {t('shell.appTitle')}
          </span>
        </button>

        <nav className="space-y-1" aria-label={t('shell.navMainAria')}>
          {NAV.map((item, idx) =>
            item.id === 'reminders' ? (
              <div key={item.id} className="flex items-center gap-1.5">
                <div className="min-w-0 flex-1">{navButton(item, false, idx)}</div>
                <RemindersBell />
              </div>
            ) : (
              navButton(item, false, idx)
            ),
          )}
        </nav>

        {user?.role === 'BEEKEEPER' && (
          <Button
            onClick={() => setHiveDialogOpen(true)}
            className="animate-gradient mt-4 w-full gap-1.5 bg-gradient-to-r from-red-600 to-orange-500 font-bold shadow-md shadow-red-100 hover:from-red-700 hover:to-orange-600"
          >
            <Plus className="h-4 w-4" /> {t('side.newHive')}
          </Button>
        )}

        <div className="mt-4 px-1">{urgentChip}</div>

        <div className="mt-3 rounded-2xl border border-red-100 bg-red-50/40 p-3 dark:bg-[#2C211C]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-[#2A1A12]">
              {mode === 'demo' ? t('side.apiaryDemo') : t('side.apiary')}
            </p>
            {mapPoints && mapPoints.some((p) => p.hasSensor && p.sensorOn) && (
              <span className="pop-in inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">
                <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {t('side.sensorsOn')}
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
            {mapPoints && mapPoints.length > 0 ? (
              <>
                {mapPoints.length} {hiveWord(mapPoints.length)} · {t('side.gps')}
              </>
            ) : (
              <>{t('side.bindHint')}</>
            )}
          </p>
          {mapPoints && mapPoints.length > 0 && (
            <div className="mt-2.5 flex items-center justify-between rounded-lg bg-white px-2.5 py-2 dark:bg-[#221814]">
              <span className="text-[11px] font-semibold text-red-700">
                {t('side.sensorsBound', { n: mapPoints.filter((p) => p.hasSensor && p.sensorOn).length, m: mapPoints.length })}
              </span>
              <span className="flex gap-1">
                {mapPoints.map((p) => (
                  <span
                    key={p.id}
                    title={p.name}
                    className={cn(
                      'h-2 w-2 rounded-full',
                      p.hasSensor && p.sensorOn
                        ? 'bg-emerald-500'
                        : p.hasSensor
                          ? 'bg-amber-400'
                          : 'bg-gray-300',
                    )}
                  />
                ))}
              </span>
            </div>
          )}
        </div>

        <HoneycombDecor className="mt-auto hidden h-20 w-24 opacity-70" />

        {user && (
          <div className="mt-3 border-t border-red-50 pt-2">
            <ProfileTrigger user={user} onClick={() => setProfileOpen(true)} />
          </div>
        )}
      </aside>

      {/* Основная колонка */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        {/* Верхняя панель (мобайл) */}
        <header className="sticky top-0 z-40 border-b border-red-100 bg-white/90 backdrop-blur lg:hidden dark:bg-[#221814]/90">
          <div className="flex h-14 items-center gap-2 px-3">
            <button onClick={() => setView('dashboard')} className="flex items-center gap-2" aria-label={t('shell.goHomeAria')}>
              <HexLogo className="h-8 w-8" />
              <span className="text-sm font-extrabold tracking-tight text-[#2A1A12]">{t('shell.appTitle')}</span>
            </button>
            <div className="ml-auto flex items-center gap-2">
              <RemindersBell />
              {user && (
                <button onClick={() => setProfileOpen(true)} aria-label={t('shell.profileAria')}>
                  <UserAvatar user={user} className="h-9 w-9 text-sm" />
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 pb-24 pt-5 md:px-6 md:pt-6 lg:pb-8">{children}</main>

        {/* Футер */}
        <footer className="mt-auto border-t border-red-100 bg-white pb-[calc(env(safe-area-inset-bottom)+4.5rem)] px-4 py-4 text-xs text-gray-400 lg:pb-0 dark:bg-[#221814]">
          <div className="flex max-w-[1440px] flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <p>{t('footer.tagline')}</p>
            <p className="font-medium text-gray-500">{t('footer.disclaimer')}</p>
          </div>
        </footer>
      </div>

      {/* Нижняя навигация (мобайл) */}
      <nav
        aria-label={t('shell.navAria')}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-red-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden dark:bg-[#221814]/95"
      >
        <div className="mx-auto grid max-w-md grid-cols-9 px-0.5 py-1.5">
          {NAV.map((item, idx) => navButton(item, true, idx))}
        </div>
      </nav>

      {/* Диалоги */}
      <ProfileDialog />
      {user?.role === 'BEEKEEPER' && (
        <NewHiveDialog open={hiveDialogOpen} onOpenChange={setHiveDialogOpen} />
      )}

      {/* Редко пролетающие пчёлки — декорация поверх интерфейса (reduced-motion отключает) */}
      <FlyingBees />
    </div>
  )
}
