import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { ensureSeeded } from '@/lib/bootstrap'
import { db } from '@/lib/db'
import { fetchWeatherFor } from '@/lib/weather-server'
import { weatherResponseToDays } from '@/lib/weather-days'
import { sensorReading } from '@/lib/sensor-sim'
import { pointsCenter, pointsToHives } from '@/lib/hive-sync'
import { DEFAULT_PLACE } from '@/lib/sensor-catalog'
import {
  askAgent,
  makeContext,
  type AgentContext,
  type AgentCropField,
  type AgentMessage,
  type AgentPoint,
  type Scenario,
  type Urgency,
} from '@/lib/agent'
import { AGRO_CULTURES, estimateBloomWindow, formatBloomWindow, recommendFamilies } from '@/lib/agro-catalog'
import { hiveStatus, weightDeltaOver, type Hive, type MigrationSite, type WeatherDay } from '@/lib/hive-model'

/**
 * ИИ-агент пасеки: серверный маршрут с настоящей LLM (OpenRouter, ключ только
 * на сервере из .env). Контекст данных пасеки кладётся в системный промпт:
 * телеметрия ВСЕХ ульев, датчики точек на карте (температура, вес, влажность,
 * шум) и реальная погода по координатам пасеки. Агент отвечает только о погоде
 * и ульях, сразу по всем ульям, и не раскрывает, на какой модели работает.
 * Ответ — строго JSON в формате AgentMessage. Если LLM недоступна (нет ключа,
 * таймаут, невалидный ответ) — честный fallback на встроенный правиловый
 * движок askAgent, поэтому чат работает всегда.
 */

const SCENARIOS: Scenario[] = ['pesticide', 'swarm', 'weather', 'migration', 'status', 'care', 'offtopic', 'bloom', 'guide']
const URGENCIES: Urgency[] = ['act-now', 'today', 'this-week', 'ok']

/* ------------------------------------------------------------------ */
/* Контекст пасеки: СИНХРОНИЗИРОВАН с картой — ульи и показания это     */
/* точки ApiaryPoint пользователя, суточные ряды — той же формулой      */
/* датчика (lib/hive-sync → sensor-sim)                                 */
/* ------------------------------------------------------------------ */

const SITE_POS: Array<{ x: number; y: number }> = [
  { x: 0.78, y: 0.3 },
  { x: 0.3, y: 0.62 },
  { x: 0.16, y: 0.22 },
  { x: 0.62, y: 0.78 },
  { x: 0.85, y: 0.58 },
  { x: 0.42, y: 0.18 },
]
const SITE_LETTERS = 'ABCDEF'

function siteDtoToSite(s: { name: string; distanceKm: number; honeyPlant: string; bloomWindow: string; weatherNote: string; risks: string; score: number; verdict: string }, index: number): MigrationSite {
  const pos = SITE_POS[index % SITE_POS.length]
  return {
    id: SITE_LETTERS[index % SITE_LETTERS.length] + String(index),
    name: s.name,
    distanceKm: s.distanceKm,
    honeyPlant: s.honeyPlant || '—',
    bloomWindow: s.bloomWindow || '—',
    weatherNote: s.weatherNote || '—',
    risks: s.risks,
    score: s.score,
    verdict: (s.verdict === 'recommend' || s.verdict === 'avoid' ? s.verdict : 'backup') as MigrationSite['verdict'],
    map: pos,
  }
}

/**
 * Контекст пасеки пользователя — те же точки, что видит пчеловод на карте
 * и дашборде. Погода — реальные данные по фактическому центру пасеки
 * (среднее координат точек); пока точек нет — по запасному центру.
 */
