'use client'

/**
 * Экран «Кочёвка»:
 *  • Рекомендация агента по площадкам из справочника SQLite.
 *  • Справочник Минсельхоза области — посевные площади медоносов, даты посева,
 *    обработки пестицидами; от даты посева рассчитывается окно цветения,
 *    по нормативам НИИ пчеловодства (Рыбново) — рекомендуемое число семей
 *    и план распределения (не ближе 3 км / два сорта мёда).
 *  • «Основание» — раскрытые данные по каждому полю (п. 4 ТЗ).
 *  • Сезонность: в зимний покой кочёвка невозможна — агент это честно говорит.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, Landmark, MapPin, Plus, Sprout, TriangleAlert, Wind, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useT } from '@/lib/i18n'
import { useAppState } from '@/lib/store'
import { cn } from '@/lib/utils'
import { fmtNum, type MigrationSite } from '@/lib/hive-model'
import { siteDtoToSite, useRealData } from '@/lib/real-data'
import { migrationPossible, seasonInfo } from '@/lib/season'
import type { CropFieldDto } from '@/app/api/crop-fields/route'

const VERDICT_META = {
  recommend: { label: 'migration.verdict.recommend', cls: 'bg-emerald-100 text-emerald-700', ring: 'border-emerald-300', bar: 'bg-emerald-500' },
  backup: { label: 'migration.verdict.backup', cls: 'bg-amber-100 text-amber-700', ring: 'border-amber-300', bar: 'bg-amber-500' },
  avoid: { label: 'migration.verdict.avoid', cls: 'bg-red-100 text-red-700', ring: 'border-red-200', bar: 'bg-red-400' },
} as const

export function MigrationView() {
  const { status, data } = useRealData()

  if (status === 'idle' || status === 'loading') {
    return <div className="h-64 animate-pulse rounded-2xl bg-red-100/50" />
  }
  const sites = (data?.sites ?? []).map(siteDtoToSite)
  return <MigrationContent sites={sites} />
}

function MigrationContent({ sites }: { sites: MigrationSite[] }) {
  const ask = useAppState((s) => s.ask)
  const setView = useAppState((s) => s.setView)
  const t = useT()
  const best = [...sites].sort((a, b) => b.score - a.score)[0]
  const season = seasonInfo()
  const canMigrate = migrationPossible()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#2A1A12] md:text-3xl">{t('migration.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t('migration.subtitle')}
        </p>
      </div>

      {/* Сезонный баннер: зимой пчёлы в клубе, кочёвка невозможна */}
      {!canMigrate && (
        <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-relaxed text-sky-900">
          <Sprout className="mt-0.5 h-5 w-5 shrink-0 text-sky-500" />
          <div>
            <b>{t(season.titleKey)}.</b> {t('migration.seasonRest')}
          </div>
        </div>
      )}

      {/* Рекомендация */}
      {best ? (
        <div className="rounded-2xl bg-gradient-to-br from-[#2A1A12] to-[#5B16C9] p-5 text-white shadow-lg shadow-red-200 md:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <MapPin className="h-5 w-5 text-emerald-300" />
            <span className="text-xs font-bold uppercase tracking-wider text-white/80">{t('migration.agentVerdict')}</span>
          </div>
          <h2 className="mt-2 text-xl font-extrabold md:text-2xl">
            {t('migration.bestTitle', { name: best.name, score: fmtNum(best.score) })}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/85">
            {t('migration.bestBody', { plant: best.honeyPlant, bloom: best.bloomWindow.toLowerCase(), km: fmtNum(best.distanceKm), weather: best.weatherNote.toLowerCase() })}
            {best.risks ? t('migration.bestRisks', { risks: best.risks.toLowerCase() }) : ''}
            {sites.length > 1
              ? t('migration.bestBackup', { name: [...sites].sort((a, b) => b.score - a.score)[1].name })
              : t('migration.bestAddMore')}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              className="bg-white font-semibold text-[#5B16C9] hover:bg-red-50"
              onClick={() => ask(t('migration.askMove'))}
            >
              {t('migration.discuss')}
            </Button>
            <Button
              variant="outline"
              className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              onClick={() => ask(t('migration.askRisks'))}
            >
              <Wind className="h-4 w-4" /> {t('migration.checkTreatments')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-red-300 bg-red-50/40 p-8 text-center">
          <MapPin className="mx-auto h-8 w-8 text-red-300" />
          <h2 className="mt-3 text-lg font-extrabold text-[#2A1A12]">{t('migration.emptyTitle')}</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-gray-500">
            {t('migration.emptyBody')}
          </p>
          <Button onClick={() => setView('data')} className="mt-4 bg-orange-500 hover:bg-orange-600">
            <Plus className="h-4 w-4" /> {t('migration.addSite')}
          </Button>
        </div>
      )}

      {/* Справочник Минсельхоза: поля медоносов + расчёт цветения + рекомендации ИИ */}
      <CropFieldsSection />

      {/* Карточки площадок */}
      <div className="space-y-3">
        {sites.map((s) => {
          const v = VERDICT_META[s.verdict]
          return (
            <Card key={s.id} className={cn('shadow-sm', v.ring)}>
              <CardContent className="p-4 md:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-sm font-extrabold text-white', v.bar)}>
                    {s.id.slice(0, 1)}
                  </span>
                  <h3 className="font-bold text-gray-900">{s.name}</h3>
                  <span className={cn('ml-auto rounded-full px-2.5 py-1 text-xs font-bold', v.cls)}>{t(v.label)}</span>
                </div>
                <div className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  <p className="text-gray-600"><span className="font-semibold text-gray-800">{t('migration.honeyPlant')}</span> {s.honeyPlant}</p>
                  <p className="text-gray-600"><span className="font-semibold text-gray-800">{t('migration.bloom')}</span> {s.bloomWindow}</p>
                  <p className="text-gray-600"><span className="font-semibold text-gray-800">{t('migration.distance')}</span> {fmtNum(s.distanceKm)} {t('migration.unit.km')}</p>
                  <p className="text-gray-600"><span className="font-semibold text-gray-800">{t('migration.weather')}</span> {s.weatherNote}</p>
                </div>
                {s.risks && (
                  <p className="mt-2 flex items-start gap-1.5 text-sm text-gray-600">
                    {s.verdict === 'avoid' ? (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                    ) : (
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    )}
                    <span><span className="font-semibold text-gray-800">{t('migration.risks')}</span> {s.risks}</span>
                  </p>
                )}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
                    <span>{t('migration.agentScore')}</span>
                    <span>{fmtNum(s.score)} / 10</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-gray-100">
                    <div
                      className={cn('h-2 rounded-full', v.bar)}
                      style={{ width: `${Math.max(4, Math.min(100, s.score * 10))}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Что проверяет агент */}
      <Card className="border-red-100 bg-red-50/50 shadow-sm">
        <CardContent className="p-4">
          <p className="text-sm font-bold text-[#2A1A12]">{t('migration.checksTitle')}</p>
          <ul className="mt-2 grid gap-1.5 text-xs leading-relaxed text-gray-600 sm:grid-cols-2">
            <li>• {t('migration.checks.honey')}</li>
            <li>• {t('migration.checks.weather')}</li>
            <li>• {t('migration.checks.distance')}</li>
            <li>• {t('migration.checks.treatments')}</li>
            <li>• {t('migration.checks.water')}</li>
            <li>• {t('migration.checks.people')}</li>
          </ul>
        </CardContent>
      </Card>

      <p className="text-xs leading-relaxed text-gray-400">
        {t('migration.disclaimer')}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Справочник Минсельхоза: поля медоносов и рекомендации ИИ            */
/* ------------------------------------------------------------------ */

function CropFieldsSection() {
  const t = useT()
  const ask = useAppState((s) => s.ask)
  const [fields, setFields] = useState<CropFieldDto[] | null>(null)
  const [distribution, setDistribution] = useState<Array<{ label: string; fields: string[]; twoHoneyTypes: boolean; split: string }>>([])
  const [families, setFamilies] = useState('120')
  const [openBasis, setOpenBasis] = useState<string | null>(null)
  const familiesRef = useRef(families)

  const load = useCallback(async (n: number) => {
    try {
      const res = await fetch(`/api/crop-fields?families=${n}`)
      if (!res.ok) return
      const j = (await res.json()) as { fields: CropFieldDto[]; distribution: typeof distribution }
      setFields(j.fields)
      setDistribution(j.distribution)
    } catch {
      // сеть недоступна — остаёмся на скелетоне
    }
  }, [])

  /** Кнопка «Рассчитать»: берём текущее значение из input через ref. */
  const plan = useCallback(() => {
    void load(Number(familiesRef.current) || 0)
  }, [load])

  // Первичная загрузка справочника: через таймер, чтобы setState шёл
  // из колбэка внешней системы (правило react-hooks/set-state-in-effect).
  useEffect(() => {
    const id = setTimeout(() => void load(Number(familiesRef.current) || 0), 0)
    return () => clearTimeout(id)
  }, [load])

  return (
    <Card className="border-amber-200 bg-amber-50/40 shadow-sm">
      <CardContent className="p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Landmark className="h-5 w-5 text-amber-600" />
          <h2 className="text-lg font-extrabold text-[#2A1A12]">{t('mig.crops.title')}</h2>
          <span className="ml-auto rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
            {t('mig.crops.source')}
          </span>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{t('mig.crops.subtitle')}</p>

        {!fields ? (
          <div className="mt-4 h-40 animate-pulse rounded-xl bg-amber-100/60" />
        ) : (
          <div className="mt-4 space-y-3">
            {fields.map((f) => (
              <CropFieldCard
                key={f.id}
                f={f}
                basisOpen={openBasis === f.id}
                onToggleBasis={() => setOpenBasis(openBasis === f.id ? null : f.id)}
              />
            ))}

            {/* План распределения семей */}
            <div className="rounded-xl border border-amber-200 bg-white p-4">
              <p className="text-sm font-bold text-[#2A1A12]">{t('mig.crops.distributionTitle')}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Input
                  value={families}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 4)
                    setFamilies(v)
                    familiesRef.current = v
                  }}
                  inputMode="numeric"
                  className="w-28 text-center"
                  placeholder="120"
                />
                <Button className="bg-orange-500 hover:bg-orange-600" onClick={plan}>
                  {t('mig.crops.planBtn')}
                </Button>
                <Button
                  variant="outline"
                  className="border-amber-300 text-amber-800 hover:bg-amber-100"
                  onClick={() => ask(t('mig.crops.askPlan', { n: familiesRef.current || '120' }))}
                >
                  {t('mig.crops.askAi')}
                </Button>
              </div>
              {distribution.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {distribution.map((d, i) => (
                    <li key={i} className="rounded-lg bg-amber-50 p-3 text-sm leading-relaxed text-gray-700">
                      <b className="text-[#2A1A12]">{d.label}</b>
                      {d.twoHoneyTypes && (
                        <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                          {t('mig.crops.twoHoney')}
                        </span>
                      )}
                      <br />{d.split}
                    </li>
                  ))}
                </ul>
              )}
              {distribution.length === 0 && Number(families) > 0 && fields.length > 0 && (
                <p className="mt-2 text-xs text-gray-400">{t('mig.crops.noPlan')}</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function CropFieldCard({ f, basisOpen, onToggleBasis }: { f: CropFieldDto; basisOpen: boolean; onToggleBasis: () => void }) {
  const t = useT()
  const rec = f.recommend
  return (
    <div className="rounded-xl border border-amber-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-bold text-gray-900">{f.name}</h3>
        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-bold text-stone-600">{f.cultureName}</span>
        {f.bloomingNow && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">{t('mig.crops.bloomingNow')}</span>
        )}
        <span className="ml-auto text-xs font-semibold text-gray-400">
          {f.isMinselhoz ? t('mig.crops.minselhozField') : t('mig.crops.ownField')}
        </span>
      </div>

      <div className="mt-2 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        <p className="text-gray-600"><span className="font-semibold text-gray-800">{t('mig.crops.area')}</span> {fmtNum(f.areaHa)} {t('mig.crops.ha')}</p>
        <p className="text-gray-600"><span className="font-semibold text-gray-800">{t('mig.crops.bloom')}</span> {f.bloomText}</p>
        <p className="text-gray-600"><span className="font-semibold text-gray-800">{t('mig.crops.district')}</span> {f.district || '—'}</p>
        <p className="text-gray-600"><span className="font-semibold text-gray-800">{t('migration.distance')}</span> {fmtNum(f.distanceKm)} {t('migration.unit.km')}</p>
      </div>

      {/* Расчёт цветения от даты посева */}
      {f.bloomSource === 'sowing' && f.bloomDeviationDays !== null && (
        <p className="mt-2 text-xs leading-relaxed text-gray-500">
          {t(f.bloomDeviationDays >= 0 ? 'mig.crops.bloomLater' : 'mig.crops.bloomEarlier', { d: Math.abs(f.bloomDeviationDays) })}
        </p>
      )}

      {/* Рекомендация ИИ: сколько семей вывозить */}
      {rec && (
        <div className={cn('mt-3 rounded-lg p-3 text-sm leading-relaxed', rec.oversaturation ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-gray-700')}>
          <b className="text-[#2A1A12]">{t('mig.crops.recommendTitle')}</b>{' '}
          {t('mig.crops.recommendFamilies', { min: rec.min, max: rec.max })}
          {rec.oversaturation ? ` ${t('mig.crops.oversaturation')}` : ''}
          <br />
          <span className="text-xs text-gray-500">{rec.note} · {t('mig.crops.honeyPerFamily', { kg: rec.honeyPerFamilyKg })}</span>
        </div>
      )}

      {/* Обработка пестицидами — предупреждение */}
      {f.treatments.length > 0 && (
        <p className="mt-2 flex items-start gap-1.5 text-sm text-gray-600">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <span>
            <span className="font-semibold text-gray-800">{t('mig.crops.treatments')}</span>{' '}
            {f.treatments.map((tr) => `${tr.date.split('-').reverse().join('.')} — ${tr.drug} (${t('mig.crops.hazard')} ${tr.hazardClass})`).join('; ')}
          </span>
        </p>
      )}

      {/* Основание: раскрытые данные Минсельхоза */}
      <button onClick={onToggleBasis} className="mt-3 flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-800">
        <ChevronDown className={cn('h-4 w-4 transition-transform', basisOpen && 'rotate-180')} />
        {t('mig.crops.basisTitle')}
      </button>
      {basisOpen && (
        <div className="mt-2 rounded-lg bg-stone-50 p-3 text-xs leading-relaxed text-gray-600">
          <p><b>{t('mig.crops.basisArea')}:</b> {fmtNum(f.areaHa)} {t('mig.crops.ha')} · <b>{t('mig.crops.district')}:</b> {f.district || '—'}</p>
          <p><b>{t('mig.crops.sowingDate')}:</b> {f.sowingDate ? f.sowingDate.split('-').reverse().join('.') : '—'} ({f.bloomSource === 'sowing' ? t('mig.crops.bloomFromSowing') : t('mig.crops.bloomEtalon')})</p>
          <p><b>{t('mig.crops.cultureNote')}:</b> {f.cultureNote}</p>
          {f.treatments.length > 0 && (
            <p><b>{t('mig.crops.treatmentsBasis')}:</b> {f.treatments.map((tr) => `${tr.date.split('-').reverse().join('.')}, ${tr.drug}, ${t('mig.crops.hazard')} ${tr.hazardClass}${tr.note ? ` — ${tr.note}` : ''}`).join('; ')}</p>
          )}
          <p className="mt-1 text-gray-400">{f.isMinselhoz ? t('mig.crops.basisMinselhoz') : t('mig.crops.basisOwn')}</p>
        </div>
      )}
    </div>
  )
}
