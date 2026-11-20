'use client'

/**
 * Графики телеметрии: вес улья, климат внутри улья, масса улья столбиками.
 * recharts, фирменные цвета: красный #E93A2D, оранжевый #FF5A1F.
 * Цвета осей и сетки подстраиваются под тему (light/dark).
 */
import { useAppState } from '@/lib/store'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { chartSeries, fmtNum, fmtSigned, type DayPoint, type Hive } from '@/lib/hive-model'
import { weightDeltaSafe } from '@/lib/real-data'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const RED = '#E93A2D'
const ORANGE = '#FF5A1F'
const AMBER = '#E9A03B'

/** Палитра осей/сетки графиков, зависящая от темы. */
function useChartTheme() {
  const theme = useAppState((s) => s.theme)
  const dark =
    theme === 'dark' ||
    (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  return {
    dark,
    tick: dark ? '#9C8C80' : '#A8968A',
    grid: dark ? '#3A2B24' : '#F0E4DC',
    red: dark ? '#FF7A5C' : RED,
    amber: dark ? '#FFB25C' : AMBER,
    orange: dark ? '#FF8A4C' : ORANGE,
    tooltipBg: dark ? 'rgba(34,24,20,0.96)' : 'rgba(255,255,255,0.95)',
    tooltipBorder: dark ? '#4A382E' : '#F0E4DC',
  }
}

interface TooltipEntry {
  name?: string
  value?: number | string
  color?: string
  dataKey?: string | number
}

function ChartTooltip({
  active,
  payload,
  label,
  full,
}: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string | number
  full?: string
}) {
  const ct = useChartTheme()
  const t = useT()
  if (!active || !payload?.length) return null
  const meta: Record<string, { name: string; unit: string }> = {
    weightKg: { name: t('chart.weight'), unit: t('chart.kg') },
    tempInC: { name: t('chart.temp'), unit: '°C' },
    humidityPct: { name: t('chart.humidity'), unit: '%' },
  }
  return (
    <div
      className="rounded-xl border px-3 py-2 shadow-lg backdrop-blur"
      style={{ background: ct.tooltipBg, borderColor: ct.tooltipBorder }}
    >
      <p className="text-xs font-semibold text-[#2A1A12]">{full ?? label}</p>
      {payload.map((e) => {
        const m = meta[String(e.dataKey)]
        if (!m || e.value === null || e.value === undefined || e.value === 'null') return null
        return (
          <p key={String(e.dataKey)} className="mt-0.5 flex items-center gap-1.5 text-xs">
            <span className="h-2 w-2 rounded-full" style={{ background: e.color }} />
            <span className="text-gray-600">{m.name}:</span>
            <span className="font-semibold text-[#2A1A12]">
              {fmtNum(Number(e.value), Number(e.value) % 1 === 0 ? 0 : 1)} {m.unit}
            </span>
          </p>
        )
      })}
      {payload.some((e) => e.dataKey === 'humidityPct' && (e.value === null || e.value === undefined)) && (
        <p className="mt-0.5 text-xs text-gray-400">{t('chart.humidityNoData')}</p>
      )}
    </div>
  )
}

function injectFull(data: DayPoint[]): Array<DayPoint & { full: string }> {
  return data.map((d) => ({ ...d }))
}

/* ------------------------------------------------------------------ */
/* Большой график веса (30 дней) с зоной риска                         */
/* ------------------------------------------------------------------ */

