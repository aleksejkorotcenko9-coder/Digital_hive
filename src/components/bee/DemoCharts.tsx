'use client'

/**
 * Графики и живые элементы демо-режима:
 *  — VarroaChart: динамика заклещенности 30 дней + пунктирный прогноз «+14 дней»
 *    и красная пунктирная линия критического порога 3 %;
 *  — DemoClimateMini / DemoWeightBars: серии сценарного улья;
 *  — AcousticSpark: живой спарклайн гула (последние ~60 с, тик 2 с);
 *  — LiveValue: число, которое мягко подсвечивается при обновлении;
 *  — Rise: появление блока (framer-motion, transform/opacity).
 */
import { useCallback, useEffect, useId, useState } from 'react'
import { motion, useMotionValueEvent, useSpring } from 'framer-motion'
import {
  AudioLines,
  Cctv,
  CloudSun,
  Droplets,
  Flower2,
  Gauge,
  LineChart as LineChartIcon,
  Scale,
  Thermometer,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fmtNum, fmtSigned } from '@/lib/hive-model'
import type { VarroaPoint } from '@/lib/demo-hives'
import { EVIDENCE_SENSOR_LABEL, type EvidenceSensor } from '@/lib/demo-hives'
import { tr, useT } from '@/lib/i18n'
import { useAppState } from '@/lib/store'
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
/* Тема графиков (light/dark) — та же палитра, что в charts.tsx        */
/* ------------------------------------------------------------------ */

