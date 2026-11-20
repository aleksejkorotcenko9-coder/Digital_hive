import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import ZAI from 'z-ai-web-dev-sdk'

/**
 * Голосовой ввод ИИ-агента: аудио (base64) → текст.
 * Клиент записывает вопрос с микрофона, приводит запись к WAV 16 бит PCM mono
 * (lib/voice-input.ts) и отправляет сюда; распознавание выполняет сервис
 * речевых технологий (z-ai-web-dev-sdk, только на сервере). Возврат — { text },
 * текст подставляется в поле ввода чата, откуда пчеловод отправляет вопрос.
 */
export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Нужен вход в систему' }, { status: 401 })
  }
  try {
    const body = (await req.json()) as { audio?: string }
    const raw = body.audio ?? ''
    // принимаем и чистый base64, и dataURL «data:audio/...;base64,....»
    const base64 = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw.trim()
    if (!base64) {
      return NextResponse.json({ error: 'Аудио не передано' }, { status: 400 })
    }
    // ~12 МБ WAV — это больше минуты речи; вопрос должен быть короче 30 секунд
    if (base64.length > 16_000_000) {
      return NextResponse.json({ error: 'Запись слишком длинная — скажите вопрос короче' }, { status: 400 })
    }
    const zai = await ZAI.create()
    const res = await zai.audio.asr.create({ file_base64: base64 })
    const text = (res.text ?? '').trim()
    if (!text) {
      return NextResponse.json({ error: 'Речь не распознана — скажите чуть ближе к микрофону' }, { status: 422 })
    }
    return NextResponse.json({ text })
  } catch (e) {
    console.error('asr error', e)
    return NextResponse.json(
      { error: 'Сервис распознавания речи недоступен — попробуйте ещё раз' },
      { status: 500 },
    )
  }
}
