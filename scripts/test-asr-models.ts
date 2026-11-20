/**
 * Проба ASR-моделей сервиса: понимает ли какая-то русский без перевода.
 * Аудио: /tmp/voice-ru.wav (gTTS, русский: «Как дела на пасеке, есть ли риск роения?»)
 */
import ZAI from 'z-ai-web-dev-sdk'
import fs from 'fs'

const base64 = fs.readFileSync('/tmp/voice-ru.wav').toString('base64')
const models = [undefined, 'glm-asr', 'glm-4-voice', 'asr']

const zai = await ZAI.create()
for (const model of models) {
  try {
    const res = await zai.audio.asr.create(model ? { file_base64: base64, model } : { file_base64: base64 })
    console.log(`model=${model ?? '(default)'} ->`, JSON.stringify(res.text ?? res).slice(0, 120))
  } catch (e) {
    console.log(`model=${model ?? '(default)'} -> ERROR: ${String((e as Error).message).slice(0, 120)}`)
  }
}
