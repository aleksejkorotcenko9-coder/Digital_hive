'use client'

/**
 * Диалог профиля и настроек (открывается из сайдбара/шапки):
 *  — фото профиля: загрузка с сжатием до 256px JPEG (data-URL в базу);
 *  — отображаемое имя;
 *  — тема: светлая / тёмная / системная (применяется сразу);
 *  — язык интерфейса: русский, английский, французский, казахский,
 *    белорусский, китайский (переключается мгновенно);
 *  — город пасеки: влияет на погоду, точку можно поставить прямо на карте
 *    (как место пасеки) — Яндекс Карты + обратное геокодирование;
 *  — выход из аккаунта.
 */
import { useEffect, useRef, useState } from 'react'
import {
  Bird,
  Camera,
  CheckCircle2,
  Globe,
  LogOut,
  Map,
  MapPin,
  Monitor,
  Moon,
  Sun,
  Trash2,
  UserRound,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useAppState, applyTheme, type ApiaryCity, type Theme } from '@/lib/store'
import { LANGS, tr, useT, type Lang } from '@/lib/i18n'
import { loadYmaps, type YmapsCoords, type YmapsEvent, type YmapsMap } from '@/lib/ymaps'
import { userLabel, type SafeUser } from '@/lib/api-types'
import { cn } from '@/lib/utils'

const ROLE_LABEL_KEY = { BEEKEEPER: 'profile.role.beekeeper', HELPER: 'profile.role.helper' } as const

const THEMES: Array<{ id: Theme; labelKey: string; icon: typeof Sun }> = [
  { id: 'light', labelKey: 'profile.theme.light', icon: Sun },
  { id: 'dark', labelKey: 'profile.theme.dark', icon: Moon },
  { id: 'system', labelKey: 'profile.theme.system', icon: Monitor },
]

/** Сжимает картинку до 256×256 JPEG data-URL (без внешних библиотек). */
function fileToAvatar(
  file: File,
  msgs: { read: string; image: string; canvas: string },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(msgs.read))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error(msgs.image))
      img.onload = () => {
        const size = 256
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error(msgs.canvas))
          return
        }
        // кроп по центру + масштаб до квадрата
        const minSide = Math.min(img.width, img.height)
        const sx = (img.width - minSide) / 2
        const sy = (img.height - minSide) / 2
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

/* ------------------------------------------------------------------ */
/* Выбор города на карте (Яндекс Карты + геокодирование)               */
/* ------------------------------------------------------------------ */

