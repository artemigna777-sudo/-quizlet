/**
 * Озвучка игры через Fish Audio (бесплатная модель s2.1-pro-free). Файлы — public/voice/<id>.mp3,
 * длительности — src/voicedur.ts (нужны сценкам, чтобы кадр длился столько, сколько звучит реплика).
 *   node tools/voice.mjs            — недостающие реплики
 *   node tools/voice.mjs z_meet1    — перезаписать эти
 * Голос можно заменить: положи свой mp3 с тем же именем и запусти скрипт ещё раз (обновит длительности).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const HERO = '22f1ef912fa04918944a848e3e831d9e'; // «Молодой Рассказчик» — спокойный мужской
const ZOYA = 'aa615eaff73f417e91cfbb4ea0e42df8'; // «Женский голос» — средних лет
export const LINES = [
  ['h_intro1', HERO, 'Асфальт. Холодно. Я не помню, как меня зовут.'],
  ['h_intro2', HERO, 'Пёс. На ошейнике — «Тузик». Он тянет меня за рукав. Что-то идёт.'],
  ['h_wall', HERO, 'За спиной — стена помех. Там, где она прошла, ничего не остаётся.'],
  ['h_intro3', HERO, 'На ладони что-то написано. Моим почерком.'],
  ['h_night1', HERO, 'Темнеет. Фонари зажглись сами.'],
  ['h_night2', HERO, 'Под фонарём кто-то стоит. Тузик не лает. Он молчит.'],
  ['h_night3', HERO, 'Мигнуло. Никого.'],
  ['h_end', HERO, 'Саша. Кто такой Саша?'],
  ['m_zoya', HERO, 'Я ставлю миску у порога. На дне гвоздём выцарапано: Мурка. Тузик обнюхивает её и ложится рядом — так, будто уже лежал здесь.'],
  ['m_gena', HERO, 'Замок открывается с первого раза. Внутри пахнет смолой и стружкой. Рука сама находит выключатель — слева, ниже, чем у всех. Откуда-то я знаю, где он.'],
  ['m_tema', HERO, 'Я подношу бинокль к глазам. В стёклах — фонарь через улицу. Под ним никого. Я зачем-то жду, пока он мигнёт.'],
  ['m_nina', HERO, 'Я ставлю метроном на пианино. Он сам делает один удар — и замирает. Этот стук мне знаком. Под него кто-то считал вслух: и раз, и два. А в коридоре ждали, когда кончится урок.'],
  ['z_meet1', ZOYA, 'Стой, где стоишь! ... Тузик? Тузик, это ты, что ли? Живой.'],
  ['z_meet2', ZOYA, 'А тебя я не знаю. Ты с ним пришёл? Ну, значит, не чужой. Тузик к чужим не идёт.'],
  ['z_meet3', ZOYA, 'Мурка без своей миски не ест. Миску кто-то унёс. Глянь у Нины Сергеевны, в первом доме. Принесёшь — поставь у той двери. Там была комната. Я не помню, какая.'],
  ['z_after1', ZOYA, 'Спальня. Я же в ней спала. Как можно забыть, что у тебя есть спальня? Там, в жестянке из-под чая, ключ от Гениного гаража. Отнеси. Может, и у него что вернётся.'],
  ['z_after2', ZOYA, 'Гена лодку строил. Одиннадцать лет пилил, весь двор не спал. Я ругалась. А сейчас бы послушала.'],
  ['z_after3', ZOYA, 'Тёмка. Мальчик из четвёртого. Я ему батарейки обещала. У него мама была. И ещё кто-то. Не помню кто.'],
  ['z_after4', ZOYA, 'Слышишь? Метроном. Это Нина Сергеевна уроки даёт. Давала.'],
  ['z_noaxe', ZOYA, 'С пустыми руками не выстоишь. Во дворе, в пне, топор торчит. Возьми и приходи.'],
  ['z_siege1', ZOYA, 'Свет в окнах. Четыре окна горят. Их теперь видно с любого конца города. Они придут на свет.'],
  ['z_siege2', ZOYA, 'Держи двор до рассвета. Я дверь подопру. Тузик, с ним иди!'],
  ['z_end1', ZOYA, 'Рассвело. Живые. Дай хоть посмотрю на тебя.'],
  ['z_end2', ZOYA, 'Саша? ... Нет. Нет, Саши у нас не было. Или был?'],
];

const dir = new URL('../public/voice/', import.meta.url).pathname;
const only = process.argv.slice(2);
for (const [id, voice, text] of LINES) {
  const out = `${dir}${id}.mp3`;
  if (only.length ? !only.includes(id) : existsSync(out)) continue;
  const args = ['-sS', '-o', out, '-w', '%{http_code}', 'https://api.fish.audio/v1/tts', '-H', 'Content-Type: application/json', '-H', 'model: s2.1-pro-free',
    '-d', JSON.stringify({ text, reference_id: voice, format: 'mp3', mp3_bitrate: 64 })];
  if (process.env.FISH_API_KEY) args.push('-H', `Authorization: Bearer ${process.env.FISH_API_KEY}`);
  for (let attempt = 1; ; attempt++) {
    const code = execFileSync('curl', args).toString();
    if (code === '200' && statSync(out).size > 2000) { console.log(id, 'ok'); break; }
    if (attempt >= 5) throw new Error(`${id}: HTTP ${code}`);
    await sleep(attempt * 3000);
  }
}
const dur = {};
for (const f of readdirSync(dir).filter((f) => f.endsWith('.mp3')).sort()) dur[f.slice(0, -4)] = +(+execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', dir + f]).toString()).toFixed(2);
writeFileSync(new URL('../src/voicedur.ts', import.meta.url), `/** Длительности реплик в секундах. Файл пишет tools/voice.mjs. */\nexport const VOICE_DUR: Record<string, number> = ${JSON.stringify(dur, null, 2)};\n`);
console.log('реплик:', Object.keys(dur).length, 'всего секунд:', Object.values(dur).reduce((a, b) => a + b, 0).toFixed(0));
