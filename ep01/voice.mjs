/**
 * Черновая озвучка через Fish Audio (бесплатная модель s2.1-pro-free, голос «Энергичный Рассказчик»).
 *   node voice.mjs            — все реплики
 *   node voice.mjs l3 l8      — только эти
 * Ключ API подставляет окружение (FISH_API_KEY, если запускать у себя).
 * Чтобы взять озвучку из ElevenLabs — просто положи файлы voice/l1.mp3 … voice/l9.mp3 и запусти build.mjs.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { LINES } from './lines.mjs';

const VOICE = process.env.FISH_VOICE || '48ec28a45588422b977a86460c11977f';
const only = process.argv.slice(2);
mkdirSync(new URL('./voice/', import.meta.url), { recursive: true });
for (const line of LINES) {
  if (only.length && !only.includes(line.id)) continue;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        model: 's2.1-pro-free',
        Authorization: `Bearer ${process.env.FISH_API_KEY || 'proxy'}`,
      },
      body: JSON.stringify({ text: line.say, reference_id: VOICE, format: 'mp3' }),
    });
    if (res.ok) {
      writeFileSync(new URL(`./voice/${line.id}.mp3`, import.meta.url), Buffer.from(await res.arrayBuffer()));
      console.log(line.id, 'ok');
      break;
    }
    if (attempt >= 4) throw new Error(`${line.id}: ${res.status} ${await res.text()}`);
    await new Promise((r) => setTimeout(r, attempt * 3000));
  }
}