function CityPickerDialog({
  open,
  onOpenChange,
  city,
  onPick,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  city: ApiaryCity
  onPick: (c: ApiaryCity) => void
}) {
  const t = useT()
  const lang = useAppState((s) => s.lang)
  const mapRef = useRef<HTMLDivElement>(null)
  const [picked, setPicked] = useState<ApiaryCity | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!open) return
    let destroyed = false
    let map: YmapsMap | null = null

    const init = async () => {
      try {
        const ym = await loadYmaps()
        if (destroyed) return
        // сброс предыдущего выбора — уже после await, без каскадных рендеров
        setPicked(null)
        setFailed(false)
        setLoading(true)
        if (!mapRef.current) return
        map = new ym.Map(mapRef.current, {
          center: [city.lat, city.lon],
          zoom: 9,
          controls: ['zoomControl', 'searchControl'],
        })
        map.events.add('click', (e: YmapsEvent) => {
          const coords = e.get('coords') as YmapsCoords | undefined
          if (!coords || !map) return
          map.geoObjects.removeAll()
          map.geoObjects.add(new ym.Placemark(coords, {}, { preset: 'islands#redDotIcon' }))
          setPicked({ name: '…', lat: coords[0], lon: coords[1] })
          // обратное геокодирование через свой API (BigDataCloud — без ключа):
          // геокодер Яндекса в этой среде недоступен без ключа
          fetch(`/api/geocode?lat=${coords[0]}&lon=${coords[1]}&lang=${lang}`)
            .then((r) => r.json() as Promise<{ name: string; country?: string }>)
            .then((j) => {
              if (destroyed) return
              setPicked({ name: j.name || `${coords[0].toFixed(3)}, ${coords[1].toFixed(3)}`, lat: coords[0], lon: coords[1] })
            })
            .catch(() => {
              if (!destroyed) {
                setPicked({ name: `${coords[0].toFixed(3)}, ${coords[1].toFixed(3)}`, lat: coords[0], lon: coords[1] })
              }
            })
        })
        setLoading(false)
      } catch {
        if (!destroyed) {
          setFailed(true)
          setLoading(false)
        }
      }
    }

    void init()

    return () => {
      destroyed = true
      try {
        map?.destroy()
      } catch {
        // карта уже уничтожена
      }
    }
  }, [open, city.lat, city.lon])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-left text-[15px] text-[#2A1A12]">
            <Map className="h-4 w-4 text-red-500" /> {t('profile.city.pickTitle')}
          </DialogTitle>
          <DialogDescription className="text-left">{t('profile.city.pickDesc')}</DialogDescription>
        </DialogHeader>

        <div className="relative h-[360px] overflow-hidden rounded-2xl border border-red-100">
          <div ref={mapRef} className="h-full w-full" />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-50/70">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-red-200 border-t-red-600" />
            </div>
          )}
          {failed && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-50/80 p-6 text-center text-sm font-semibold text-gray-500">
              {t('dash.weather.error')}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="inline-flex items-center gap-2 text-sm font-bold text-[#2A1A12]">
            <MapPin className="h-4 w-4 text-red-500" />
            {picked ? picked.name : city.name}
            {picked && (
              <span className="text-[11px] font-semibold text-gray-400">
                {picked.lat.toFixed(3)}, {picked.lon.toFixed(3)}
              </span>
            )}
          </p>
          <Button
            onClick={() => picked && onPick(picked)}
            disabled={!picked || picked.name === '…'}
            className="gap-1.5 bg-red-600 font-bold hover:bg-red-700"
          >
            <CheckCircle2 className="h-4 w-4" /> {t('profile.city.save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* Диалог профиля                                                      */
/* ------------------------------------------------------------------ */

export function ProfileDialog() {
  const open = useAppState((s) => s.profileOpen)
  const setOpen = useAppState((s) => s.setProfileOpen)
  const user = useAppState((s) => s.user)
  const setUser = useAppState((s) => s.setUser)
  const theme = useAppState((s) => s.theme)
  const setTheme = useAppState((s) => s.setTheme)
  const lang = useAppState((s) => s.lang)
  const setLang = useAppState((s) => s.setLang)
  const city = useAppState((s) => s.city)
  const setCity = useAppState((s) => s.setCity)
  const bees = useAppState((s) => s.bees)
  const setBees = useAppState((s) => s.setBees)
  const logout = useAppState((s) => s.logout)
  const { toast } = useToast()
  const t = useT()

  const [name, setName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [cityPickerOpen, setCityPickerOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open && user) setName(userLabel(user))
  }, [open, user])

  if (!user) return null

  const patchProfile = async (payload: { displayName?: string | null; avatar?: string | null }) => {
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const j = (await res.json().catch(() => ({}))) as { user?: SafeUser; error?: string }
    if (!res.ok || !j.user) {
      toast({ title: t('common.cancel'), description: j.error ?? t('profile.error.server'), variant: 'destructive' })
      return false
    }
    setUser(j.user)
    return true
  }

  const saveName = async () => {
    const trimmed = name.trim()
    if (!trimmed || trimmed === userLabel(user)) return
    setSavingName(true)
    const ok = await patchProfile({ displayName: trimmed })
    setSavingName(false)
    if (ok) toast({ title: t('profile.saved'), description: t('profile.savedDesc') })
  }

  const onPickFile = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast({ title: t('profile.photoTitle'), description: t('profile.file.type'), variant: 'destructive' })
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      toast({ title: t('profile.photoTitle'), description: t('profile.file.size'), variant: 'destructive' })
      return
    }
    setUploading(true)
    try {
      const dataUrl = await fileToAvatar(file, {
        read: t('profile.file.read'),
        image: t('profile.file.image'),
        canvas: t('profile.file.canvas'),
      })
      const ok = await patchProfile({ avatar: dataUrl })
      if (ok) toast({ title: t('profile.photoTitle') })
    } catch (e) {
      toast({
        title: t('common.cancel'),
        description: e instanceof Error ? e.message : '—',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const removeAvatar = async () => {
    const ok = await patchProfile({ avatar: null })
    if (ok) toast({ title: t('profile.remove') })
  }

  const pickCity = (c: ApiaryCity) => {
    setCity(c)
    setCityPickerOpen(false)
    toast({ title: t('profile.city.changed'), description: t('profile.city.changedDesc', { name: c.name }) })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] max-w-md overflow-y-auto rounded-2xl border-red-100 p-0 sm:max-w-md">
          <DialogHeader className="border-b border-red-50 bg-red-50/50 px-5 py-4 dark:bg-[#2C211C]">
            <DialogTitle className="text-[#2A1A12]">{t('profile.title')}</DialogTitle>
            <DialogDescription>{t('profile.desc')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 px-5 py-4">
            {/* Фото */}
            <div className="flex items-center gap-4">
              <div className="relative">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={t('profile.photoTitle')}
                    className="h-16 w-16 rounded-full border-2 border-red-100 object-cover"
                  />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-orange-400 text-xl font-extrabold text-white">
                    {userLabel(user).slice(0, 1).toUpperCase()}
                  </span>
                )}
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  aria-label={t('profile.photoTitle')}
                  title={uploading ? t('profile.uploading') : t('profile.photoTitle')}
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white shadow-md transition-colors hover:bg-red-700 disabled:opacity-60"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void onPickFile(e.target.files?.[0])}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-[#2A1A12]">{userLabel(user)}</p>
                <p className="text-xs text-gray-400">
                  {user.name} · {t(ROLE_LABEL_KEY[user.role])}
                </p>
                <div className="mt-1.5 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 border-red-200 px-2.5 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                  >
                    <Camera className="h-3 w-3" /> {uploading ? t('profile.uploading') : t('profile.replace')}
                  </Button>
                  {user.avatar && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 px-2.5 text-xs text-gray-500 hover:text-red-600"
                      onClick={() => void removeAvatar()}
                    >
                      <Trash2 className="h-3 w-3" /> {t('profile.remove')}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Имя */}
            <div className="space-y-1.5">
              <Label htmlFor="profile-name" className="text-xs font-semibold text-gray-600">
                {t('profile.name')}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => void saveName()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void saveName()
                  }}
                  placeholder={t('profile.name.placeholder')}
                  maxLength={60}
                  className="border-red-100"
                />
                <Button
                  size="sm"
                  onClick={() => void saveName()}
                  disabled={savingName || !name.trim() || name.trim() === userLabel(user)}
                  className="shrink-0 gap-1 bg-red-600 hover:bg-red-700"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> {t('profile.save')}
                </Button>
              </div>
            </div>

            {/* Тема */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-600">{t('profile.theme')}</Label>
              <div className="grid grid-cols-3 gap-2" role="group" aria-label={t('profile.theme')}>
                {THEMES.map((th) => {
                  const Icon = th.icon
                  const active = theme === th.id
                  return (
                    <button
                      key={th.id}
                      onClick={() => setTheme(th.id)}
                      aria-pressed={active}
                      className={cn(
                        'flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-semibold transition-all',
                        active
                          ? 'border-red-400 bg-red-50 text-red-700 shadow-sm dark:bg-[#2C211C]'
                          : 'border-red-100 text-gray-500 hover:border-red-200 hover:bg-red-50/50',
                      )}
                    >
                      <Icon className="h-4.5 w-4.5" />
                      {t(th.labelKey)}
                    </button>
                  )
                })}
              </div>
              <p className="text-[11px] leading-relaxed text-gray-400">{t('profile.theme.note')}</p>
            </div>

            {/* Пчёлки-декорация: включение/выключение */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                <Bird className="h-3.5 w-3.5 text-red-400" /> {t('profile.bees')}
              </Label>
              <div className="flex items-center justify-between gap-2 rounded-xl border border-red-100 bg-red-50/40 px-3 py-2.5 dark:bg-[#2C211C]">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#2A1A12]">{t('profile.bees.on')}</p>
                  <p className="text-xs leading-relaxed text-gray-400">{t('profile.bees.desc')}</p>
                </div>
                <Switch
                  checked={bees}
                  onCheckedChange={setBees}
                  aria-label={t('profile.bees')}
                  className="shrink-0 data-[state=checked]:bg-red-600"
                />
              </div>
            </div>

            {/* Язык интерфейса */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                <Globe className="h-3.5 w-3.5 text-red-400" /> {t('profile.lang')}
              </Label>
              <div className="grid grid-cols-3 gap-2" role="group" aria-label={t('profile.lang')}>
                {LANGS.map((l) => {
                  const active = lang === l.id
                  return (
                    <button
                      key={l.id}
                      onClick={() => setLang(l.id as Lang)}
                      aria-pressed={active}
                      title={l.native}
                      className={cn(
                        'flex items-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-semibold transition-all',
                        active
                          ? 'border-red-400 bg-red-50 text-red-700 shadow-sm dark:bg-[#2C211C]'
                          : 'border-red-100 text-gray-500 hover:border-red-200 hover:bg-red-50/50',
                      )}
                    >
                      <span className="text-base leading-none">{l.flag}</span>
                      <span className="truncate">{l.native}</span>
                    </button>
                  )
                })}
              </div>
              <p className="text-[11px] leading-relaxed text-gray-400">{t('profile.lang.note')}</p>
            </div>

            {/* Город пасеки */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                <MapPin className="h-3.5 w-3.5 text-red-400" /> {t('profile.city')}
              </Label>
              <div className="flex items-center justify-between gap-2 rounded-xl border border-red-100 bg-red-50/40 px-3 py-2.5 dark:bg-[#2C211C]">
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-[#2A1A12]">{city.name}</p>
                  <p className="text-[11px] text-gray-400">
                    {city.lat.toFixed(3)}, {city.lon.toFixed(3)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-1.5 border-red-200 font-bold text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setCityPickerOpen(true)}
                >
                  <Map className="h-3.5 w-3.5" /> {t('profile.city.pick')}
                </Button>
              </div>
              <p className="text-[11px] leading-relaxed text-gray-400">{t('profile.city.note')}</p>
            </div>

            {/* Выход */}
            <div className="flex items-center justify-between rounded-xl border border-red-100 bg-red-50/40 px-3.5 py-3 dark:bg-[#2C211C]">
              <div>
                <p className="text-sm font-bold text-[#2A1A12]">{t('profile.account')}</p>
                <p className="text-xs text-gray-400">{t('profile.logoutDesc')}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => {
                  setOpen(false)
                  void logout()
                }}
              >
                <LogOut className="h-3.5 w-3.5" /> {t('profile.logout')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Выбор города на карте */}
      <CityPickerDialog open={cityPickerOpen} onOpenChange={setCityPickerOpen} city={city} onPick={pickCity} />
    </>
  )
}

/** Аватар пользователя: фото или инициал на градиенте. */
export function UserAvatar({ user, className }: { user: SafeUser; className?: string }) {
  if (user.avatar) {
    return <img src={user.avatar} alt="" className={cn('rounded-full object-cover', className)} />
  }
  return (
    <span
      className={cn(
        'flex items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-orange-400 font-extrabold text-white',
        className,
      )}
    >
      {userLabel(user).slice(0, 1).toUpperCase()}
    </span>
  )
}

export function ProfileTrigger({
  user,
  onClick,
  className,
}: {
  user: SafeUser
  onClick: () => void
  className?: string
}) {
  const lang = useAppState((s) => s.lang)
  const t = useT()
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-red-50 dark:hover:bg-[#2C211C]',
        className,
      )}
      aria-label={tr(lang, 'profile.title')}
    >
      <UserAvatar user={user} className="h-9 w-9 text-sm" />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-sm font-bold text-[#2A1A12]">{userLabel(user)}</span>
        <span className="block text-[11px] text-gray-400">{t(ROLE_LABEL_KEY[user.role])}</span>
      </span>
      <UserRound className="h-4 w-4 shrink-0 text-gray-300" />
    </button>
  )
}

export { applyTheme }