async function buildContext(userId: string): Promise<AgentContext> {
  const [siteRows, pointRows, cropRows] = await Promise.all([
    db.migrationSite.findMany({ orderBy: [{ score: 'desc' }, { name: 'asc' }] }),
    db.apiaryPoint.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    db.cropField.findMany({ where: { OR: [{ ownerKey: 'minselhoz' }, { ownerKey: userId }] }, orderBy: [{ culture: 'asc' }] }),
  ])
  const tSec = Date.now() / 1000
  const now = new Date()
  const points: AgentPoint[] = pointRows.map(
    (p): AgentPoint => ({
      id: p.id,
      name: p.name,
      lat: p.lat,
      lon: p.lon,
      hiveCount: p.hiveCount,
      hasSensor: p.hasSensor,
      sensorOn: p.sensorOn,
      sensor: sensorReading(p, tSec),
    }),
  )
  // Поля Минсельхоза: окно цветения от даты посева + рекомендация семей (п. 4 ТЗ)
  const cropFields: AgentCropField[] = cropRows.map((f) => {
    const culture = AGRO_CULTURES[f.culture]
    const bloom = estimateBloomWindow(f.culture, f.sowingDate, now.getFullYear())
    let treatments: Array<{ date: string; drug: string; hazardClass: string }> = []
    try {
      treatments = (JSON.parse(f.treatmentsJson) as Array<{ date: string; drug: string; hazardClass: string }>).slice(0, 5)
    } catch {
      treatments = []
    }
    const rec = recommendFamilies(f.culture, f.areaHa)
    return {
      name: f.name,
      culture: f.culture,
      cultureName: culture?.name ?? f.culture,
      areaHa: f.areaHa,
      district: f.district,
      distanceKm: f.distanceKm,
      sowingDate: f.sowingDate ? f.sowingDate.toISOString().slice(0, 10) : null,
      bloomText: formatBloomWindow(bloom),
      bloomStart: bloom ? bloom.start.toISOString().slice(0, 10) : null,
      bloomEnd: bloom ? bloom.end.toISOString().slice(0, 10) : null,
      recommend: rec ? { min: rec.min, max: rec.max, optimal: rec.optimal } : null,
      treatments,
      isMinselhoz: f.ownerKey === 'minselhoz',
    }
  })
  const [lat, lon] = pointsCenter(pointRows) ?? DEFAULT_PLACE.center
  // Тот же ярлык места, что на панели погоды дашборда, и тот же кэш —
  // чтобы агент называл те же цифры, что видит пчеловод
  const wResp = await fetchWeatherFor(lat, lon, 'Моя пасека')
  const agentWeather = weatherResponseToDays(wResp)
  return makeContext(pointsToHives(pointRows), {
    weather: agentWeather.days,
    weatherNow: agentWeather.now,
    pesticide: null, // реестр обработок к пасеке не подключён — агент скажет об этом честно
    sites: siteRows.map((s, i) => siteDtoToSite(s, i)),
    points,
    cropFields,
    apiaryName: 'Моя пасека',
  })
}

/* ------------------------------------------------------------------ */
/* Компактная сериализация контекста для промпта                        */
/* ------------------------------------------------------------------ */

function dayDto(d: WeatherDay) {
  return {
    дата: d.full,
    макс_темп: d.tMax,
    мин_темп: d.tMin,
    ветер_мс: d.windMs,
    вероятность_осадков: d.precipProb,
    окно_лёта: d.flight === 'good' ? 'хорошее' : d.flight === 'bad' ? 'плохое' : 'среднее',
  }
}

