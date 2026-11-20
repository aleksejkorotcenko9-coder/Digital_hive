'use client'

/**
 * Экран «Данные»: управление телеметрией и справочниками.
 *  — загрузка CSV (шаблон + импорт с отчётом);
 *  — ручное внесение измерения;
 *  — журнал осмотров и действий;
 *  — справочник ульев и площадок кочёвки;
 *  — API-эндпоинт для датчиков (ключ видит только пасечник).
 * Правила доступа: пасечник вносит изменения, помощник — только просмотр.
 */
import { useState } from 'react'
import { format } from 'date-fns'
import { LANG_DATE_LOCALE, useT } from '@/lib/i18n'
import {
  CalendarPlus,
  Database,
  Download,
  FileUp,
  MapPinned,
  Pencil,
  Plus,
  RefreshCw,
  TerminalSquare,
  UserMinus,
  Waypoints,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { useAppState } from '@/lib/store'
import { useRealData } from '@/lib/real-data'
import { cn } from '@/lib/utils'

const EVENT_TYPES = ['осмотр', 'подкормка', 'расширение', 'лечение', 'кочёвка', 'план', 'прочее'] as const

/* Значения типов уходят в БД как есть, а на экране показываем перевод. */
const EVENT_TYPE_KEYS: Record<(typeof EVENT_TYPES)[number], string> = {
  'осмотр': 'data.event.type.inspection',
  'подкормка': 'data.event.type.feeding',
  'расширение': 'data.event.type.expansion',
  'лечение': 'data.event.type.treatment',
  'кочёвка': 'data.event.type.migration',
  'план': 'data.event.type.plan',
  'прочее': 'data.event.type.other',
}

export function DataView() {
  const { status, data, reload } = useRealData()
  const t = useT()
  const lang = useAppState((s) => s.lang)

  if (status === 'idle' || status === 'loading') {
    return <div className="grid gap-4 md:grid-cols-2"><div className="h-64 animate-pulse rounded-2xl bg-red-100/50" /><div className="h-64 animate-pulse rounded-2xl bg-red-100/50" /></div>
  }
  if (status === 'error' || !data) {
    return (
      <Card className="mx-auto max-w-lg border-red-100">
        <CardContent className="p-6 text-center">
          <p className="text-sm text-gray-600">{t('data.error.notLoaded')}</p>
          <Button onClick={reload} className="mt-3 bg-red-600 hover:bg-red-700">{t('data.retry')}</Button>
        </CardContent>
      </Card>
    )
  }

  const hivesApi = data.hives
  const isBeekeeper = data.user.role === 'BEEKEEPER'
  const totalReadings = hivesApi.reduce((acc, h) => acc + h.readingCount, 0)
  const lastTs = hivesApi
    .map((h) => h.lastTs)
    .filter((x): x is string => x !== null)
    .sort()
    .at(-1)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#2A1A12] md:text-3xl">{t('data.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t('data.subtitle')}
        </p>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label={t('data.stat.hives')} value={String(hivesApi.length)} />
        <StatCard label={t('data.stat.measurements')} value={String(totalReadings)} />
        <StatCard label={t('data.stat.events')} value={String(data.counts.events)} />
        <StatCard
          label={t('data.stat.lastMeasurement')}
          value={lastTs ? format(new Date(lastTs), 'd MMM, HH:mm', { locale: LANG_DATE_LOCALE[lang] }) : '—'}
        />
      </div>

      {!isBeekeeper && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t('data.helperNotice')}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <CsvCard isBeekeeper={isBeekeeper} hivesApi={hivesApi.map((h) => ({ number: h.number, name: h.name }))} reload={reload} />
        <ManualCard isBeekeeper={isBeekeeper} hivesApi={hivesApi.map((h) => ({ number: h.number, name: h.name }))} reload={reload} />
        <EventsCard isBeekeeper={isBeekeeper} reload={reload} />
        <ApiCard isBeekeeper={isBeekeeper} apiKey={data.apiKey} reload={reload} />
        <HivesCard isBeekeeper={isBeekeeper} reload={reload} />
        <SitesCard isBeekeeper={isBeekeeper} reload={reload} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-red-100 shadow-sm">
      <CardContent className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
        <p className="mt-1.5 text-xl font-extrabold text-[#2A1A12]">{value}</p>
      </CardContent>
    </Card>
  )
}