export function WeightChart({ hive, risky }: { hive: Hive; risky: boolean }) {
  const ct = useChartTheme()
  const t = useT()
  const data = injectFull(chartSeries(hive, 30))
  const labels = data.map((d) => d.label)
  const x1 = labels.length >= 3 ? labels[labels.length - 3] : labels[0]
  const x2 = labels[labels.length - 1]
  const drop = weightDeltaSafe(hive, 2)
  const from = data[0]?.full
  const to = data[data.length - 1]?.full
  return (
    <div>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ct.red} stopOpacity={0.32} />
                <stop offset="100%" stopColor={ct.red} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: ct.tick }}
              tickLine={false}
              axisLine={false}
              minTickGap={28}
            />
            <YAxis
              domain={['dataMin - 2', 'dataMax + 1']}
              tick={{ fontSize: 11, fill: ct.tick }}
              tickLine={false}
              axisLine={false}
              width={38}
              tickFormatter={(v: number) => String(Math.round(v))}
            />
            <Tooltip content={<ChartTooltip />} />
            {risky && (
              <ReferenceArea
                x1={x1}
                x2={x2}
                fill={ct.orange}
                fillOpacity={0.1}
                stroke={ct.orange}
                strokeOpacity={0.4}
                strokeDasharray="4 3"
              />
            )}
            <Area
              type="monotone"
              dataKey="weightKg"
              stroke={ct.red}
              strokeWidth={2.5}
              fill="url(#weightGrad)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full" style={{ background: ct.red }} />
          {t('chart.hiveWeight')}
        </span>
        {risky && drop !== null && (
          <span className="flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded border border-dashed"
              style={{ borderColor: ct.orange, background: 'rgba(255,90,31,0.1)' }}
            />
            {t('chart.drop2d', { n: fmtSigned(drop) })}
          </span>
        )}
        {from && to && (
          <span className="ml-auto text-[11px] text-gray-400">
            {from} — {to}
          </span>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Климат: температура + влажность (14 дней)                           */
/* ------------------------------------------------------------------ */

export function ClimateChart({ hive }: { hive: Hive }) {
  const ct = useChartTheme()
  const t = useT()
  const data = injectFull(chartSeries(hive, 14))
  return (
    <div>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: ct.tick }}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis
              yAxisId="t"
              domain={['dataMin - 0.5', 'dataMax + 0.5']}
              tick={{ fontSize: 11, fill: ct.tick }}
              tickLine={false}
              axisLine={false}
              width={38}
              tickFormatter={(v: number) => String(Math.round(v))}
            />
            <YAxis
              yAxisId="h"
              orientation="right"
              domain={['dataMin - 3', 'dataMax + 3']}
              tick={{ fontSize: 11, fill: ct.tick }}
              tickLine={false}
              axisLine={false}
              width={34}
              tickFormatter={(v: number) => String(Math.round(v))}
            />
            <Tooltip content={<ChartTooltip />} />
            <Line
              yAxisId="t"
              type="monotone"
              dataKey="tempInC"
              stroke={ct.red}
              strokeWidth={2.4}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              connectNulls
            />
            <Line
              yAxisId="h"
              type="monotone"
              dataKey="humidityPct"
              stroke={ct.amber}
              strokeWidth={2.2}
              strokeDasharray="6 4"
              dot={false}
              connectNulls={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full" style={{ background: ct.red }} />
          {t('chart.tempC')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 border-t-2 border-dashed" style={{ borderColor: ct.amber }} />
          {t('chart.humPct')}
        </span>
        {!hive.humiditySensorOk && (
          <span className="flex items-center gap-1.5 text-gray-400">
            <span className="h-2 w-2 rounded-full bg-gray-300" />
            {hive.humidityOfflineFrom ? t('chart.humNoDataSince', { d: hive.humidityOfflineFrom }) : t('chart.humNoData')}
          </span>
        )}
        <span className="ml-auto text-[11px] text-gray-400">{t('chart.last14d')}</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Компактные карточки-графики для дашборда «Состояние пасеки»         */
/* ------------------------------------------------------------------ */

/** Мини-линия одного показателя (температура, влажность или масса), 14 дней. */
export function MetricLine({ hive, metric }: { hive: Hive; metric: 'tempInC' | 'humidityPct' | 'weightKg' }) {
  const ct = useChartTheme()
  const data = injectFull(chartSeries(hive, 14))
  const color = metric === 'tempInC' ? ct.red : metric === 'weightKg' ? ct.orange : ct.amber
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: ct.tick }} tickLine={false} axisLine={false} minTickGap={26} />
        <YAxis
          domain={['dataMin - 1', 'dataMax + 1']}
          tick={{ fontSize: 10, fill: ct.tick }}
          tickLine={false}
          axisLine={false}
          width={32}
          tickFormatter={(v: number) => String(Math.round(v))}
        />
        <Tooltip content={<ChartTooltip />} />
        <Line
          type="monotone"
          dataKey={metric}
          stroke={color}
          strokeWidth={2.2}
          dot={false}
          activeDot={{ r: 3.5, strokeWidth: 0 }}
          connectNulls={metric !== 'humidityPct'}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

/** Масса улья столбиками (14 дней) — как «Масса улья» на референсе. */
export function WeightBars({ hive }: { hive: Hive }) {
  const ct = useChartTheme()
  const data = injectFull(chartSeries(hive, 14))
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: ct.tick }} tickLine={false} axisLine={false} minTickGap={26} />
        <YAxis
          domain={['dataMin - 2', 'dataMax + 2']}
          tick={{ fontSize: 10, fill: ct.tick }}
          tickLine={false}
          axisLine={false}
          width={32}
          tickFormatter={(v: number) => String(Math.round(v))}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(233,58,45,0.08)' }} />
        <Bar dataKey="weightKg" fill={ct.red} radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Мини-спарклайн для карточек выбора улья */
export function Sparkline({ data, className, stroke = RED }: { data: number[]; className?: string; stroke?: string }) {
  const w = 120
  const hgt = 34
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${hgt - 3 - ((v - min) / span) * (hgt - 8)}`)
    .join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${hgt}`} className={cn('w-full', className)} aria-hidden="true" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