function useDemoChartTheme() {
  const theme = useAppState((s) => s.theme)
  const dark =
    theme === 'dark' ||
    (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  return {
    tick: dark ? '#9C8C80' : '#A8968A',
    grid: dark ? '#3A2B24' : '#F0E4DC',
    red: dark ? '#FF7A5C' : '#E93A2D',
    orange: dark ? '#FF8A4C' : '#FF5A1F',
    amber: dark ? '#FFB25C' : '#E9A03B',
    green: dark ? '#62C79F' : '#3BA55D',
    tooltipBg: dark ? 'rgba(34,24,20,0.96)' : 'rgba(255,255,255,0.95)',
    tooltipBorder: dark ? '#4A382E' : '#F0E4DC',
  }
}

/* ------------------------------------------------------------------ */
/* Иконки сенсоров для доказательств                                   */
/* ------------------------------------------------------------------ */

export const SENSOR_ICON: Record<EvidenceSensor, typeof Scale> = {
  scales: Scale,
  mic: AudioLines,
  cam: Cctv,
  gas: Gauge,
  temp: Thermometer,
  hum: Droplets,
  gdd: Flower2,
  weather: CloudSun,
  stats: LineChartIcon,
}

export function EvidenceRow({ sensor, text }: { sensor: EvidenceSensor; text: string }) {
  const tf = useTF()
  const Icon = SENSOR_ICON[sensor]
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold uppercase tracking-wide text-gray-400">
          {tf(`demo.evidence.sensor.${sensor}`, EVIDENCE_SENSOR_LABEL[sensor])}
        </span>
        <span className="block text-[13px] leading-relaxed text-gray-700">{text}</span>
      </span>
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* Появление блоков и подсветка живых чисел                            */
/* ------------------------------------------------------------------ */

export function Rise({
  delay = 0,
  className,
  children,
}: {
  delay?: number
  className?: string
  children: React.ReactNode
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

/** Живое число: при каждом обновлении коротко подсвечивается (чистый CSS,
 *  без состояния и эффектов — remount по key перезапускает анимацию). */
export function LiveValue({ value, className }: { value: string; className?: string }) {
  return (
    <span className={cn('inline-block rounded', className)}>
      <span key={value} className="live-flash inline-block rounded">
        {value}
      </span>
    </span>
  )
}

/** Пружинный счётчик: возвращает строку числа, которое плавно «докатывается»
 *  до нового значения (framer useSpring — рендер только на время движения). */
export function useSpringText(value: number, digits = 1): string {
  const [text, setText] = useState(() => fmtNum(value, digits))
  const mv = useSpring(value, { stiffness: 130, damping: 22, mass: 0.7 })
  useMotionValueEvent(mv, 'change', (v) => setText(fmtNum(v as number, digits)))
  useEffect(() => {
    mv.set(value)
  }, [value, mv])
  return text
}

/** Живое число с пружиной: значение плавно катится к новому и на каждый тик
 *  коротко вспыхивает. Дешёво: анимируется только текст внутри span'а. */
export function AnimatedNumber({
  value,
  digits = 1,
  className,
  flash = true,
}: {
  value: number
  digits?: number
  className?: string
  flash?: boolean
}) {
  const text = useSpringText(value, digits)
  return (
    <span className={cn('inline-block rounded', className)}>
      <span key={fmtNum(value, digits)} className={cn('inline-block rounded', flash && 'live-flash')}>
        {text}
      </span>
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Динамика заклещенности (Varroa)                                     */
/* ------------------------------------------------------------------ */

export function VarroaChart({ data }: { data: VarroaPoint[] }) {
  const ct = useDemoChartTheme()
  const t = useT()
  const yMax = Math.max(3.5, Math.max(...data.map((d) => Math.max(d.pct ?? 0, d.forecast ?? 0)), 0) + 0.6)
  const treated = data.filter((d) => d.treated && d.pct !== null)
  return (
    <div>
      <div className="h-[190px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: ct.tick }} tickLine={false} axisLine={false} minTickGap={28} />
            <YAxis
              domain={[0, yMax]}
              tick={{ fontSize: 10, fill: ct.tick }}
              tickLine={false}
              axisLine={false}
              width={32}
              tickFormatter={(v: number) => `${Math.round(v)}`}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const p = payload[0]?.payload as VarroaPoint
                return (
                  <div
                    className="rounded-xl border px-3 py-2 text-xs shadow-lg backdrop-blur"
                    style={{ background: ct.tooltipBg, borderColor: ct.tooltipBorder }}
                  >
                    <p className="font-semibold text-[#2A1A12]">{String(label)}</p>
                    {p.pct !== null && <p className="mt-0.5">{t('dash.varroa.tooltip', { p: fmtNum(p.pct) })}</p>}
                    {p.forecast !== null && (
                      <p className="mt-0.5 text-red-600">{t('dash.varroa.tooltipForecast', { p: fmtNum(p.forecast) })}</p>
                    )}
                    {p.treated && <p className="mt-0.5 text-emerald-600">{t('dash.varroa.tooltipTreated')}</p>}
                  </div>
                )
              }}
            />
            {/* критический порог 3 % */}
            <ReferenceLine
              y={3}
              stroke={ct.red}
              strokeDasharray="6 4"
              strokeOpacity={0.75}
              label={{
                value: t('dash.varroa.threshold'),
                position: 'insideTopRight',
                fontSize: 10,
                fill: ct.red,
              }}
            />
            <Line
              type="monotone"
              dataKey="pct"
              stroke={ct.amber}
              strokeWidth={2.6}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              connectNulls={false}
              isAnimationActive
              animationDuration={1100}
              animationEasing="ease-out"
            />
            {/* пунктирный сегмент прогноза: последнее значение → +14 дней */}
            <Line
              type="monotone"
              dataKey="forecast"
              stroke={ct.red}
              strokeWidth={2.2}
              strokeDasharray="5 5"
              dot={{ r: 3, fill: ct.red, strokeWidth: 0 }}
              connectNulls
              isAnimationActive
              animationDuration={1400}
              animationEasing="ease-out"
            />
            {/* отметки проведенных обработок — влияние на кривую */}
            {treated.map((d) => (
              <ReferenceDot key={d.label} x={d.label} y={d.pct as number} r={5} fill={ct.green} stroke="#fff" strokeWidth={1.5} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full" style={{ background: ct.amber }} />
          {t('dash.chart.varroa.legend')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 border-t-2 border-dashed" style={{ borderColor: ct.red }} />
          {t('dash.chart.varroa.legendForecast')}
        </span>
        {treated.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: ct.green }} />
            {t('dash.chart.varroa.legendTreated')}
          </span>
        )}
        <span className="ml-auto text-[11px] text-gray-400">{t('dash.chart.varroa.range')}</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Мини-графики климата и живой спарклайн                              */
/* ------------------------------------------------------------------ */

interface ClimatePoint {
  label: string
  tempInC: number | null
  humidityPct: number | null
}

export function DemoClimateMini({ data, metric }: { data: ClimatePoint[]; metric: 'tempInC' | 'humidityPct' }) {
  const ct = useDemoChartTheme()
  const tf = useTF()
  const color = metric === 'tempInC' ? ct.red : ct.amber
  // градиентная заливка под линией — уникальный id на экземпляр графика
  const gid = useId().replace(/[:«»]/g, '')
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.26} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
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
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const v = Number(payload[0].value)
            return (
              <div
                className="rounded-xl border px-3 py-2 text-xs shadow-lg backdrop-blur"
                style={{ background: ct.tooltipBg, borderColor: ct.tooltipBorder }}
              >
                <p className="font-semibold text-[#2A1A12]">{String(label)}</p>
                <p>
                  {tf(metric === 'tempInC' ? 'dash.chart.temp' : 'dash.chart.hum', metric === 'tempInC' ? 'Температура' : 'Влажность')}:{' '}
                  <b>{fmtNum(v, metric === 'tempInC' ? 1 : 0)} {metric === 'tempInC' ? '°C' : '%'}</b>
                </p>
              </div>
            )
          }}
        />
        <Area
          type="monotone"
          dataKey={metric}
          stroke={color}
          strokeWidth={2.4}
          fill={`url(#${gid})`}
          dot={false}
          activeDot={{ r: 3.5, strokeWidth: 0 }}
          connectNulls
          isAnimationActive
          animationDuration={1000}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export interface WeightPoint {
  label: string
  weightKg: number | null
}

export function DemoWeightBars({ data }: { data: WeightPoint[] }) {
  const ct = useDemoChartTheme()
  const tf = useTF()
  const gid = useId().replace(/[:«»]/g, '')
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ct.red} stopOpacity={0.22} />
            <stop offset="100%" stopColor={ct.red} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: ct.tick }} tickLine={false} axisLine={false} minTickGap={26} />
        <YAxis
          domain={['dataMin - 1.5', 'dataMax + 1']}
          tick={{ fontSize: 10, fill: ct.tick }}
          tickLine={false}
          axisLine={false}
          width={34}
          tickFormatter={(v: number) => String(Math.round(v))}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const v = Number(payload[0].value)
            return (
              <div
                className="rounded-xl border px-3 py-2 text-xs shadow-lg backdrop-blur"
                style={{ background: ct.tooltipBg, borderColor: ct.tooltipBorder }}
              >
                <p className="font-semibold text-[#2A1A12]">{String(label)}</p>
                <p>
                  {tf('demo.chart.weightLabel', 'Вес')}: <b>{fmtNum(v)} {tf('demo.unit.kg', 'кг')}</b>
                </p>
              </div>
            )
          }}
        />
        <Area
          type="monotone"
          dataKey="weightKg"
          stroke={ct.red}
          strokeWidth={2.6}
          fill={`url(#${gid})`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
          connectNulls
          isAnimationActive
          animationDuration={1000}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/** Живой спарклайн гула: последние ~30 тиков (≈60 с). */
export function AcousticSpark({ data }: { data: number[] }) {
  const ct = useDemoChartTheme()
  const points = data.map((hz, i) => ({ i, hz: Math.round(hz) }))
  return (
    <div className="h-10 w-full" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <YAxis hide domain={['dataMin - 3', 'dataMax + 3']} />
          <Line
            type="monotone"
            dataKey="hz"
            stroke={ct.orange}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Привесы за 7 дней: столбцы суточного привеса + ночная температура   */
/* ------------------------------------------------------------------ */

export interface GainPoint {
  label: string
  /** Суточный привес, кг (может быть отрицательным в непогоду). */
  gainKg: number
  /** Ночная температура, °C — линия поверх столбцов. */
  nightTempC: number
}

export function GainComboChart({
  data,
  /** Подпись столбцов в тултипе (по умолчанию — «Суточный привес»). */
  gainLabel,
  /** Подпись линии в тултипе (по умолчанию — «Ночью»). */
  tempLabel,
}: {
  data: GainPoint[]
  gainLabel?: string
  tempLabel?: string
}) {
  const ct = useDemoChartTheme()
  const tf = useTF()
  const gid = useId().replace(/[:«»]/g, '')
  return (
    <div className="h-[210px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 6, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ct.orange} stopOpacity={0.95} />
              <stop offset="100%" stopColor={ct.amber} stopOpacity={0.55} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: ct.tick }} tickLine={false} axisLine={false} />
          {/* левая ось: привес, кг */}
          <YAxis
            yAxisId="gain"
            domain={['dataMin - 0.2', 'dataMax + 0.3']}
            tick={{ fontSize: 10, fill: ct.tick }}
            tickLine={false}
            axisLine={false}
            width={34}
            tickFormatter={(v: number) => fmtNum(v, 1)}
          />
          {/* правая ось: ночная температура, °C */}
          <YAxis
            yAxisId="temp"
            orientation="right"
            domain={['dataMin - 2', 'dataMax + 2']}
            tick={{ fontSize: 10, fill: ct.tick }}
            tickLine={false}
            axisLine={false}
            width={30}
            tickFormatter={(v: number) => `${Math.round(v)}°`}
          />
          <Tooltip
            cursor={{ fill: 'rgba(255, 122, 76, 0.08)' }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const p = payload[0]?.payload as GainPoint
              return (
                <div
                  className="rounded-xl border px-3 py-2 text-xs shadow-lg backdrop-blur"
                  style={{ background: ct.tooltipBg, borderColor: ct.tooltipBorder }}
                >
                  <p className="font-semibold text-[#2A1A12]">{String(label)}</p>
                  <p className="mt-0.5">
                    {gainLabel ?? tf('demo.chart.gainLabel', 'Суточный привес')}:{' '}
                    <b>
                      {fmtSigned(p.gainKg, 2)} {tf('demo.unit.kg', 'кг')}
                    </b>
                  </p>
                  <p className="mt-0.5">
                    {tempLabel ?? tf('demo.chart.nightLabel', 'Ночью')}: <b>{fmtNum(p.nightTempC, 1)} °C</b>
                  </p>
                </div>
              )
            }}
          />
          {/* нулевая линия привеса: отрицательный привес — семья «худеет» */}
          <ReferenceLine yAxisId="gain" y={0} stroke={ct.tick} strokeDasharray="2 3" strokeOpacity={0.6} />
          <Bar
            yAxisId="gain"
            dataKey="gainKg"
            fill={`url(#${gid})`}
            radius={[5, 5, 2, 2]}
            maxBarSize={44}
            isAnimationActive
            animationDuration={900}
            animationEasing="ease-out"
          />
          <Line
            yAxisId="temp"
            type="monotone"
            dataKey="nightTempC"
            stroke={ct.red}
            strokeWidth={2.4}
            dot={{ r: 3.2, fill: ct.red, strokeWidth: 0 }}
            activeDot={{ r: 4.5, strokeWidth: 0 }}
            isAnimationActive
            animationDuration={1200}
            animationEasing="ease-out"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Живая плитка и мини-карточка (общие для демо и реального режима)     */
/* ------------------------------------------------------------------ */

/** Живая плитка показателя: число с пружиной и мягкой вспышкой на тике. */
export function LiveTile({
  icon,
  label,
  value,
  num,
  digits = 1,
  suffix,
  hint,
  badge,
  tone = 'red',
}: {
  icon: React.ReactNode
  label: string
  value?: string
  num?: number
  digits?: number
  suffix?: string
  hint?: string
  badge?: React.ReactNode
  tone?: 'red' | 'amber' | 'emerald'
}) {
  const tones = {
    red: 'border-red-50 bg-red-50/40 text-red-400',
    amber: 'border-amber-100 bg-amber-50/50 text-amber-500',
    emerald: 'border-emerald-100 bg-emerald-50/50 text-emerald-600',
  } as const
  return (
    <div className={cn('rounded-xl border px-3 py-2.5', tones[tone])}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500">
        <span>{icon}</span>
        {label}
      </p>
      <p className="mt-1 flex flex-wrap items-baseline gap-1.5 text-lg font-extrabold leading-none text-gray-900">
        {num !== undefined ? (
          <AnimatedNumber value={num} digits={digits} />
        ) : (
          <LiveValue value={value ?? ''} />
        )}
        {suffix && <span className="text-[11px] font-bold text-gray-400">{suffix}</span>}
        {badge}
      </p>
      {hint && <p className="mt-1 text-[10px] leading-tight text-gray-400">{hint}</p>}
    </div>
  )
}

/** Мини-карточка с графиком: заголовок + живое значение + область 170px. */
export function MiniCard({
  title,
  value,
  note,
  icon,
  headerExtra,
  children,
}: {
  title: string
  value: React.ReactNode
  note: string
  icon: React.ReactNode
  headerExtra?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm dark:bg-[#221814]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-[#2A1A12]">
          <span className="text-red-400">{icon}</span>
          {title}
        </h3>
        <span className="text-base font-extrabold text-red-600">
          {typeof value === 'string' ? <LiveValue value={value} /> : value}
        </span>
      </div>
      {headerExtra && <div className="mt-1.5 flex flex-wrap items-center gap-1.5">{headerExtra}</div>}
      <div className="mt-1.5 h-[170px]">{children}</div>
      <p className="mt-1 text-[11px] leading-snug text-gray-400">{note}</p>
    </div>
  )
}

/* Значок «график» для компактных карточек сенсоров */
export function SensorCardIcon({ children, tone }: { children: React.ReactNode; tone: 'red' | 'amber' | 'green' | 'sky' }) {
  const tones = {
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-emerald-50 text-emerald-600',
    sky: 'bg-sky-50 text-sky-600',
  } as const
  return (
    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', tones[tone])}>
      {children}
    </span>
  )
}