function HiveSelect({ hivesApi, value, onChange }: {
  hivesApi: Array<{ number: number; name: string }>
  value: string
  onChange: (v: string) => void
}) {
  const t = useT()
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="border-red-200 focus:ring-red-300">
        <SelectValue placeholder={t('data.hive.selectPlaceholder')} />
      </SelectTrigger>
      <SelectContent>
        {hivesApi.length === 0 && (
          <SelectItem value="_none" disabled>{t('data.hive.addFirst')}</SelectItem>
        )}
        {hivesApi.map((h) => (
          <SelectItem key={h.number} value={String(h.number)}>
            №{h.number} · {h.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/* CSV -------------------------------------------------------------- */

function CsvCard({ isBeekeeper, hivesApi, reload }: {
  isBeekeeper: boolean
  hivesApi: Array<{ number: number; name: string }>
  reload: () => void
}) {
  const { toast } = useToast()
  const t = useT()
  const [file, setFile] = useState<File | null>(null)
  const [fallbackHive, setFallbackHive] = useState('')
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<string | null>(null)

  const upload = async () => {
    if (!file || busy) return
    setBusy(true)
    setReport(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (fallbackHive) fd.append('hiveNumber', fallbackHive)
      const res = await fetch('/api/csv', { method: 'POST', body: fd })
      const j = (await res.json()) as {
        ok?: boolean
        inserted?: number
        skipped?: number
        errors?: string[]
        byHive?: Record<string, number>
        error?: string
      }
      if (!res.ok) {
        toast({ title: t('data.csv.errorTitle'), description: j.error ?? `HTTP ${res.status}`, variant: 'destructive' })
        return
      }
      const byHive = j.byHive ? Object.entries(j.byHive).map(([k, v]) => `№${k} — ${v}`).join(', ') : '—'
      setReport(
        t('data.csv.report.main', { n: j.inserted ?? 0 }) +
        (j.skipped ? t('data.csv.report.skipped', { n: j.skipped }) : '') +
        t('data.csv.report.byHive', { list: byHive }) +
        (j.errors && j.errors.length ? '\n' + t('data.csv.report.warnings', { list: j.errors.join('\n• ') }) : ''),
      )
      toast({ title: t('data.csv.toastTitle'), description: t('data.csv.toastAdded', { n: j.inserted ?? 0 }) })
      setFile(null)
      reload()
    } catch {
      toast({ title: t('data.networkError'), description: t('data.csv.sendFailed'), variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-red-100 shadow-sm">
      <CardContent className="space-y-3 p-5">
        <p className="flex items-center gap-2 font-bold text-[#2A1A12]">
          <FileUp className="h-4.5 w-4.5 text-red-600" /> {t('data.csv.title')}
        </p>
        <p className="text-xs leading-relaxed text-gray-500">
          {t('data.csv.hint')}
        </p>
        {isBeekeeper ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="border-red-200 file:mr-3 file:rounded-lg file:border-0 file:bg-red-100 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-red-700"
              />
              <a href="/api/csv" download className="shrink-0">
                <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50">
                  <Download className="h-4 w-4" /> {t('data.csv.template')}
                </Button>
              </a>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <HiveSelect hivesApi={hivesApi} value={fallbackHive} onChange={setFallbackHive} />
              <Button onClick={() => void upload()} disabled={!file || busy} className="bg-orange-500 hover:bg-orange-600">
                <FileUp className="h-4 w-4" /> {busy ? t('data.csv.uploading') : t('data.csv.upload')}
              </Button>
            </div>
            {report && (
              <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl bg-red-50 p-3 text-xs leading-relaxed text-gray-700">
                {report}
              </pre>
            )}
          </>
        ) : (
          <p className="text-xs text-gray-400">{t('data.beekeeperOnly')}</p>
        )}
      </CardContent>
    </Card>
  )
}

/* Ручное измерение -------------------------------------------------- */

function ManualCard({ isBeekeeper, hivesApi, reload }: {
  isBeekeeper: boolean
  hivesApi: Array<{ number: number; name: string }>
  reload: () => void
}) {
  const { toast } = useToast()
  const t = useT()
  const [hive, setHive] = useState('')
  const [dt, setDt] = useState(() => format(new Date(), "yyyy-MM-dd'T'HH:mm"))
  const [weight, setWeight] = useState('')
  const [temp, setTemp] = useState('')
  const [hum, setHum] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hiveNumber: Number(hive), ts: dt, weightKg: weight, tempC: temp, humidityPct: hum }),
      })
      const j = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok) {
        toast({ title: t('data.notSaved'), description: j.error ?? `HTTP ${res.status}`, variant: 'destructive' })
        return
      }
      toast({ title: t('data.manual.toastTitle'), description: t('data.manual.toastDesc', { hive, dt: dt.replace('T', ' ') }) })
      setWeight('')
      setTemp('')
      setHum('')
      reload()
    } catch {
      toast({ title: t('data.networkError'), variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-red-100 shadow-sm">
      <CardContent className="space-y-3 p-5">
        <p className="flex items-center gap-2 font-bold text-[#2A1A12]">
          <Waypoints className="h-4.5 w-4.5 text-red-600" /> {t('data.manual.title')}
        </p>
        {isBeekeeper ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500">{t('data.manual.hive')}</Label>
                <HiveSelect hivesApi={hivesApi} value={hive} onChange={setHive} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500">{t('data.manual.datetime')}</Label>
                <Input type="datetime-local" value={dt} onChange={(e) => setDt(e.target.value)} className="border-red-200" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500">{t('data.manual.weight')}</Label>
                <Input inputMode="decimal" placeholder="157,6" value={weight} onChange={(e) => setWeight(e.target.value)} className="border-red-200" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500">{t('data.manual.temp')}</Label>
                <Input inputMode="decimal" placeholder="35,0" value={temp} onChange={(e) => setTemp(e.target.value)} className="border-red-200" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500">{t('data.manual.humidity')}</Label>
                <Input inputMode="numeric" placeholder="45" value={hum} onChange={(e) => setHum(e.target.value)} className="border-red-200" />
              </div>
            </div>
            <Button onClick={() => void submit()} disabled={!hive || busy || (!weight && !temp && !hum)} className="w-full bg-red-600 hover:bg-red-700">
              {t('data.manual.save')}
            </Button>
          </>
        ) : (
          <p className="text-xs text-gray-400">{t('data.beekeeperOnly')}</p>
        )}
      </CardContent>
    </Card>
  )
}

/* Журнал пчеловода (п. 8 ТЗ): свободные записи + «что делать завтра» ---- */

/** Через сколько дней без осмотра семья попадает в «нужна работа». */
const INSPECTION_DUE_DAYS = 21
/** Горизонт планирования «завтра и ближайшие дни». */
const PLAN_WINDOW_DAYS = 3

function EventsCard({ isBeekeeper, reload }: { isBeekeeper: boolean; reload: () => void }) {
  const { toast } = useToast()
  const t = useT()
  const lang = useAppState((s) => s.lang)
  const data = useAppState((s) => s.real)
  const reminders = useAppState((s) => s.reminders)
  const [hive, setHive] = useState('')
  const [type, setType] = useState('осмотр')
  const [note, setNote] = useState('')
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)
  const events = data?.events ?? []
  const hivesApi = (data?.hives ?? []).map((h) => ({ number: h.number, name: h.name }))

  const submit = async () => {
    if (busy || !hive || !note.trim()) return
    setBusy(true)
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hiveNumber: Number(hive), type, note, ...(date ? { ts: new Date(`${date}T${new Date().toTimeString().slice(0, 8)}`).toISOString() } : {}) }),
      })
      const j = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok) {
        toast({ title: t('data.notSaved'), description: j.error ?? `HTTP ${res.status}`, variant: 'destructive' })
        return
      }
      toast({ title: t('data.events.toastAdded') })
      setNote('')
      setDate('')
      reload()
    } catch {
      toast({ title: t('data.networkError'), variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  /* Что делать завтра и в ближайшие дни: план-записи, напоминания
     на ближайшие PLAN_WINDOW_DAYS дней и семьи без осмотра дольше нормы. */
  const now = Date.now()
  const planItems: string[] = []
  const upcoming = reminders
    .filter((r) => !r.done && new Date(r.remindAt).getTime() >= now - 12 * 3600 * 1000 && new Date(r.remindAt).getTime() < now + PLAN_WINDOW_DAYS * 86400000)
    .sort((a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime())
    .slice(0, 6)
  for (const r of upcoming) {
    planItems.push(t('data.events.tomorrow.remind', { date: format(new Date(r.remindAt), 'd MMM', { locale: LANG_DATE_LOCALE[lang] }), text: r.text }))
  }
  const planEvents = events
    .filter((e) => e.type === 'план' && new Date(e.ts).getTime() >= now - 12 * 3600 * 1000 && new Date(e.ts).getTime() < now + PLAN_WINDOW_DAYS * 86400000)
    .slice(0, 4)
  for (const e of planEvents) {
    planItems.push(t('data.events.tomorrow.plan', { n: e.hiveNumber, text: e.note }))
  }
  const inspectionDue = (data?.hives ?? []).filter((h) => {
    const last = events.find((e) => e.hiveNumber === h.number && e.type === 'осмотр')
    return !last || now - new Date(last.ts).getTime() > INSPECTION_DUE_DAYS * 86400000
  })
  for (const h of inspectionDue.slice(0, 4)) {
    const last = events.find((e) => e.hiveNumber === h.number && e.type === 'осмотр')
    planItems.push(
      last
        ? t('data.events.tomorrow.inspect', { n: h.number, days: String(Math.floor((now - new Date(last.ts).getTime()) / 86400000)) })
        : t('data.events.tomorrow.inspectNever', { n: h.number }),
    )
  }

  return (
    <Card className="border-red-100 shadow-sm">
      <CardContent className="space-y-3 p-5">
        <p className="flex items-center gap-2 font-bold text-[#2A1A12]">
          <CalendarPlus className="h-4.5 w-4.5 text-red-600" /> {t('data.events.title')}
        </p>

        {/* Что делать завтра и в ближайшие дни */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
          <p className="text-xs font-bold text-amber-800">{t('data.events.tomorrow.title')}</p>
          {planItems.length === 0 ? (
            <p className="mt-1 text-sm text-gray-500">{t('data.events.tomorrow.none')}</p>
          ) : (
            <ul className="mt-1.5 space-y-1">
              {planItems.map((item, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[13px] leading-snug text-gray-700">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>

        {isBeekeeper && (
          <div className="space-y-2 rounded-xl bg-red-50/60 p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <HiveSelect hivesApi={hivesApi} value={hive} onChange={setHive} />
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="border-red-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((et) => (
                    <SelectItem key={et} value={et}>{t(EVENT_TYPE_KEYS[et])}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border-red-200 text-sm"
              aria-label={t('data.events.date')}
            />
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('data.events.notePlaceholder')}
              className="min-h-[44px] resize-none border-red-200"
            />
            <Button onClick={() => void submit()} disabled={!hive || !note.trim() || busy} size="sm" className="bg-red-600 hover:bg-red-700">
              {t('data.events.add')}
            </Button>
          </div>
        )}
        <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {events.length === 0 && (
            <li className="text-sm text-gray-400">{t('data.events.empty')}</li>
          )}
          {events.map((e) => (
            <li key={e.id} className="rounded-xl border border-red-50 bg-white px-3 py-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                <span className="rounded-full bg-red-100 px-2 py-0.5 font-bold text-red-700">{e.type === 'план' ? t('data.event.type.plan') : e.type}</span>
                <span className="font-semibold text-gray-600">{e.hiveName}</span>
                <span className="ml-auto">{format(new Date(e.ts), 'd MMM yyyy, HH:mm', { locale: LANG_DATE_LOCALE[lang] })} · {e.authorName}</span>
              </div>
              <p className="mt-1 text-sm text-gray-700">{e.note}</p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

/* API-ключ ---------------------------------------------------------- */

function ApiCard({ isBeekeeper, apiKey, reload }: { isBeekeeper: boolean; apiKey: string | null; reload: () => void }) {
  const { toast } = useToast()
  const t = useT()
  const [busy, setBusy] = useState(false)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  const regen = async () => {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/apikey', { method: 'POST' })
      const j = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok) {
        toast({ title: t('data.error.generic'), description: j.error ?? `HTTP ${res.status}`, variant: 'destructive' })
        return
      }
      toast({ title: t('data.api.toastRegen'), description: t('data.api.toastOldKey') })
      reload()
    } finally {
      setBusy(false)
    }
  }

  const curl =
    `curl -X POST ${origin || t('data.api.addrPlaceholder')}/api/telemetry ` +
    `-H "Content-Type: application/json" ` +
    `-H "x-api-key: ${apiKey ?? t('data.api.keyPlaceholder')}" ` +
    `-d '{"hiveNumber":1,"weightKg":157.6,"tempC":35.0,"humidityPct":45}'`

  return (
    <Card className="border-red-100 shadow-sm">
      <CardContent className="space-y-3 p-5">
        <p className="flex items-center gap-2 font-bold text-[#2A1A12]">
          <TerminalSquare className="h-4.5 w-4.5 text-red-600" /> {t('data.api.title')}
        </p>
        <p className="text-xs leading-relaxed text-gray-500">
          {t('data.api.hintSensors')} <code className="rounded bg-red-50 px-1">POST /api/telemetry</code> {t('data.api.hintSend')} <code className="rounded bg-red-50 px-1">x-api-key</code>.
        </p>
        {isBeekeeper && apiKey ? (
          <>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-xl bg-gray-900 px-3 py-2 font-mono text-xs text-emerald-300" title={apiKey}>
                {apiKey}
              </code>
              <Button variant="outline" onClick={() => void regen()} disabled={busy} className="shrink-0 border-red-200 text-red-700 hover:bg-red-50">
                <RefreshCw className={cn('h-4 w-4', busy && 'animate-spin')} /> {t('data.api.newKey')}
              </Button>
            </div>
            <pre className="max-h-32 overflow-auto rounded-xl bg-red-50 p-3 text-[11px] leading-relaxed text-gray-700">
              {curl}
            </pre>
          </>
        ) : (
          <p className="text-xs text-gray-400">{t('data.api.keyHidden')}</p>
        )}
      </CardContent>
    </Card>
  )
}

/* Справочник ульев --------------------------------------------------- */

function HivesCard({ isBeekeeper, reload }: { isBeekeeper: boolean; reload: () => void }) {
  const { toast } = useToast()
  const t = useT()
  const lang = useAppState((s) => s.lang)
  const data = useAppState((s) => s.real)
  const [number, setNumber] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNote, setEditNote] = useState('')
  const hivesApi = data?.hives ?? []

  const addHive = async () => {
    if (busy || !number) return
    setBusy(true)
    try {
      const res = await fetch('/api/hives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: Number(number), familyNote: note }),
      })
      const j = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok) {
        toast({ title: t('data.notAdded'), description: j.error ?? `HTTP ${res.status}`, variant: 'destructive' })
        return
      }
      toast({ title: t('data.hives.toastAdded', { n: number }) })
      setNumber('')
      setNote('')
      reload()
    } finally {
      setBusy(false)
    }
  }

  const saveNote = async (id: string) => {
    try {
      const res = await fetch('/api/hives', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, familyNote: editNote }),
      })
      if (!res.ok) {
        toast({ title: t('data.notSaved'), variant: 'destructive' })
        return
      }
      toast({ title: t('data.hives.noteUpdated') })
      setEditingId(null)
      reload()
    } catch {
      toast({ title: t('data.networkError'), variant: 'destructive' })
    }
  }

  return (
    <Card className="border-red-100 shadow-sm">
      <CardContent className="space-y-3 p-5">
        <p className="flex items-center gap-2 font-bold text-[#2A1A12]">
          <Database className="h-4.5 w-4.5 text-red-600" /> {t('data.hives.title')}
        </p>
        {isBeekeeper && (
          <div className="flex flex-wrap items-end gap-2 rounded-xl bg-red-50/60 p-3">
            <div className="w-24 space-y-1.5">
              <Label className="text-xs text-gray-500">{t('data.hives.number')}</Label>
              <Input inputMode="numeric" placeholder="5" value={number} onChange={(e) => setNumber(e.target.value)} className="border-red-200" />
            </div>
            <div className="min-w-[180px] flex-1 space-y-1.5">
              <Label className="text-xs text-gray-500">{t('data.hives.familyNote')}</Label>
              <Input placeholder={t('data.hives.familyNotePlaceholder')} value={note} onChange={(e) => setNote(e.target.value)} className="border-red-200" />
            </div>
            <Button onClick={() => void addHive()} disabled={!number || busy} className="bg-red-600 hover:bg-red-700">
              <Plus className="h-4 w-4" /> {t('data.add')}
            </Button>
          </div>
        )}
        <ul className="space-y-2">
          {hivesApi.map((h) => (
            <li key={h.id} className="rounded-xl border border-red-50 bg-white px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-[#2A1A12]">{h.name}</span>
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                  {h.readingCount} {t('data.hives.readingsShort')}
                </span>
                {h.lastTs && (
                  <span className="text-[11px] text-gray-400">{t('data.hives.last')} {format(new Date(h.lastTs), 'd MMM, HH:mm', { locale: LANG_DATE_LOCALE[lang] })}</span>
                )}
                {isBeekeeper && editingId !== h.id && (
                  <button
                    onClick={() => { setEditingId(h.id); setEditNote(h.familyNote) }}
                    className="ml-auto rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-700"
                    aria-label={t('data.hives.editNote')}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {editingId === h.id ? (
                <div className="mt-2 flex items-center gap-2">
                  <Input value={editNote} onChange={(e) => setEditNote(e.target.value)} className="border-red-200" />
                  <Button size="sm" onClick={() => void saveNote(h.id)} className="bg-red-600 hover:bg-red-700">{t('data.save')}</Button>
                </div>
              ) : (
                <p className="mt-0.5 text-xs text-gray-500">{h.familyNote || t('data.hives.noNote')}</p>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

/* Площадки кочёвки --------------------------------------------------- */

function SitesCard({ isBeekeeper, reload }: { isBeekeeper: boolean; reload: () => void }) {
  const { toast } = useToast()
  const t = useT()
  const setView = useAppState((s) => s.setView)
  const data = useAppState((s) => s.real)
  const sites = data?.sites ?? []
  const [name, setName] = useState('')
  const [honeyPlant, setHoneyPlant] = useState('')
  const [bloom, setBloom] = useState('')
  const [distance, setDistance] = useState('')
  const [score, setScore] = useState('')
  const [verdict, setVerdict] = useState('backup')
  const [busy, setBusy] = useState(false)

  const addSite = async () => {
    if (busy || !name.trim()) return
    setBusy(true)
    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          honeyPlant,
          bloomWindow: bloom,
          distanceKm: distance === '' ? 0 : Number(distance.replace(',', '.')),
          score: score === '' ? 5 : Number(score.replace(',', '.')),
          verdict,
        }),
      })
      const j = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok) {
        toast({ title: t('data.notAdded'), description: j.error ?? `HTTP ${res.status}`, variant: 'destructive' })
        return
      }
      toast({ title: t('data.sites.toastAdded') })
      setName('')
      setHoneyPlant('')
      setBloom('')
      setDistance('')
      setScore('')
      setVerdict('backup')
      reload()
    } finally {
      setBusy(false)
    }
  }

  const removeSite = async (id: string, siteName: string) => {
    const res = await fetch(`/api/sites?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (!res.ok) {
      toast({ title: t('data.sites.notRemoved'), variant: 'destructive' })
      return
    }
    toast({ title: t('data.sites.toastRemoved', { name: siteName }) })
    reload()
  }

  return (
    <Card className="border-red-100 shadow-sm xl:col-span-2">
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 font-bold text-[#2A1A12]">
            <MapPinned className="h-4.5 w-4.5 text-red-600" /> {t('data.sites.title')}
          </p>
          <button
            onClick={() => setView('migration')}
            className="text-xs font-bold text-red-600 hover:text-red-800"
          >
            {t('data.sites.viewMigration')}
          </button>
        </div>
        {isBeekeeper && (
          <div className="grid gap-2 rounded-xl bg-red-50/60 p-3 md:grid-cols-3">
            <Input placeholder={t('data.sites.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} className="border-red-200" />
            <Input placeholder={t('data.sites.honeyPlantPlaceholder')} value={honeyPlant} onChange={(e) => setHoneyPlant(e.target.value)} className="border-red-200" />
            <Input placeholder={t('data.sites.bloomPlaceholder')} value={bloom} onChange={(e) => setBloom(e.target.value)} className="border-red-200" />
            <Input inputMode="decimal" placeholder={t('data.sites.distancePlaceholder')} value={distance} onChange={(e) => setDistance(e.target.value)} className="border-red-200" />
            <Input inputMode="decimal" placeholder={t('data.sites.scorePlaceholder')} value={score} onChange={(e) => setScore(e.target.value)} className="border-red-200" />
            <div className="flex items-center gap-2">
              <Select value={verdict} onValueChange={setVerdict}>
                <SelectTrigger className="border-red-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="recommend">{t('data.verdict.recommend')}</SelectItem>
                  <SelectItem value="backup">{t('data.verdict.backup')}</SelectItem>
                  <SelectItem value="avoid">{t('data.verdict.avoid')}</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => void addSite()} disabled={!name.trim() || busy} className="shrink-0 bg-red-600 hover:bg-red-700">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        <ul className="grid gap-2 md:grid-cols-3">
          {sites.length === 0 && (
            <li className="text-sm text-gray-400 md:col-span-3">{t('data.sites.empty')}</li>
          )}
          {sites.map((s) => (
            <li key={s.id} className="relative rounded-xl border border-red-50 bg-white px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2 pr-7">
                <span className="font-bold text-[#2A1A12]">{s.name}</span>
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">{s.score} / 10</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {s.honeyPlant || '—'} · {s.bloomWindow || '—'} · {s.distanceKm} {t('data.unit.km')}
              </p>
              {isBeekeeper && (
                <button
                  onClick={() => void removeSite(s.id, s.name)}
                  className="absolute right-2 top-2 rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500"
                  aria-label={t('data.sites.remove', { name: s.name })}
                >
                  <UserMinus className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
