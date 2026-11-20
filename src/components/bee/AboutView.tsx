'use client'

/**
 * Экран «Справка»: четыре сценария агента, словарь проекта,
 * принцип Data Driven и список возможностей приложения.
 */
import { ArrowRight, BookOpen, CloudSun, SprayCan, Split, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAppState } from '@/lib/store'
import { useT } from '@/lib/i18n'

const SCENARIOS = [
  {
    icon: Split,
    color: 'bg-red-100 text-red-700',
    title: 'about.sc1.title',
    text: 'about.sc1.text',
    example: 'about.sc1.example',
  },
  {
    icon: SprayCan,
    color: 'bg-orange-100 text-orange-700',
    title: 'about.sc2.title',
    text: 'about.sc2.text',
    example: 'about.sc2.example',
  },
  {
    icon: CloudSun,
    color: 'bg-sky-100 text-sky-700',
    title: 'about.sc3.title',
    text: 'about.sc3.text',
    example: 'about.sc3.example',
  },
  {
    icon: Truck,
    color: 'bg-emerald-100 text-emerald-700',
    title: 'about.sc4.title',
    text: 'about.sc4.text',
    example: 'about.sc4.example',
  },
]

const DICTIONARY = [
  {
    term: 'about.dict1.term',
    text: 'about.dict1.text',
  },
  {
    term: 'about.dict2.term',
    text: 'about.dict2.text',
  },
  {
    term: 'about.dict3.term',
    text: 'about.dict3.text',
  },
  {
    term: 'about.dict4.term',
    text: 'about.dict4.text',
  },
]

const MVP_CHECKLIST = [
  'about.mvp1',
  'about.mvp2',
  'about.mvp3',
  'about.mvp4',
  'about.mvp5',
  'about.mvp6',
  'about.mvp7',
  'about.mvp8',
  'about.mvp9',
]

export function AboutView() {
  const setView = useAppState((s) => s.setView)
  const t = useT()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#2A1A12] md:text-3xl">{t('about.title')}</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-gray-500">
          {t('about.intro')}
        </p>
      </div>

      {/* Четыре сценария */}
      <div>
        <h2 className="mb-3 text-lg font-bold text-[#2A1A12]">{t('about.scenariosTitle')}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {SCENARIOS.map((s) => (
            <Card key={s.title} className="border-red-100 shadow-sm">
              <CardContent className="p-4 md:p-5">
                <div className="flex items-center gap-2.5">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.color}`}>
                    <s.icon className="h-4.5 w-4.5" />
                  </span>
                  <h3 className="font-bold text-gray-900">{t(s.title)}</h3>
                </div>
                <p className="mt-2.5 text-sm leading-relaxed text-gray-600">{t(s.text)}</p>
                <p className="mt-2 rounded-lg bg-red-50/70 px-3 py-2 text-xs font-semibold text-red-700">{t(s.example)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Словарь */}
        <Card className="border-red-100 shadow-sm">
          <CardContent className="p-4 md:p-5">
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#2A1A12]">
              <BookOpen className="h-5 w-5 text-red-600" /> {t('about.dictTitle')}
            </h2>
            <dl className="mt-3 space-y-3">
              {DICTIONARY.map((d) => (
                <div key={d.term} className="rounded-xl border border-red-50 bg-red-50/40 p-3">
                  <dt className="text-sm font-bold text-red-800">{t(d.term)}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-gray-600">{t(d.text)}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        {/* Принципы и MVP */}
        <div className="space-y-4">
          <Card className="border-red-100 bg-gradient-to-br from-red-600 to-[#5B16C9] text-white shadow-sm">
            <CardContent className="p-4 md:p-5">
              <h2 className="text-lg font-bold">{t('about.principleTitle')}</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/90">
                {t('about.principleText')}
              </p>
              <ul className="mt-3 space-y-1.5 text-sm text-white/85">
                <li>• {t('about.principle1')}</li>
                <li>• {t('about.principle2')}</li>
                <li>• {t('about.principle3')}</li>
                <li>• {t('about.principle4')}</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-red-100 shadow-sm">
            <CardContent className="p-4 md:p-5">
              <h2 className="text-lg font-bold text-[#2A1A12]">{t('about.mvpTitle')}</h2>
              <ul className="mt-3 space-y-2 text-sm text-gray-600">
                {MVP_CHECKLIST.map((c) => (
                  <li key={c} className="flex items-start gap-2">
                    <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">
                      ✓
                    </span>
                    {t(c)}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button className="bg-red-600 hover:bg-red-700" onClick={() => setView('dashboard')}>
                  {t('about.openDashboard')} <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => setView('agent')}>
                  {t('about.askAgent')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-gray-400">
        {t('about.footerNote')}
      </p>
    </div>
  )
}