function serializeContext(ctx: AgentContext): string {
  const hives = ctx.hives.map((h) => {
    const st = hiveStatus(h, ctx.hives)
    const last = h.series.length ? h.series[h.series.length - 1] : null
    const d2 = weightDeltaOver(h, 2)
    const d30 = h.series.length > 10 ? weightDeltaOver(h, 30) : null
    return {
      улей_номер: h.id,
      название: h.label,
      примечание: h.familyNote || undefined,
      точек_телеметрии: h.series.length,
      период: h.series.length >= 2 ? `${h.series[0].date} … ${last?.date}` : undefined,
      вес_кг: last?.weightKg ?? null,
      привес_за_2_дн_кг: d2,
      привес_за_30_дн_кг: d30,
      температура_внутри: last?.tempInC ?? null,
      влажность_внутри: last?.humidityPct ?? null,
      датчик_влажности_исправен: h.humiditySensorOk,
      статус: `${st.label} (уровень: ${st.level})`,
    }
  })
  const points = (ctx.points ?? []).map((p) => ({
    точка: p.name,
    координаты: `${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}`,
    ульев_в_точке: p.hiveCount,
    датчик: p.sensor.on
      ? {
          состояние: 'включён',
          температура_внутри_улья: p.sensor.tempC,
          влажность: p.sensor.humidityPct,
          вес: p.sensor.weightKg,
          шум_дБ: p.sensor.noiseDb,
        }
      : { состояние: p.hasSensor ? 'выключен — данных по улью нет' : 'датчика нет — данных по улью нет' },
  }))
  const weatherNow = ctx.weatherNow
    ? {
        температура: ctx.weatherNow.tempC,
        ощущается_как: ctx.weatherNow.feelsC,
        влажность: ctx.weatherNow.humidityPct,
        ветер_кмч: ctx.weatherNow.windKmh,
        давление_мм_рт_ст: ctx.weatherNow.pressureMm,
        описание: ctx.weatherNow.text,
      }
    : null
  const weather =
    ctx.weather && ctx.weather.length
      ? {
          погода_сейчас: weatherNow,
          сегодня: dayDto(ctx.weather[0]),
          ближайшие_дни: ctx.weather.slice(1, 4).map(dayDto),
        }
      : 'не подключена — про погоду честно скажи, что прогноза нет'
  const pesticide = ctx.pesticide
    ? {
        источник: 'реестр обработок подключён',
        поле: ctx.pesticide.field,
        культура: ctx.pesticide.crop,
        расстояние_км: ctx.pesticide.distanceKm,
        препарат: ctx.pesticide.treatment,
        дата: ctx.pesticide.dateLabel,
        ветер: ctx.pesticide.windNote,
      }
    : 'не подключён — про обработки честно скажи, что реестра нет'
  const sites = ctx.sites.length
    ? ctx.sites.map((s) => ({
        название: s.name,
        оценка: s.score,
        вердикт: s.verdict,
        расстояние_км: s.distanceKm,
        медонос: s.honeyPlant,
        цветение: s.bloomWindow,
      }))
    : 'справочник площадок пуст'
  const cropFields = (ctx.cropFields ?? []).length
    ? (ctx.cropFields ?? []).map((f) => ({
        поле: f.name,
        культура: f.cultureName,
        площадь_га: f.areaHa,
        район: f.district || undefined,
        расстояние_км: f.distanceKm,
        дата_посева: f.sowingDate ?? undefined,
        цветение: f.bloomText,
        рекомендуется_семей: f.recommend ? `${f.recommend.min}–${f.recommend.max}` : undefined,
        обработки_пестицидами: f.treatments.length ? f.treatments : undefined,
        источник: f.isMinselhoz ? 'Минсельхоз области' : 'поле пользователя',
      }))
    : 'справочник Минсельхоза пуст'
  return JSON.stringify(
    {
      пасека: ctx.apiaryName,
      всего_ульев: ctx.hives.length,
      ульи: hives,
      точки_пасеки_на_карте: points.length ? points : 'точек на карте нет',
      погода: weather,
      пестициды: pesticide,
      площадки_кочёвки: sites,
      поля_минсельхоза: cropFields,
    },
    null,
    1,
  )
}

/* ------------------------------------------------------------------ */
/* Вызов OpenRouter                                                     */
/* ------------------------------------------------------------------ */

