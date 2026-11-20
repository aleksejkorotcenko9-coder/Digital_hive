'use client'

/**
 * Экран «ИИ-агент»: чат пчеловода с цифровым помощником.
 * Агент отвечает сразу по всем ульям пасеки: телеметрия из базы, датчики точек
 * на карте (температура, вес, влажность, шум) и реальная погода из интернета.
 * Темы строго ограничены: погода и ульи — отвечает, всё остальное — вежливо
 * отказывается. Модель, на которой работает агент, пользователю не показывается.
 * Голосовой ввод работает как рация (push-to-talk): кнопку микрофона нужно
 * зажать и говорить — пока она удерживается, идёт запись; при отпускании запись
 * завершается, речь распознаётся (Web Speech или сервер /api/asr) и текст
 * подставляется в поле ввода.
 * Улии и показания синхронизированы с картой: агент говорит по тем же точкам
 * и датчикам, что видит пчеловод на карте и дашборде.
 * Чаты изолированы по пользователям: у каждого свой список чатов (SQLite),
 * первый вопрос даёт чату заголовок.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bot, CircleAlert, Gauge, Loader2, MessagesSquare, Mic, Plus, Send, Sparkles, Square, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { HexChip } from './decor'
import { tr, useT } from '@/lib/i18n'
import { useAppState } from '@/lib/store'
import { cn } from '@/lib/utils'
import { askAgent, makeContext, QUICK_QUESTIONS, URGENCY_META, type AgentContext, type AgentCropField, type AgentMessage, type AgentPoint } from '@/lib/agent'
import { pointsCenter, pointsToHives } from '@/lib/hive-sync'
import { siteDtoToSite, useRealData } from '@/lib/real-data'
import { DEFAULT_PLACE } from '@/lib/sensor-catalog'
import { blobToWavBase64, getSpeechRecognition, VOICE_LANG, VOICE_MAX_SECONDS, voiceInputSupported, type SpeechRecognitionLike } from '@/lib/voice-input'
import { weatherResponseToDays } from '@/lib/weather-days'
import type { MapPointDto, WeatherResponse } from '@/lib/api-types'
import type { ChatHistoryItem } from '@/lib/api-types'

interface ChatItem {
  role: 'user' | 'agent'
  text: string
  agent?: AgentMessage
}

/** Чат в списке «Мои чаты»: заголовок + превью последнего вопроса. */
interface ChatSessionInfo {
  id: string
  title: string
  preview: string
  createdAt: string
  updatedAt: string
}

/** Состояние голосового ввода: покой / запись / распознавание. */
type VoiceState = 'idle' | 'recording' | 'transcribing'

const SCENARIO_ICON: Record<string, string> = {
  swarm: '🐝',
  pesticide: '☣️',
  weather: '⛅',
  migration: '🚚',
  status: '📊',
  care: '🩺',
  offtopic: '🚫',
  bloom: '🌸',
  guide: '🧭',
}

