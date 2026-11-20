'use client'

/**
 * Диалоги демо-режима:
 *  — EvidenceDialog: «Почему агент так решил?» — три шага доказательной
 *    аргументации: 1) доказательства датчиков (кросс-проверка 2–4 сенсоров),
 *    2) биологический риск на 3–14 дней, 3) кнопка действия «Выполнить / Отметить».
 *    После выполнения индекс улья повышается, предписание уходит в «Выполнено»,
 *    а для предписания с обработкой — заклещенность падает до 0,4 %.
 *  — EveningReportDialog: «Вечерний отчет (21:00)» — суточная сводка
 *    (чистый привес нектара, статус заклещенности, прогноз цветения по GDD).
 *  — MeasureDialog: «+ Внести замер» — ввод нового подсчета клещей с
 *    автопересчетом заклещенности и статуса риска.
 *  — PesticideDialog: «Что делать?» по срочному пестицидному предупреждению —
 *    план действий до опрыскивания рапсового поля.
 */
import { useCallback, useState } from 'react'
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  ClipboardList,
  CloudSun,
  Copy,
  DoorClosed,
  Flower2,
  Hexagon,
  Scale,
  Search,
  Sprout,
  Sunrise,
  Truck,
} from 'lucide-react'
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
import { fmtNum } from '@/lib/hive-model'
import {
  demoHiveById,
  eveningReportLines,
  nearestBloom,
  varroaStatus,
  type DemoFinding,
  type DemoHive,
  type LiveDemoValues,
} from '@/lib/demo-hives'
import { tr, useT } from '@/lib/i18n'
import { useAppState } from '@/lib/store'
import { EvidenceRow } from './DemoCharts'
import { UrgencyBadge } from './decor'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Перевод демо-данных: ключ → словарь, при отсутствии ключа —         */
/* канонический русский текст из demo-hives.ts (фолбэк данных)          */
/* ------------------------------------------------------------------ */

function useTF() {
  const lang = useAppState((s) => s.lang)
  return useCallback(
    (key: string, fallback: string, vars?: Record<string, string | number>) => {
      const s = tr(lang, key, vars)
      return s === key ? fallback : s
    },
    [lang],
  )
}

/* ------------------------------------------------------------------ */
/* Почему агент так решил? — 3 шага доказательной аргументации         */
/* ------------------------------------------------------------------ */

function StepCard({
  n,
  title,
  tone,
  children,
}: {
  n: number
  title: string
  tone: 'red' | 'amber' | 'emerald'
  children: React.ReactNode
}) {
  const tones = {
    red: 'bg-red-600',
    amber: 'bg-amber-500',
    emerald: 'bg-emerald-600',
  } as const
  return (
    <div className="rounded-2xl border border-red-100 p-3.5">
      <p className="flex items-center gap-2 text-sm font-extrabold text-[#2A1A12]">
        <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs font-extrabold text-white', tones[tone])}>
          {n}
        </span>
        {title}
      </p>
      <div className="mt-2.5">{children}</div>
    </div>
  )
}

