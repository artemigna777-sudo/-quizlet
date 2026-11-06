/**
 * Черновая озвучка через Fish Audio (бесплатная модель s2.1-pro-free, голос «Энергичный Рассказчик»).
 *   node voice.mjs            — все реплики
 *   node voice.mjs l3 l8a     — только эти
 * Ключ: переменная FISH_API_KEY (в облачной среде Claude его подставляет прокси).
 * Чтобы взять озвучку из ElevenLabs — положи файлы voice/<id>.mp3 и запусти build.mjs.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { LINES } from './lines.mjs';

const VOICE = process.env.FISH_VOICE || '48ec28a45588422b977a86460c11977f';
const dir = new URL('./voice/', import.meta.url).pathname;
mkdirSync(dir, { recursive: true });
const only = process.argv.slice(2);
for (const line of LINES) {
  if (only.length && !only.includes(line.id)) continue;
  const out = `${dir}${line.id}.mp3`;
  const args = ['-sS', '-o', out, '-w', '%{http_code}', 'https://api.fish.audio/v1/tts',
    '-H', 'Content-Type: application/json', '-H', 'model: s2.1-pro-free',
    '-d', JSON.stringify({ text: line.say, reference_id: VOICE, format: 'mp3' })];
  if (process.env.FISH_API_KEY) args.push('-H', `Authorization: Bearer ${process.env.FISH_API_KEY}`);
  for (let attempt = 1; ; attempt++) {
    const code = execFileSync('curl', args).toString();
    if (code === '200' && statSync(out).size > 2000) { console.log(line.id, 'ok'); break; }
    if (attempt >= 5) throw new Error(`${line.id}: HTTP ${code}`);
    await sleep(attempt * 3000);
  }
}