export function AgentChatView() {
  const user = useAppState((s) => s.user)
  const t = useT()
  const { toast } = useToast()
  const { status: realStatus, data } = useRealData()

  // Погода по фактическому центру пасеки (среднее координат точек), те же
  // координаты, что на дашборде, чтобы агент называл те же числа, что видит
  // пчеловод. Ключ по набору точек — пересчёт только при изменении привязок.
  const [wResp, setWResp] = useState<WeatherResponse | null>(null)
  const [apiaryPoints, setApiaryPoints] = useState<MapPointDto[] | null>(null)
  // Поля Минсельхоза для контекста агента (п. 4 ТЗ)
  const [cropFields, setCropFields] = useState<AgentCropField[]>([])
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const res = await fetch('/api/crop-fields', { cache: 'no-store' })
        if (!res.ok) return
        const j = (await res.json()) as { fields: Array<{
          name: string
          culture: string
          cultureName: string
          areaHa: number
          district: string
          distanceKm: number
          sowingDate: string | null
          bloomText: string
          bloomStart: string | null
          bloomEnd: string | null
          recommend: { min: number; max: number; optimal: number } | null
          treatments: Array<{ date: string; drug: string; hazardClass: string }>
          isMinselhoz: boolean
        }> }
        if (alive) setCropFields(j.fields)
      } catch {
        // справочник подтянется при следующем открытии чата
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const res = await fetch('/api/map-points', { cache: 'no-store' })
        if (!res.ok) return
        const j = (await res.json()) as { points: MapPointDto[] }
        if (alive) setApiaryPoints(j.points)
      } catch {
        // датчики подтянутся на следующем опросе
      }
    }
    void load()
    const timer = setInterval(() => void load(), 5000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  // Погода по фактическому центру пасеки (среднее координат точек), те же
  // координаты, что на дашборде, чтобы агент называл те же числа, что видит
  // пчеловод. Эффект зависит от ЧИСЕЛ координат: опрос точек каждые 5 с
  // не вызывает перезапрос погоды, пока координаты не изменились.
  const center = useMemo<[number, number]>(
    () =>
      (apiaryPoints && apiaryPoints.length > 0 ? pointsCenter(apiaryPoints) : null) ??
      DEFAULT_PLACE.center,
    [apiaryPoints],
  )
  const [wLat, wLon] = center
  useEffect(() => {
    let cancelled = false
    const sp = new URLSearchParams({ lat: String(wLat), lon: String(wLon), place: 'Моя пасека' })
    const load = async () => {
      try {
        const res = await fetch(`/api/weather?${sp.toString()}`, { cache: 'no-store' })
        if (!res.ok) throw new Error('weather')
        const j = (await res.json()) as WeatherResponse
        if (!cancelled) setWResp(j)
      } catch {
        // погода не критична: агент честно скажет, если данных нет
      }
    }
    void load()
    const timer = setInterval(() => void load(), 10 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [wLat, wLon])
  const agentWeather = useMemo(() => (wResp ? weatherResponseToDays(wResp) : null), [wResp])

  // Ульи и показания — те же точки, что на карте (синхронизация с /api/map-points)
  const pointsCtx = useMemo<AgentContext | null>(() => {
    if (!apiaryPoints) return null
    const points: AgentPoint[] = apiaryPoints.map((p) => ({
      id: p.id,
      name: p.name,
      lat: p.lat,
      lon: p.lon,
      hiveCount: p.hiveCount,
      hasSensor: p.hasSensor,
      sensorOn: p.sensorOn,
      sensor: p.sensor,
    }))
    return makeContext(pointsToHives(apiaryPoints), {
      weather: agentWeather?.days ?? null,
      weatherNow: agentWeather?.now ?? null,
      pesticide: null, // реестр обработок не подключён — агент честно об этом скажет
      sites: data ? data.sites.map(siteDtoToSite) : [],
      points,
      cropFields,
      apiaryName: 'Моя пасека',
      lang: useAppState.getState().lang,
    })
  }, [apiaryPoints, agentWeather, data, cropFields])

  // контекст мемоизирован, чтобы не пересоздаваться на каждом рендере
  // (иначе эффекты с ctx в зависимостях зацикливаются)
  const ctx: AgentContext | null = pointsCtx

  const [items, setItems] = useState<ChatItem[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const thinkingRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  /* ---------- чаты пользователя: у каждого свой список ---------- */
  const [sessions, setSessions] = useState<ChatSessionInfo[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  // актуальные значения для колбэков: sendUser пишет в текущий чат
  const activeSessionRef = useRef<string | null>(null)
  activeSessionRef.current = activeSessionId
  const ctxRef = useRef<AgentContext | null>(null)
  useEffect(() => {
    ctxRef.current = ctx
  }, [ctx])

  /* ---------- голосовой ввод: микрофон → текст в поле ввода ---------- */
  // Основной путь — Web Speech API (Chrome/Edge/Яндекс.Браузер, ru-RU): текст
  // появляется в поле ввода прямо во время разговора. Запасной путь (браузеры
  // без нативного распознавания) — запись MediaRecorder → WAV → /api/asr.
  const srClass = useMemo(() => getSpeechRecognition(), [])
  const voiceOk = useMemo(() => !!srClass || voiceInputSupported(), [srClass])
  const [voice, setVoice] = useState<VoiceState>('idle')
  const speechRef = useRef<SpeechRecognitionLike | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const autoStopRef = useRef<number | null>(null)
  const baseInputRef = useRef('')
  // push-to-talk: кнопка микрофона зажата и момент начала удержания
  // (по длительности отличаем намеренное удержание от случайного тапа)
  const holdActiveRef = useRef(false)
  const holdStartedAtRef = useRef(0)

  const clearAutoStop = () => {
    if (autoStopRef.current !== null) {
      window.clearTimeout(autoStopRef.current)
      autoStopRef.current = null
    }
  }

  const stopVoice = useCallback(() => {
    clearAutoStop()
    if (speechRef.current) {
      try {
        speechRef.current.stop()
      } catch {
        // уже остановлен
      }
      return
    }
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') rec.stop()
  }, [])

  /** Отпускание кнопки (push-to-talk): завершаем запись. */
  const releaseHold = useCallback(() => {
    if (!holdActiveRef.current) return
    holdActiveRef.current = false
    const wasRecording = voice === 'recording'
    const heldMs = Date.now() - holdStartedAtRef.current
    stopVoice()
    // мгновенный тап вместо удержания — вежливо подсказываем, как пользоваться
    if (wasRecording && heldMs < 600) {
      toast({
        title: 'Короткое нажатие',
        description: 'Зажмите кнопку микрофона и говорите, отпустите — вопрос появится в поле ввода.',
      })
    }
  }, [stopVoice, voice, toast])

  /** Запасной путь: собранный blob → WAV → /api/asr → текст. */
  const finishVoice = useCallback(async () => {
    // поток больше не нужен
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    recorderRef.current = null
    const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'audio/webm' })
    chunksRef.current = []
    if (blob.size < 2048) {
      setVoice('idle')
      toast({ title: 'Запись пустая', description: 'Зажмите кнопку микрофона и скажите вопрос голосом.' })
      return
    }
    setVoice('transcribing')
    try {
      const wav = await blobToWavBase64(blob)
      const res = await fetch('/api/asr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: wav }),
      })
      const j = (await res.json().catch(() => ({}))) as { text?: string; error?: string }
      if (!res.ok || !j.text?.trim()) {
        toast({ title: 'Речь не распознана', description: j.error ?? 'Попробуйте сказать чуть чётче.', variant: 'destructive' })
        return
      }
      // текст подставляем в поле ввода — пчеловод может поправить и отправить
      const base = baseInputRef.current
      const text = j.text.trim()
      setInput(base ? `${base} ${text}` : text)
      toast({ title: 'Голос распознан', description: text })
    } catch {
      toast({ title: 'Не получилось', description: 'Не удалось распознать запись — попробуйте ещё раз.', variant: 'destructive' })
    } finally {
      setVoice('idle')
    }
  }, [toast])

  const startVoice = useCallback(async () => {
    // запись уже идёт — второй старт (второй палец/указатель) не нужен
    if (speechRef.current || recorderRef.current) return
    clearAutoStop()
    baseInputRef.current = input.trim()

    // 1) нативное распознавание в браузере — русский отлично работает в Chrome/Яндексе
    if (srClass) {
      const rec = new srClass()
      rec.lang = VOICE_LANG
      rec.continuous = true
      rec.interimResults = true
      rec.maxAlternatives = 1
      let finalText = ''
      rec.onresult = (e) => {
        let interim = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i]
          const t = r[0]?.transcript ?? ''
          if (r.isFinal) finalText = finalText ? `${finalText} ${t.trim()}` : t.trim()
          else interim += t
        }
        const text = (finalText + (interim ? ` ${interim}` : '')).trim()
        if (text) {
          const base = baseInputRef.current
          setInput(base ? `${base} ${text}` : text)
        }
      }
      rec.onerror = (ev) => {
        const code = ev.error ?? ''
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          toast({ title: 'Микрофон недоступен', description: 'Разрешите доступ к микрофону в браузере и попробуйте ещё раз.', variant: 'destructive' })
        } else if (code === 'no-speech') {
          toast({ title: 'Речи не слышно', description: 'Скажите вопрос чуть ближе к микрофону.' })
        } else if (code !== 'aborted') {
          toast({ title: 'Распознавание прервано', description: 'Скажите вопрос ещё раз.', variant: 'destructive' })
        }
      }
      rec.onend = () => {
        speechRef.current = null
        clearAutoStop()
        setVoice('idle')
      }
      speechRef.current = rec
      try {
        rec.start()
      } catch {
        toast({ title: 'Не получилось начать', description: 'Зажмите кнопку микрофона ещё раз.', variant: 'destructive' })
        return
      }
      setVoice('recording')
      autoStopRef.current = window.setTimeout(() => stopVoice(), VOICE_MAX_SECONDS * 1000)
      // кнопку отпустили раньше, чем распознавание успело стартовать
      if (!holdActiveRef.current) stopVoice()
      return
    }

    // 2) запасной путь: запись с микрофона → серверное распознавание
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const rec = new MediaRecorder(stream)
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = () => void finishVoice()
      rec.start()
      recorderRef.current = rec
      setVoice('recording')
      autoStopRef.current = window.setTimeout(() => stopVoice(), VOICE_MAX_SECONDS * 1000)
      // кнопку отпустили, пока запрашивался доступ к микрофону
      if (!holdActiveRef.current) stopVoice()
    } catch {
      toast({
        title: 'Микрофон недоступен',
        description: 'Разрешите доступ к микрофону в браузере и попробуйте ещё раз.',
        variant: 'destructive',
      })
    }
  }, [srClass, input, finishVoice, stopVoice, toast])

  // при размонтировании прерываем распознавание и закрываем поток
  useEffect(
    () => () => {
      if (autoStopRef.current !== null) window.clearTimeout(autoStopRef.current)
      try {
        speechRef.current?.abort()
      } catch {
        // нет активного распознавания
      }
      streamRef.current?.getTracks().forEach((t) => t.stop())
    },
    [],
  )

  /* ---------- чаты: список пользователя + сообщения выбранного ---------- */
  const ctxReady = !!ctx && ctx.hives.length > 0

  // Список чатов текущего пользователя; если пусто — создаём первый.
  useEffect(() => {
    if (!user || realStatus !== 'ready') return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/chat/sessions', { cache: 'no-store' })
        if (!res.ok) throw new Error('sessions')
        let list = ((await res.json()) as { sessions: ChatSessionInfo[] }).sessions
        if (list.length === 0) {
          const created = await fetch('/api/chat/sessions', { method: 'POST' })
          if (created.ok) {
            const j = (await created.json()) as { session: ChatSessionInfo }
            list = [j.session]
          }
        }
        if (!cancelled) {
          setSessions(list)
          setActiveSessionId((prev) => (prev && list.some((s) => s.id === prev) ? prev : (list[0]?.id ?? null)))
        }
      } catch {
        // без списка чатов чат всё равно работает — история подтянется позже
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, realStatus])

  // Сообщения выбранного чата: история из базы или приветствие в новом.
  useEffect(() => {
    if (!user || realStatus !== 'ready' || !activeSessionId || !ctxReady) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/chat?sessionId=${encodeURIComponent(activeSessionId)}`, { cache: 'no-store' })
        if (!res.ok) throw new Error('history')
        const j = (await res.json()) as { items: ChatHistoryItem[] }
        if (cancelled) return
        const restored: ChatItem[] = j.items.map((m) => ({
          role: m.role,
          text: m.text,
          ...(m.role === 'agent' && m.agentJson
            ? { agent: JSON.parse(m.agentJson) as AgentMessage }
            : {}),
        }))
        if (restored.length === 0) {
          setItems([{ role: 'agent', text: '', agent: askAgent('привет', ctxRef.current?.hives[0]?.id ?? 1, ctxRef.current!) }])
        } else {
          setItems(restored.slice(-30))
        }
      } catch {
        if (!cancelled) {
          setItems([{ role: 'agent', text: '', agent: askAgent('привет', ctxRef.current?.hives[0]?.id ?? 1, ctxRef.current!) }])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, realStatus, activeSessionId, ctxReady])

  const sendUser = useCallback(
    (rawText: string) => {
      const trimmed = rawText.trim()
      if (!trimmed || thinkingRef.current) return
      // отправка текста прерывает голосовой ввод (кнопка могла быть ещё зажата)
      if (holdActiveRef.current) {
        holdActiveRef.current = false
        stopVoice()
      }
      const context = ctx
      if (!context) return
      thinkingRef.current = true
      setItems((prev) => [...prev, { role: 'user', text: trimmed }])
      setInput('')
      setThinking(true)
      const started = Date.now()

      const run = async () => {
        let answer: AgentMessage
        try {
          // настоящий LLM-агент на сервере; при сбое — встроенные правила
          const res = await fetch('/api/agent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: trimmed }),
          })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const j = (await res.json()) as { answer: AgentMessage }
          answer = j.answer
        } catch {
          answer = askAgent(trimmed, context.hives[0]?.id ?? 1, context)
        }
        // лёгкая пауза, чтобы индикатор «думает» не мигал при быстрых ответах
        const elapsed = Date.now() - started
        if (elapsed < 600) await new Promise((r) => setTimeout(r, 600 - elapsed))
        setItems((prev) => [...prev, { role: 'agent', text: '', agent: answer }])
        thinkingRef.current = false
        setThinking(false)
        // сохраняем переписку в базу — в текущий чат пользователя
        if (useAppState.getState().user) {
          const sid = activeSessionRef.current
          void fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: sid,
              userText: trimmed,
              agentText: answer.text,
              agent: answer,
            }),
          })
            .then((r) => (r.ok ? (r.json() as Promise<{ title?: string | null }>) : null))
            .then((j) => {
              // первый вопрос даёт чату заголовок — обновляем список
              if (j?.title && sid) {
                setSessions((prev) => prev.map((s) => (s.id === sid ? { ...s, title: j.title as string } : s)))
              }
            })
            .catch(() => undefined)
        }
      }
      void run()
    },
    [ctx, stopVoice],
  )

  /* ---------- управление чатами: новый / переключение / удаление ---------- */
  const newChat = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/sessions', { method: 'POST' })
      if (!res.ok) throw new Error('create')
      const j = (await res.json()) as { session: ChatSessionInfo }
      setSessions((prev) => [j.session, ...prev])
      setActiveSessionId(j.session.id)
      setItems([])
      setInput('')
    } catch {
      toast({ title: 'Не получилось', description: 'Не удалось создать новый чат — попробуйте ещё раз.', variant: 'destructive' })
    }
  }, [toast])

  const switchChat = useCallback((id: string) => {
    if (id === activeSessionRef.current) return
    setActiveSessionId(id)
    setItems([])
  }, [])

  const deleteChat = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/chat/sessions/${id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('delete')
        const next = sessions.filter((s) => s.id !== id)
        setSessions(next)
        if (id === activeSessionRef.current) {
          setActiveSessionId(next[0]?.id ?? null)
          if (next.length === 0) setItems([])
        }
        toast({ title: 'Чат удалён' })
      } catch {
        toast({ title: 'Не получилось', description: 'Не удалось удалить чат.', variant: 'destructive' })
      }
    },
    [sessions, toast],
  )

  // consume prefill, заданного до монтирования + подписка на новые вопросы из дашборда
  useEffect(() => {
    useAppState.setState({ chatPrefill: null })
    const unsub = useAppState.subscribe((state, prev) => {
      if (state.chatPrefill && state.chatPrefill !== prev.chatPrefill) {
        useAppState.setState({ chatPrefill: null })
        sendUser(state.chatPrefill)
      }
    })
    return unsub
  }, [sendUser])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [items, thinking])

  /* Контекст ещё не готов — экран загрузки; пустая карта — честная подсказка */
  if (!ctx || ctx.hives.length === 0) {
    const noPoints = apiaryPoints !== null && apiaryPoints.length === 0
    return (
      <Card className="border-red-100">
        <CardContent className="p-10 text-center">
          <HexChip className="mx-auto h-12 w-12 animate-pulse bg-red-100">
            <Bot className="h-6 w-6 text-red-600" />
          </HexChip>
          <p className="mt-3 text-sm text-gray-500">
            {noPoints
              ? 'На карте пасеки ещё нет ульев — привяжите улей по коду с корпуса датчика, и агент начнёт отвечать по его показаниям.'
              : 'Агент загружается…'}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)_280px]">
      {/* Чаты пользователя: свой список у каждого */}
      <SessionsPanel
        sessions={sessions}
        activeId={activeSessionId}
        disabled={thinking}
        onNew={() => void newChat()}
        onSwitch={switchChat}
        onDelete={(id) => void deleteChat(id)}
      />

      {/* Чат */}
      <Card className="flex min-w-0 flex-col border-red-100 shadow-sm lg:h-[calc(100vh-190px)] lg:min-h-[520px]">
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          {/* шапка чата */}
          <div className="flex flex-wrap items-center gap-2 border-b border-red-100 px-4 py-3">
            <HexChip className="h-9 w-9 bg-gradient-to-br from-[#E93A2D] to-[#9B4DFF]">
              <Sparkles className="h-4.5 w-4.5" />
            </HexChip>
            <div>
              <p className="text-sm font-bold text-[#2A1A12]">ИИ-агент пасеки</p>
              <p className="text-[11px] text-gray-400">
                отвечает по телеметрии из базы данных
              </p>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="rounded-lg border border-red-100 bg-white px-2.5 py-1 text-xs font-semibold text-gray-600">
                все ульи пасеки ({ctx.hives.length})
              </span>
            </div>
          </div>

          {/* лента сообщений */}
          <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 md:px-5">
            {items.map((item, idx) =>
              item.role === 'user' ? (
                <div key={idx} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-[#E93A2D] to-[#8B2AFF] px-4 py-2.5 text-sm leading-relaxed text-white shadow-md shadow-red-200">
                    {item.text}
                  </div>
                </div>
              ) : (
                <AgentBubble key={idx} msg={item.agent!} />
              ),
            )}
            {thinking && (
              <div className="flex items-center gap-2 pl-1">
                <HexChip className="h-8 w-8 animate-pulse bg-red-100">
                  <Bot className="h-4 w-4 text-red-600" />
                </HexChip>
                <span className="text-sm text-gray-400">Агент смотрит данные пасеки…</span>
              </div>
            )}
          </div>

          {/* быстрые вопросы + ввод */}
          <div className="border-t border-red-100 px-4 py-3 md:px-5">
            <div className="mb-2.5 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendUser(tr('ru', q))}
                  disabled={thinking}
                  className="shrink-0 rounded-full border border-red-200 bg-red-50/60 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                >
                  {t(q)}
                </button>
              ))}
            </div>
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                sendUser(input)
              }}
            >
              {voiceOk && (
                <Button
                  type="button"
                  size="icon"
                  /* push-to-talk: зажать кнопку и говорить — отпустить, чтобы завершить */
                  onPointerDown={(e) => {
                    if (holdActiveRef.current || voice === 'transcribing' || thinking) return
                    e.preventDefault() // без выделения текста и «призрачных» кликов при удержании
                    holdActiveRef.current = true
                    holdStartedAtRef.current = Date.now()
                    try {
                      // захват указателя: отпустят в любом месте — событие всё равно придёт сюда
                      e.currentTarget.setPointerCapture(e.pointerId)
                    } catch {
                      // без захвата остаются подстраховки: автостоп и клавиатурные события
                    }
                    void startVoice()
                  }}
                  onPointerUp={releaseHold}
                  onPointerCancel={releaseHold}
                  onLostPointerCapture={releaseHold}
                  onKeyDown={(e) => {
                    // доступность: Space/Enter зажимает кнопку так же, как мышь
                    if (
                      (e.code === 'Space' || e.code === 'Enter') &&
                      !e.repeat &&
                      !holdActiveRef.current &&
                      voice !== 'transcribing' &&
                      !thinking
                    ) {
                      e.preventDefault()
                      holdActiveRef.current = true
                      holdStartedAtRef.current = Date.now()
                      void startVoice()
                    }
                  }}
                  onKeyUp={(e) => {
                    if (e.code === 'Space' || e.code === 'Enter') releaseHold()
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                  disabled={voice === 'transcribing' || thinking}
                  aria-label={voice === 'recording' ? 'Отпустите, чтобы завершить запись' : 'Голосовой ввод: зажмите и говорите'}
                  title={
                    voice === 'recording'
                      ? 'Говорите… отпустите кнопку, чтобы завершить'
                      : 'Голосовой ввод: зажмите кнопку и скажите вопрос'
                  }
                  className={cn(
                    'h-[46px] w-[46px] shrink-0 touch-none select-none border transition-all active:scale-95',
                    voice === 'recording'
                      ? 'animate-pulse border-red-400 bg-red-600 text-white'
                      : 'border-red-200 bg-white text-red-600 hover:bg-red-50 dark:bg-[#221814]',
                  )}
                >
                  {voice === 'recording' ? <Square className="h-4 w-4" /> : <Mic className="h-4.5 w-4.5" />}
                </Button>
              )}
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendUser(input)
                  }
                }}
                placeholder="Спросите о погоде или ульях: «Как дела на пасеке?»"
                className="min-h-[46px] resize-none border-red-200 focus-visible:ring-red-300"
                rows={1}
              />
              <Button
                type="submit"
                size="icon"
                className="h-[46px] w-[46px] shrink-0 bg-red-600 hover:bg-red-700"
                disabled={thinking || !input.trim()}
                aria-label="Отправить вопрос"
              >
                <Send className="h-4.5 w-4.5" />
              </Button>
            </form>
            {(voice === 'recording' || voice === 'transcribing') && (
              <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-red-600">
                {voice === 'recording' ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="absolute h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
                      <span className="relative h-2 w-2 rounded-full bg-red-600" />
                    </span>
                    Слушаю… говорите, держите кнопку зажатой — отпустите, и текст появится в поле ввода
                  </>
                ) : (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" /> Распознаю речь…
                  </>
                )}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Панель «что я умею» */}
      <div className="min-w-0 space-y-3 lg:pt-0">
        <Card className="border-red-100 bg-gradient-to-b from-red-50/70 to-white shadow-sm">
          <CardContent className="p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-[#2A1A12]">
              <Gauge className="h-4 w-4 text-red-600" /> Что я анализирую
            </p>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-gray-600">
              <li>• телеметрию из вашей базы: вес, температуру, влажность</li>
              <li>• датчики точек на карте: температура, вес, влажность, шум</li>
              <li>• погоду по координатам пасеки</li>
              <li>• справочник площадок для кочёвки</li>
              <li>• справочник здоровья пчёл: болезни, лечение, уход</li>
            </ul>
          </CardContent>
        </Card>
        <Card className="border-red-100 shadow-sm">
          <CardContent className="p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-[#2A1A12]">
              <CircleAlert className="h-4 w-4 text-orange-500" /> Принципы работы
            </p>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-gray-600">
              <li>• отвечаю сразу по всем ульям пасеки</li>
              <li>• говорю о погоде, ульях и здоровье пчёл — остальное не моя тема</li>
              <li>• совет опирается на показатели — всегда показываю, какие</li>
              <li>• датчика нет или он выключен — данных об улье нет</li>
              <li>• показываю вероятность и риск, а не 100 % прогноз</li>
            </ul>
          </CardContent>
        </Card>
        <Card className="border-red-100 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm font-bold text-[#2A1A12]">Текущий контекст</p>
            <p className="mt-2 text-xs leading-relaxed text-gray-600">
              Агент отвечает сразу по всем ульям пасеки: телеметрия, датчики точек на карте и погода.{' '}
              У каждого пользователя свой список чатов: «Новый чат», переключение и удаление — в панели «Мои чаты».
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/** Панель «Мои чаты»: список чатов пользователя + кнопка «Новый чат».
 *  На мобильном — горизонтальная лента чипсов, на десктопе — колонка слева. */
function SessionsPanel({
  sessions,
  activeId,
  disabled,
  onNew,
  onSwitch,
  onDelete,
}: {
  sessions: ChatSessionInfo[]
  activeId: string | null
  disabled: boolean
  onNew: () => void
  onSwitch: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <Card className="min-w-0 border-red-100 shadow-sm">
      <CardContent className="min-w-0 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="flex shrink-0 items-center gap-1.5 text-sm font-bold text-[#2A1A12]">
            <MessagesSquare className="h-4 w-4 text-red-600" /> Мои чаты
          </p>
          <button
            onClick={onNew}
            disabled={disabled}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-red-200 bg-red-50/60 px-2 py-1 text-[11px] font-bold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
            aria-label="Новый чат с ИИ-агентом"
          >
            <Plus className="h-3.5 w-3.5" /> Новый
          </button>
        </div>
        {sessions.length === 0 ? (
          <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
            Чатов пока нет — нажмите «Новый», чтобы начать разговор.
          </p>
        ) : (
          <ul
            className={cn(
              'mt-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
              'lg:max-h-[430px] lg:flex-col lg:overflow-x-visible lg:overflow-y-auto lg:pb-0',
            )}
          >
            {sessions.map((s) => (
              <li
                key={s.id}
                className={cn(
                  'group flex shrink-0 items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs transition-colors lg:w-full lg:shrink',
                  s.id === activeId
                    ? 'border-red-300 bg-red-50 text-red-700 dark:bg-[#2C211C]'
                    : 'border-red-100 bg-white text-gray-600 hover:bg-red-50/50 dark:bg-[#221814]',
                )}
              >
                <button onClick={() => onSwitch(s.id)} className="min-w-0 flex-1 text-left" aria-label={`Открыть чат: ${s.title}`}>
                  <p className="max-w-[150px] truncate font-semibold lg:max-w-[160px]">{s.title}</p>
                  {s.preview && (
                    <p className="hidden max-w-[160px] truncate text-[10px] text-gray-400 lg:block">{s.preview}</p>
                  )}
                </button>
                <button
                  onClick={() => onDelete(s.id)}
                  className="rounded p-0.5 text-gray-300 transition-colors hover:text-red-600"
                  aria-label={`Удалить чат: ${s.title}`}
                  title="Удалить чат"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function AgentBubble({ msg }: { msg: AgentMessage }) {
  const t = useT()
  const meta = URGENCY_META[msg.urgency]
  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-red-100 bg-white px-4 py-3 shadow-md shadow-red-100/60 md:max-w-[88%]">
        <div className="flex flex-wrap items-center gap-2">
          <HexChip className="h-7 w-7 bg-gradient-to-br from-[#E93A2D] to-[#9B4DFF]">
            <span className="text-[10px] font-bold">{SCENARIO_ICON[msg.scenario] ?? '📊'}</span>
          </HexChip>
          {msg.scenario !== 'offtopic' && (
            <span
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-xs font-bold',
                meta.cls,
              )}
            >
              {t(meta.labelKey)}
            </span>
          )}
          {msg.scenario === 'offtopic' && (
            <span className="rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-600">
              Не по теме
            </span>
          )}
          {msg.urgencyNote && (
            <span className="text-xs font-semibold text-gray-500">{msg.urgencyNote}</span>
          )}
        </div>

        <p className="mt-2.5 whitespace-pre-line text-sm leading-relaxed text-gray-700">
          {msg.text}
        </p>

        {msg.metrics.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {msg.metrics.map((m) => (
              <div key={m.label} className="rounded-xl bg-red-50/70 px-2.5 py-2">
                <p className="truncate text-[10px] uppercase tracking-wide text-gray-400">{m.label}</p>
                <p className="mt-0.5 text-sm font-extrabold text-[#2A1A12]">{m.value}</p>
              </div>
            ))}
          </div>
        )}

        {msg.basis.length > 0 && (
          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Основание</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {msg.basis.map((b) => (
                <span key={b} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
                  {b}
                </span>
              ))}
            </div>
          </div>
        )}

        {msg.probability && (
          <p className="mt-2.5 text-xs font-semibold text-red-700">{msg.probability}</p>
        )}
        <p className="mt-2 border-t border-dashed border-red-100 pt-2 text-[11px] text-gray-400">
          Вероятностная оценка — решение принимает пчеловод
        </p>
      </div>
    </div>
  )
}