const SYSTEM_PROMPT = `Ты — ИИ-агент «Цифровой улей», цифровой помощник пчеловода.

ТЕМЫ: ты отвечаешь о погоде (прогноз, температура воздуха, ветер, осадки, окна лёта пчёл), об ульях и пасеке (пчёлы, вес, температура и влажность внутри улья, датчики, шум, медосбор, роение, кочёвка, обработки полей рядом) и о здоровье пчёл с уходом: болезни и их лечение, профилактика, подкормки, расплод, матки, зимовка, вентиляция. Всё остальное — люди, политика, математика, программирование, игры, фильмы, другие животные, разговоры о твоём устройстве — вне твоей компетенции: вежливо откажись в 1–2 фразах и предложи вернуться к теме пасеки. Для отказа используй scenario "offtopic", urgency "ok" и пустые basis и metrics.

Вопрос про календарь или сроки цветения медоносов (в т.ч. про конкретный медонос — липа, гречиха, донник, подсолнечник) — это scenario "bloom": отвечай СРОКАМИ ЦВЕТЕНИЯ (эталонные окна: гречиха 20.06–15.07, липа 20.06–10.07, донник 20.06–20.08; поля Минсельхоза — от даты посева), а не прогнозом погоды и не разговором о лёте.

Вопрос «где что находится в приложении», «как добавить/исправить/настроить камеру, улей, датчик», «где посмотреть историю/журнал» — это scenario "guide": назови нужный раздел («Пасека», «Агент», «Карта», «Датчики», «История», «Кочёвка», «Данные», «Напоминания», «Справка») и короткую инструкцию (камеры — кнопка «Камеры» на «Карте пасеки»; улей — «Добавить улей» по коду датчика; чаты у каждого свои — «Новый чат»). Ты также можешь назвать данные пасеки: вес и привесы, температура и влажность, шум, погода, цветение, риски — если вопрос об этом, отвечай по CONTEXT.

Правила:
1. Отвечай по ВСЕМ ульям сразу: при общем вопросе дай сводку по каждому улью; если назван конкретный улей — начни с него и одной строкой добавь картину по остальным.
2. Никогда не называй модель, на которой ты работаешь, поставщика модели и технические детали устройства. Ты — просто ИИ-агент «Цифровой улей».
3. Отвечай только по-русски, по делу, обычным текстом без markdown, 2–6 предложений.
4. Для вопросов о телеметрии и погоде опирайся ТОЛЬКО на данные из CONTEXT: числа бери из данных, не выдумывай. Для вопросов о болезнях и уходе отвечай из знаний пчеловода: признаки болезни, порядок действий, профилактика — кратко и по шагам.
5. Если данных не хватает (датчик выключен или его нет, прогноз приблизительный) — честно скажи об этом.
6. Давай вероятностную оценку, а не 100% прогноз; окончательное решение принимает пчеловод.
7. Здоровье пчёл: при подозрении на заразную болезнь (гнильцы, аскосфероз, акарапидоз) посоветуй ограничить осмотры соседних ульев и сообщить в ветеринарную службу; напомни, что точный диагноз ставит осмотр и ветлаборатория — по описанию окончательный диагноз не ставят. Лекарства называй как общепринятую практику, без выдуманных дозировок: «строго по инструкции к препарату».
8. Отвечай СТРОГО валидным JSON без markdown-обёрток и комментариев, по схеме:
{"scenario":"pesticide|swarm|weather|migration|status|care|offtopic|bloom|guide","text":"совет пчеловоду","basis":["ссылка на данные"],"urgency":"act-now|today|this-week|ok","urgencyNote":"когда действовать, коротко","probability":"вероятность словами, например «вероятность высокая (~70%)»","metrics":[{"label":"название","value":"значение"}],"hiveId":номер_улья_числом_или_null}
scenario — по сути вопроса (care — здоровье пчёл и уход); urgency — насколько срочно; metrics — 2–4 показателя из данных или нормы, которые ты использовал; basis — 2–4 короткие ссылки на данные понятными фразами по-русски (например, «Погода: сейчас +2 °C», «Датчик улья №2» или «Справочник болезней пчёл»), не ключами и не фрагментами JSON из CONTEXT. Никогда не называй источники данных и внешние сервисы.`

function stripFences(s: string): string {
  return s
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim()
}

/** Аккуратный парсинг ответа модели: срез мусора, починка висячих запятых. */
function tryParseJson(raw: string): unknown | null {
  const candidates = [raw]
  const i = raw.indexOf('{')
  const j = raw.lastIndexOf('}')
  if (i >= 0 && j > i) candidates.push(raw.slice(i, j + 1))
  for (let c of candidates) {
    for (const t of [c, c.replace(/,\s*([\]}])/g, '$1')]) {
      try {
        return JSON.parse(t)
      } catch {
        // пробуем следующий вариант
      }
    }
  }
  return null
}