export function EvidenceDialog({
  finding,
  hive,
  done,
  onComplete,
  onOpenChange,
}: {
  finding: DemoFinding | null
  hive: DemoHive
  done: boolean
  onComplete: (finding: DemoFinding) => void
  onOpenChange: (v: boolean) => void
}) {
  const t = useT()
  const tf = useTF()
  const targetHive = finding?.sourceHive ?? hive.id
  return (
    <Dialog open={finding !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] overflow-y-auto rounded-2xl sm:max-w-lg">
        {finding && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-start gap-2 pr-6 text-left text-[15px] leading-snug text-[#2A1A12]">
                <Search className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                {tf(`demo.finding.${finding.id}.title`, finding.title)}
              </DialogTitle>
              <DialogDescription className="text-left">
                {t('dash.evidence.desc', { n: targetHive })}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {/* Шаг 1: доказательства датчиков (кросс-проверка) */}
              <StepCard n={1} title={t('dash.evidence.step1')} tone="red">
                <ul className="space-y-2.5">
                  {finding.evidence.map((e, i) => (
                    <EvidenceRow
                      key={i}
                      sensor={e.sensor}
                      text={tf(`demo.evidence.${finding.id}.${i}`, e.text)}
                    />
                  ))}
                </ul>
                <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[11px] leading-relaxed text-red-700">
                  {t('dash.evidence.cross', {
                    n: finding.evidence.length,
                    p: tf(`demo.finding.${finding.id}.probability`, finding.probability),
                  })}
                </p>
              </StepCard>

              {/* Шаг 2: биологический риск */}
              <StepCard n={2} title={t('dash.evidence.step2')} tone="amber">
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                  <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-amber-500" />
                  <p className="text-[13px] leading-relaxed text-amber-900">
                    {tf(`demo.finding.${finding.id}.risk`, finding.risk)}
                  </p>
                </div>
              </StepCard>

              {/* Шаг 3: действие */}
              <StepCard n={3} title={t('dash.evidence.step3')} tone="emerald">
                {done ? (
                  <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                    <p className="text-sm font-bold text-emerald-800">
                      {t('dash.evidence.done', { n: fmtNum(finding.boost) })}
                    </p>
                  </div>
                ) : (
                  <>
                    <Button
                      onClick={() => onComplete(finding)}
                      className="w-full gap-1.5 bg-gradient-to-r from-red-600 to-orange-500 font-bold shadow-md shadow-red-100 hover:from-red-700 hover:to-orange-600"
                    >
                      <CheckCircle2 className="h-4 w-4" />{' '}
                      {t('dash.evidence.do', { action: tf(`demo.finding.${finding.id}.action`, finding.action) })}
                    </Button>
                    <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
                      {t('dash.evidence.note', { n: fmtNum(finding.boost) })}
                    </p>
                  </>
                )}
              </StepCard>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-xl bg-red-50/60 px-3 py-2">
              <UrgencyBadge
                urgency={finding.urgency}
                note={tf(`demo.finding.${finding.id}.urgencyNote`, finding.urgencyNote)}
              />
              <p className="text-[10px] leading-tight text-gray-400">{t('dash.evidence.decide')}</p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* Вечерний отчет (21:00)                                              */
/* ------------------------------------------------------------------ */

const REPORT_ICON = {
  weight: Scale,
  varroa: Bug,
  bloom: Flower2,
  hive: Hexagon,
  weather: CloudSun,
} as const

export function EveningReportDialog({
  open,
  onOpenChange,
  doneList,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  doneList: Record<number, string[]>
}) {
  const t = useT()
  const tf = useTF()
  const lang = useAppState((s) => s.lang)
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const hives = [demoHiveById(1), demoHiveById(2), demoHiveById(3), demoHiveById(4)]
  const liveById: Record<number, LiveDemoValues> = Object.fromEntries(hives.map((h) => [h.id, h.base]))
  const lines = eveningReportLines(hives, liveById, doneList, lang).map((l) => ({
    ...l,
    title: tf(`demo.evening.${l.key}.title`, l.title, l.vars),
    text: tf(`demo.evening.${l.key}.text`, l.text, l.vars),
  }))
  const bloom = nearestBloom()

  const copy = async () => {
    const text = [
      t('common.reportTitle'),
      ...lines.map((l) => `${l.title}: ${l.text}`),
    ].join('\n\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast({ title: t('common.copied'), description: t('common.copiedDesc') })
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast({ title: t('common.copyFail'), description: t('common.copyFailDesc'), variant: 'destructive' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-left text-[15px] text-[#2A1A12]">
            <ClipboardList className="h-4 w-4 text-red-500" />
            {t('common.reportTitle')}
          </DialogTitle>
          <DialogDescription className="text-left">{t('dash.evening.desc')}</DialogDescription>
        </DialogHeader>

        <ul className="space-y-2.5">
          {lines.map((l, i) => {
            const Icon = REPORT_ICON[l.icon]
            return (
              <li key={i} className="flex items-start gap-3 rounded-2xl border border-red-50 bg-red-50/30 p-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-red-600 shadow-sm">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-extrabold text-gray-800">{l.title}</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-gray-600">{l.text}</p>
                </div>
              </li>
            )
          })}
        </ul>

        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] leading-relaxed text-gray-400">
            {t('dash.evening.bloomNote', {
              name: tf(`demo.crop.${bloom.key}`, bloom.name),
              n: bloom.daysLeft,
              p: bloom.pct,
            })}
          </p>
          <Button variant="outline" onClick={() => void copy()} className="shrink-0 gap-1.5">
            <Copy className={cn('h-3.5 w-3.5', copied && 'text-emerald-600')} />
            {copied ? t('common.copied') : t('common.copy')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* Внести замер заклещенности                                          */
/* ------------------------------------------------------------------ */

export function MeasureDialog({
  open,
  onOpenChange,
  hiveName,
  onSave,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** Имя улья для подзаголовка («Улей №3» / «№2…») — опционально. */
  hiveName?: string
  /** Сохранить замер: заклещенность %, клещей за сутки, пчел осмотрено. */
  onSave: (pct: number, mites: number, bees: number) => void
}) {
  const t = useT()
  const [mites, setMites] = useState('')
  const [bees, setBees] = useState('300')

  const m = Number(mites)
  const b = Number(bees)
  const valid = Number.isFinite(m) && m >= 0 && Number.isFinite(b) && b >= 30
  const pct = valid && m > 0 ? (m / b) * 100 : valid && m === 0 ? 0 : null
  const st = pct !== null ? varroaStatus(pct) : null

  const save = () => {
    if (pct === null || !valid) return
    onSave(Math.round(pct * 10) / 10, m, b)
    setMites('')
    setBees('300')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-left text-[15px] text-[#2A1A12]">
            <Bug className="h-4 w-4 text-red-500" />
            {t('dash.measure.title')}
          </DialogTitle>
          <DialogDescription className="text-left">
            {hiveName ? `${hiveName} · ` : ''}
            {t('dash.measure.desc')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="measure-mites" className="text-xs font-semibold text-gray-600">
              {t('dash.measure.mites')}
            </Label>
            <Input
              id="measure-mites"
              type="number"
              min={0}
              max={999}
              value={mites}
              onChange={(e) => setMites(e.target.value)}
              placeholder="8"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="measure-bees" className="text-xs font-semibold text-gray-600">
              {t('dash.measure.bees')}
            </Label>
            <Input
              id="measure-bees"
              type="number"
              min={30}
              max={20000}
              value={bees}
              onChange={(e) => setBees(e.target.value)}
              placeholder="300"
            />
          </div>
        </div>

        {/* Живой пересчет риска */}
        <div
          className={cn(
            'rise-in rounded-2xl border px-4 py-3',
            st ? st.cls : 'border-red-100 bg-red-50/40',
          )}
        >
          {pct === null ? (
            <p className="text-sm font-semibold text-gray-400">—</p>
          ) : (
            <>
              <p className="text-2xl font-extrabold leading-none text-[#2A1A12]">
                {fmtNum(pct, 1)} <span className="text-sm font-bold text-gray-400">%</span>
              </p>
              <p className="mt-1 text-xs font-bold">
                {t('dash.measure.result', {
                  p: fmtNum(pct, 1),
                  status: st ? t(`dash.varroa.status.${st.level}`) : '',
                })}
              </p>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('dash.measure.cancel')}
          </Button>
          <Button
            onClick={() => save()}
            disabled={!valid || pct === null}
            className="gap-1.5 bg-red-600 font-bold hover:bg-red-700"
          >
            <CheckCircle2 className="h-4 w-4" /> {t('dash.measure.save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* Что делать? — план действий при пестицидной опасности               */
/* ------------------------------------------------------------------ */

const PESTICIDE_STEPS = [
  { icon: Sunrise, key: 'dash.pesticide.step1' },
  { icon: Truck, key: 'dash.pesticide.step2' },
  { icon: DoorClosed, key: 'dash.pesticide.step3' },
  { icon: ClipboardList, key: 'dash.pesticide.step4' },
] as const

export function PesticideDialog({
  open,
  onOpenChange,
  onMigrate,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** «Спланировать переезд» — переход в раздел «Кочёвка». */
  onMigrate: () => void
}) {
  const t = useT()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-2 pr-6 text-left text-[15px] leading-snug text-[#2A1A12]">
            <AlertTriangle className="animate-heartbeat mt-0.5 h-4.5 w-4.5 shrink-0 text-red-500" />
            {t('dash.pesticide.title')}
          </DialogTitle>
          <DialogDescription className="text-left">{t('dash.pesticide.desc')}</DialogDescription>
        </DialogHeader>

        <ol className="space-y-2">
          {PESTICIDE_STEPS.map((s, i) => {
            const Icon = s.icon
            return (
              <li key={s.key} className="rise-in flex items-start gap-3 rounded-2xl border border-red-100 bg-white p-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-extrabold leading-snug text-gray-800">
                    {i + 1}. {t(s.key)}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-red-50/60 px-3 py-2">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-700">
            <Sprout className="h-3.5 w-3.5" /> {t('dash.tiles.field')} · 2,4 {t('demo.unit.km')}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => {
                onOpenChange(false)
                onMigrate()
              }}
            >
              <Truck className="h-3.5 w-3.5" /> {t('dash.pesticide.migrate')}
            </Button>
            <Button size="sm" className="bg-red-600 font-bold hover:bg-red-700" onClick={() => onOpenChange(false)}>
              {t('dash.pesticide.close')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
