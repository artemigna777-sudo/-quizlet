/**
 * Скачивает модели Poly Haven (CC0) в public/models/<id>/: geometry .bin + .gltf + одна цветовая текстура 256 px.
 * Карты нормалей и шероховатости выбрасываются — для стиля PS1 они не нужны, а игра остаётся лёгкой.
 *   node tools/fetch-models.mjs            — все модели из списка
 *   node tools/fetch-models.mjs sofa_02    — только эти
 * Нужен ffmpeg (уменьшение текстур). Список и авторы — в CREDITS.md.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MODELS = [
  'Shelf_01', 'wooden_table_02', 'painted_wooden_nightstand', 'painted_wooden_shelves', 'painted_wooden_table',
  'painted_wooden_bench', 'painted_wooden_stool', 'painted_wooden_chair_01', 'painted_wooden_cabinet_02', 'dining_table',
  'Television_01', 'vintage_day_bed', 'sofa_02', 'wall_clock', 'hanging_picture_frame_01', 'standing_picture_frame_01',
  'russian_food_cans_01', 'cassette_player', 'SchoolDesk_01', 'football', 'rubber_duck_toy', 'handsaw_wood',
  'cross_pein_hammer', 'barrel_03', 'old_tyre', 'trashbag', 'ceramic_vase_01', 'plastic_monobloc_chair_01',
  'standing_chalkboard_01', 'life_jacket', 'painted_wooden_cabinet', 'wooden_crate_02',
  // Вторая пачка (12.11.2026): плотные комнаты.
  'ArmChair_01', 'ClassicNightstand_01', 'CoffeeTable_01', 'GreenChair_01', 'Ottoman_01', 'Rockingchair_01', 'Sofa_01', 'WoodenTable_01', 'painted_wooden_chair_02', 'painted_wooden_sofa', 'side_table_01', 'small_wooden_table_01', 'steel_frame_shelves_01', 'vintage_wooden_drawer_01', 'wooden_bookshelf_worn', 'wooden_display_shelves_01', 'worn_metal_rack', 'boombox', 'electric_stove', 'vintage_electric_kettle', 'vintage_grandfather_clock_01', 'vintage_microwave', 'alarm_clock_01', 'brass_pan_01', 'brass_pot_02', 'ceramic_pot', 'jug_01', 'pot_enamel_01', 'wooden_cutting_board', 'croissant', 'long_life_food', 'hanging_industrial_lamp', 'modern_ceiling_lamp_01', 'vintage_oil_lamp', 'fancy_picture_frame_01', 'hanging_picture_frame_02', 'potted_plant_04', 'planter_box_01', 'Ukulele_01', 'throw_pillows_01', 'television_02', 'clipboard', 'stationery_supplies', 'metal_tool_chest', 'bench_vice_01', 'wooden_picnic_table', 'WetFloorSign_01', 'CashRegister_01', 'dartboard', 'lifebuoy', 'metal_jug', 'planter_pot_clay', 'ceramic_vase_03', 'standing_picture_frame_02', 'carved_wooden_plate', 'round_wooden_table_01', 'vintage_binocular', 'concrete_cat_statue',
];
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'models');
const TEX = 384;
const get = (url) => execFileSync('curl', ['-sS', '-L', '--fail', '-m', '120', url], { maxBuffer: 1 << 28 });

const only = process.argv.slice(2);
const report = [];
for (const id of MODELS) {
  if (only.length && !only.includes(id)) continue;
  const dir = join(ROOT, id);
  if (existsSync(join(dir, 'model.gltf')) && !only.length) { report.push(`${id}: уже есть`); continue; }
  try {
    const files = JSON.parse(get(`https://api.polyhaven.com/files/${id}`).toString());
    const g = files.gltf?.['1k']?.gltf;
    if (!g) throw new Error('нет gltf 1k');
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const gltf = JSON.parse(get(g.url).toString());
    // Геометрия.
    for (const b of gltf.buffers) {
      const inc = g.include[b.uri];
      if (!inc) throw new Error(`нет файла ${b.uri}`);
      writeFileSync(join(dir, 'model.bin'), get(inc.url));
      b.uri = 'model.bin';
    }
    // Оставляем только цветовые текстуры материалов.
    const keep = new Map(); // старый индекс текстуры → новый
    const images = [];
    const textures = [];
    for (const m of gltf.materials ?? []) {
      const pbr = m.pbrMetallicRoughness ?? {};
      delete m.normalTexture; delete m.occlusionTexture; delete m.emissiveTexture;
      delete pbr.metallicRoughnessTexture;
      pbr.metallicFactor = 0; pbr.roughnessFactor = 1;
      const t = pbr.baseColorTexture;
      if (!t) continue;
      if (!keep.has(t.index)) {
        const src = gltf.images[gltf.textures[t.index].source];
        const inc = g.include[src.uri];
        if (!inc) throw new Error(`нет текстуры ${src.uri}`);
        const n = images.length;
        const tmp = join(dir, `src${n}`);
        writeFileSync(tmp, get(inc.url));
        execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-vf', `scale=${TEX}:${TEX}:flags=area`, '-q:v', '4', join(dir, `tex${n}.jpg`)]);
        rmSync(tmp);
        images.push({ uri: `tex${n}.jpg` });
        textures.push({ source: n });
        keep.set(t.index, n);
      }
      t.index = keep.get(t.index);
    }
    gltf.images = images;
    gltf.textures = textures;
    delete gltf.samplers;
    writeFileSync(join(dir, 'model.gltf'), JSON.stringify(gltf));
    const kb = Math.round((readFileSync(join(dir, 'model.bin')).length) / 1024);
    report.push(`${id}: ok, геометрия ${kb} КБ, текстур ${images.length}`);
  } catch (e) {
    report.push(`${id}: ОШИБКА ${e.message}`);
  }
}
console.log(report.join('\n'));