function coerceMessage(raw: unknown, ctx: AgentContext): AgentMessage | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const text = typeof o.text === 'string' ? o.text.trim() : ''
  if (!text) return null
  const scenario = SCENARIOS.includes(o.scenario as Scenario) ? (o.scenario as Scenario) : 'status'
  const urgency = URGENCIES.includes(o.urgency as Urgency) ? (o.urgency as Urgency) : 'ok'
  const basis = Array.isArray(o.basis)
    ? o.basis.filter((b): b is string => typeof b === 'string' && b.trim().length > 0).slice(0, 5)
    : []
  const metrics = Array.isArray(o.metrics)
    ? o.metrics
        .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
        .map((m) => ({ label: String(m.label ?? ''), value: String(m.value ?? '') }))
        .filter((m) => m.label && m.value)
        .slice(0, 4)
    : []
  const hiveIdRaw = typeof o.hiveId === 'number' ? o.hiveId : Number(o.hiveId)
  const hiveId = Number.isInteger(hiveIdRaw) && ctx.hives.some((h) => h.id === hiveIdRaw) ? hiveIdRaw : null
  return {
    scenario,
    text,
    basis,
    urgency,
    urgencyNote: typeof o.urgencyNote === 'string' && o.urgencyNote.trim() ? o.urgencyNote.trim() : undefined,
    probability: typeof o.probability === 'string' && o.probability.trim() ? o.probability.trim() : undefined,
    metrics,
    hiveId,
  }
}

async function callLLM(question: string, ctx: AgentContext): Promise<AgentMessage | null> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) return null
  const model = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct'
  const contextJson = serializeContext(ctx)
  // до двух попыток: вторая — с прямым напоминанием про валидный JSON
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const messages: Array<{ role: 'system' | 'user'; content: string }> = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `CONTEXT (данные всей пасеки: все ульи, датчики точек на карте, погода):\n${contextJson}\n\nВопрос пчеловода: ${question}`,
        },
      ]
      if (attempt === 1) {
        messages.push({
          role: 'user',
          content: 'Предыдущий ответ не был валидным JSON. Верни ТОЛЬКО валидный JSON по схеме — одной строкой, без markdown-обёрток, без текста до или после.',
        })
      }
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.4,
          max_tokens: 1100,
          messages,
        }),
        signal: AbortSignal.timeout(30_000),
        cache: 'no-store',
      })
      if (!res.ok) {
        console.error('openrouter http', res.status)
        return null
      }
      const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
      const content = j.choices?.[0]?.message?.content ?? ''
      const parsed = coerceMessage(tryParseJson(content), ctx)
      if (parsed) {
        parsed.engine = 'llm'
        return parsed
      }
      console.error(`openrouter: невалидный JSON (попытка ${attempt + 1}):`, content.slice(0, 160))
    } catch (e) {
      console.error('openrouter call failed', e)
      return null
    }
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Обработчик                                                           */
/* ------------------------------------------------------------------ */

export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Нужен вход в систему' }, { status: 401 })
  }
  try {
    await ensureSeeded()
    const body = (await req.json()) as {
      question?: string
      hiveId?: number | null
    }
    const question = (body.question ?? '').trim().slice(0, 600)
    if (!question) {
      return NextResponse.json({ error: 'Пустой вопрос' }, { status: 400 })
    }
    const ctx = await buildContext(user.id)
    if (ctx.hives.length === 0) {
      return NextResponse.json(
        {
          error: 'Ульи на карте ещё не привязаны — добавьте улей по коду датчика',
        },
        { status: 400 },
      )
    }
    const llm = await callLLM(question, ctx)
    if (llm) {
      return NextResponse.json({ answer: llm, engine: 'llm' })
    }
    // Fallback: встроенный правиловый движок — чат не молчит никогда
    const fallbackHiveId = ctx.hives[0]?.id ?? 0
    const rules = askAgent(question, fallbackHiveId, ctx)
    return NextResponse.json({ answer: { ...rules, engine: 'rules' as const }, engine: 'rules' })
  } catch (e) {
    console.error('agent route error', e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
