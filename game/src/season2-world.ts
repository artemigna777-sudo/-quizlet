import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Ballistics } from './ballistics';
import type { Vec2 } from './config';
import { canvasTex, lambert } from './gfx';
import type { Spot } from './homes';
import type { Box } from './logic';
import { loadModel } from './models';
import { WORKSHOP, DEPOT, DISPATCH, SEASON_POINTS, type SeasonProgress, type SeasonSpot } from './season2';

const TITLES: Record<SeasonSpot, string> = {
  order: 'Квитанция из мастерской', battery: 'Один аккумулятор', cabinet: 'Шкаф мастера',
  receiver: 'Приёмник', ticket: 'Билет № 12', office: 'Контора депо',
  ledger: 'Последний рейс', relay: 'Коммутатор', mic: 'Микрофон', delivery: 'Возвращение во двор',
};

export async function buildSeasonWorld(scene: THREE.Scene, boxes: Box[], ballistics: Ballistics) {
  const modelIds = ['wooden_table_02', 'wooden_bookshelf_worn', 'metal_tool_chest', 'boombox', 'painted_wooden_chair_01', 'wooden_crate_02', 'wall_clock', 'vintage_day_bed', 'stationery_supplies', 'vintage_electric_kettle'] as const;
  const models = new Map(await Promise.all(modelIds.map(async (id) => [id, await loadModel(id)] as const)));
  const paint = (base: string, dark: string, tile = false) => lambert({ map: canvasTex(48, 48, (c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    c.fillStyle = dark;
    for (let i = 0; i < 95; i++) c.fillRect((i * 13 + (i >> 2)) % w, (i * 17) % h, 1 + i % 3, 1);
    c.fillStyle = 'rgba(27,25,22,.26)';
    c.fillRect(0, 0, w, 2);
    if (tile) c.fillRect(0, 0, 2, h);
  }, tile ? [6, 5] : [3, 1]) });
  const brick = paint('#83766a', '#6b5d54', true);
  const green = paint('#7c8f78', '#6b7662');
  const floor = paint('#6e6862', '#58524f', true);
  const cream = paint('#b0a587', '#7b725e');
  const blue = paint('#657b85', '#485c67');
  const corrugated = paint('#48524e', '#35403e');
  const yellow = paint('#bd9951', '#9b743e');
  const asphalt = lambert({ color: 0x555450 });
  const iron = lambert({ color: 0x3e4643 });
  const rubber = lambert({ color: 0x26262a });
  const cloth = paint('#743d36', '#552a2b');
  const glow = new THREE.MeshBasicMaterial({ color: 0xffcf79 });
  const blueGlow = new THREE.MeshBasicMaterial({ color: 0x8bded0 });
  const glass = new THREE.MeshBasicMaterial({ color: 0x597584, transparent: true, opacity: .61, side: THREE.DoubleSide, depthWrite: false });
  const groups: { centre: Vec2; root: THREE.Group }[] = [];
  const shown: Partial<Record<SeasonSpot, THREE.Object3D>> = {};
  const footprints: Box[] = [];
  const gate = new THREE.Group();
  const dispatchDoor = new THREE.Group();
  const lamp = new THREE.Group();
  const bulb = new THREE.PointLight(0xffcf79, 9, 6);
  const radio = new THREE.Group();
  const lay = (centre: Vec2) => {
    const root = new THREE.Group();
    root.position.set(centre.x, 0, centre.z);
    scene.add(root);
    groups.push({ centre, root });
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const hit = (x: number, z: number, w: number, d: number, y: number, h: number): Box => {
      const b = { minX: centre.x + x - w / 2, maxX: centre.x + x + w / 2, minZ: centre.z + z - d / 2, maxZ: centre.z + z + d / 2, minY: y - h / 2, maxY: y + h / 2 };
      boxes.push(b);
      return b;
    };
    const box = (x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material, solid = false, layer?: THREE.Group) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      geo.translate(x, y, z);
      if (layer) layer.add(new THREE.Mesh(geo, mat));
      else {
        const list = batches.get(mat) ?? [];
        list.push(geo);
        batches.set(mat, list);
      }
      if (solid) hit(x, z, w, d, y, h);
    };
    const sign = (message: string, x: number, y: number, z: number, width: number, colour = '#37483e') => {
      const texture = canvasTex(256, 48, (c) => {
        c.fillStyle = colour; c.fillRect(0, 0, 256, 48);
        c.strokeStyle = '#c7b58b'; c.strokeRect(3, 3, 250, 42);
        c.fillStyle = '#eee1b3'; c.font = 'bold 24px sans-serif'; c.textAlign = 'center';
        c.fillText(message, 128, 33, 238);
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * .1875), new THREE.MeshBasicMaterial({ map: texture }));
      mesh.position.set(x, y, z);
      root.add(mesh);
    };
    const pane = (x: number, y: number, z: number, w: number, h: number, yaw = 0) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glass);
      mesh.position.set(x, y, z);
      mesh.rotation.y = yaw;
      root.add(mesh);
      ballistics.register(mesh, true);
    };
    const room = (x: number, z: number, w: number, d: number, entry: number, material: THREE.Material, h = 3.1) => {
      const front = z + d / 2, a = x - w / 2, b = x + w / 2, gap = 1.8;
      box(x, .018, z, w, .09, d, floor);
      box(x, h, z, w + .65, .22, d + .65, corrugated);
      box(a, h / 2, z, .21, h, d, material, true);
      box(b, h / 2, z, .21, h, d, material, true);
      box(x, h / 2, z - d / 2, w, h, .21, material, true);
      for (const [lo, hi] of [[a, entry - gap / 2], [entry + gap / 2, b]]) {
        box((lo + hi) / 2, h / 2, front, hi - lo, h, .24, material, true);
      }
      box(entry, h - .36, front, gap, .72, .24, material);
      for (const side of [-1, 1]) box(entry + side * .91, 1.18, front + .02, .1, 2.36, .29, iron);
      footprints.push({ minX: centre.x + a, maxX: centre.x + b, minZ: centre.z + z - d / 2, maxZ: centre.z + front });
    };
    const prop = (id: typeof modelIds[number], x: number, z: number, y = 0, rot = 0, scale = 1) => {
      const source = models.get(id)!;
      const object = source.root.clone();
      object.position.set(x, y, z); object.rotation.y = rot; object.scale.setScalar(scale);
      root.add(object);
      if (y < .12 && source.size.y * scale > .35) {
        const w = Math.abs(source.size.x * Math.cos(rot)) + Math.abs(source.size.z * Math.sin(rot));
        const d = Math.abs(source.size.x * Math.sin(rot)) + Math.abs(source.size.z * Math.cos(rot));
        hit(x, z, w * scale, d * scale, source.size.y * scale / 2, source.size.y * scale);
      }
      return object;
    };
    const spotGroup = (id: SeasonSpot) => {
      const group = new THREE.Group();
      const p = SEASON_POINTS[id];
      group.position.set(p.x - centre.x, 0, p.z - centre.z);
      root.add(group);
      shown[id] = group;
      return group;
    };
    const paper = (id: SeasonSpot, y: number, m: THREE.Material = cream) => {
      const group = spotGroup(id);
      box(0, y, 0, .31, .036, .25, m, false, group);
      for (let i = 0; i < 3; i++) box(-.008, y + .02, -.067 + i * .044, .22, .008, .012, iron, false, group);
    };
    const finish = () => {
      for (const [mat, geometries] of batches) {
        const mesh = new THREE.Mesh(mergeGeometries(geometries), mat);
        mesh.receiveShadow = true;
        root.add(mesh);
        geometries.forEach((geometry) => geometry.dispose());
      }
    };
    box(0, .034, 0, 25.8, .045, 25.8, asphalt);
    return { root, box, room, prop, sign, pane, paper, spotGroup, hit, finish };
  };

  {
    const w = lay(WORKSHOP);
    w.room(0, -3.2, 15.5, 11.6, -3, brick);
    w.sign('РАДИОМАСТЕРСКАЯ', -3, 2.77, 2.74, 4.7);
    w.room(5.6, 7.7, 9.6, 7.2, 5.8, green);
    w.sign('ПРАЧЕЧНАЯ', 5.8, 2.77, 11.43, 3.5);
    for (let i = 0; i < 3; i++) {
      const x = 3.25 + 2.26 * i;
      w.box(x, .60, 6.7, 1.42, 1.16, 1.26, cream, true);
      w.box(x, .60, 7.337, .62, .62, .047, iron);
      w.pane(x, .60, 7.368, .51, .51);
    }
    w.box(0, 1.42, -6.15, .18, 2.84, 5.25, green, true);
    w.box(0, 1.42, .29, .18, 2.84, 4.3, green, true);
    w.sign('ПОДСОБКА', .55, 2.24, -1.73, 1.40);
    w.prop('wooden_table_02', -6.1, -3.1);
    w.prop('stationery_supplies', -6.39, -3.29, .80, .4);
    w.paper('order', .88);
    w.prop('wooden_table_02', -3.15, -6.35);
    const battery = w.spotGroup('battery');
    w.box(0, .94, 0, .52, .3, .29, iron, false, battery);
    w.box(0, 1.115, 0, .42, .05, .21, cloth, false, battery);
    for (const x of [-.16, .16]) w.box(x, 1.15, 0, .072, .065, .08, glow, false, battery);
    w.prop('wooden_table_02', -4.63, -7.1);
    shown.receiver = w.prop('boombox', -4.63, -7.1, .82);
    w.root.add(radio, lamp);
    w.box(-4.65, 1.04, -6.948, .21, .038, .031, blueGlow, false, radio);
    w.prop('metal_tool_chest', -6.25, -6.35);
    w.prop('painted_wooden_chair_01', -4.65, -.9, 0, Math.PI / 2);
    w.prop('wooden_bookshelf_worn', 6.6, -6.25, 0, -Math.PI / 2);
    w.paper('cabinet', .94);
    w.prop('vintage_day_bed', 6.8, -1.55, 0, Math.PI / 2);
    w.prop('vintage_electric_kettle', 4.8, -5.9, .75);
    w.prop('wooden_table_02', 4.8, -6.03);
    w.box(3.9, 2.83, -5.6, .80, .18, .60, iron);
    w.box(3.9, 2.727, -5.6, .69, .055, .48, glow, false, lamp);
    bulb.position.set(4.9, 2.55, -5.35);
    lamp.add(bulb);
    w.finish();
  }

  let lockedGate: Box;
  {
    const d = lay(DEPOT);
    d.room(5.7, -6.5, 7.8, 6.7, 5.75, blue);
    d.sign('КОНТОРА ДЕПО', 5.75, 2.76, -3.0, 3.6);
    d.root.add(gate);
    lockedGate = d.hit(5.75, -3.12, 1.8, .18, 1.2, 2.4);
    d.box(5.75, 2.04, -3.12, 1.82, .10, .14, iron, false, gate);
    d.box(5.75, .42, -3.12, 1.82, .10, .14, iron, false, gate);
    for (let x = 4.94; x < 6.62; x += .21) d.box(x, 1.22, -3.12, .075, 2.3, .13, iron, false, gate);
    d.prop('wooden_table_02', 5.75, -6.09);
    d.paper('office', .86);
    d.prop('wooden_bookshelf_worn', 8.48, -7.7, 0, -Math.PI / 2);
    d.prop('painted_wooden_chair_01', 5.45, -7.67);
    d.prop('wall_clock', 5.75, 1.94, -9.67);
    d.prop('wooden_crate_02', .75, 4.2);
    d.prop('wooden_crate_02', 2.12, 3.95);
    d.sign('ДЕПО · МАРШРУТ 12', -4.5, 2.64, 11.1, 4.8, '#4c4b3c');
    for (const x of [-6.8, -2.2]) d.box(x, 1.18, 11.06, .15, 2.36, .16, iron, true);
    for (const [x, w] of [[-9.55, 5.35], [4.45, 12.95]]) {
      d.box(x, .76, 10.95, w, 1.45, .17, corrugated, true);
      d.box(x, 1.51, 10.95, w, .09, .19, iron);
    }
    // Автобус с открытыми задними дверями и свободным проходом между сиденьями.
    const busX = -4, busZ = -3.9, busW = 3, busL = 9.2;
    d.box(busX, .055, busZ, busW, .15, busL, rubber);
    d.box(busX, 2.67, busZ, busW + .11, .18, busL + .22, yellow);
    d.box(busX, .83, busZ - busL / 2, busW, 1.51, .14, yellow, true);
    d.box(busX, 2.492, busZ - busL / 2, busW, .16, .14, yellow);
    for (const side of [-1, 1]) d.box(busX + side * 1.36, 2, busZ - busL / 2, .28, .82, .14, yellow);
    d.pane(busX, 1.997, busZ - busL / 2 - .012, 2.44, .82);
    for (const side of [-1, 1]) {
      const x = busX + side * busW / 2;
      d.box(x, .75, busZ, .14, 1.36, busL, yellow, true);
      d.box(x, 1.74, busZ, .11, .10, busL, cloth);
      d.box(x, 1.88, busZ, .12, .19, busL, yellow);
      d.box(x, 2.55, busZ, .12, .15, busL, yellow);
      const paneSpan = busL / 8;
      for (let i = 0; i <= 8; i++) {
        const z = busZ - busL / 2 + i * paneSpan;
        d.box(x, 2.22, z, .125, .6, .11, yellow);
        if (i < 8) d.pane(x, 2.22, z + paneSpan / 2, paneSpan - .105, .51, Math.PI / 2);
      }
      for (let z = busZ - 3.7; z < busZ + 3.5; z += 1.11) {
        d.box(busX + side * .99, .53, z, .76, .13, .52, blue, true);
        d.box(busX + side * .99, .75, z - .23, .76, .53, .11, blue);
      }
      for (const z of [busZ - 2.8, busZ + 2.8]) d.box(x + side * .065, .39, z, .25, .7, .76, rubber);
    }
    d.box(busX, 2.33, busZ + busL / 2, busW, .48, .17, yellow);
    d.sign('12', busX, 2.33, busZ + busL / 2 + .09, .96);
    d.box(busX - .81, .625, -2.783, .46, .05, .26, cloth);
    d.box(busX - .58, .514, -2.685, .09, .24, .09, cloth);
    d.paper('ticket', .17, cream);
    d.finish();
  }

  const broadcast = new THREE.Group();
  let dispatchLock: Box;
  {
    const s = lay(DISPATCH);
    s.room(0, -2.45, 15.7, 12, 0, cream);
    s.sign('ДИСПЕТЧЕРСКАЯ', 0, 2.76, 3.69, 5.3, '#434c52');
    s.root.add(dispatchDoor);
    dispatchLock = s.hit(0, 3.55, 1.8, .21, 1.17, 2.34);
    s.box(0, 1.17, 3.55, 1.76, 2.34, .18, blue, false, dispatchDoor);
    s.box(.62, 1.02, 3.66, .20, .08, .08, iron, false, dispatchDoor);
    s.prop('wooden_table_02', -2.6, -.6);
    s.paper('ledger', .93);
    s.prop('painted_wooden_chair_01', -2.31, -2.16, 0, Math.PI);
    s.prop('wooden_bookshelf_worn', -6.75, -4.5, 0, Math.PI / 2);
    s.prop('wooden_bookshelf_worn', -6.75, -6.1, 0, Math.PI / 2);
    s.prop('metal_tool_chest', 3.65, -7.22);
    const relay = s.spotGroup('relay');
    s.box(0, 1, 0, 1, .55, .40, iron, false, relay);
    for (const side of [-1, 0, 1]) {
      s.box(side * .3, 1.20, .226, .085, .08, .065, side === 0 ? blueGlow : glow, false, relay);
      s.box(side * .3, 1.01, .231, .115, .071, .059, blue, false, relay);
    }
    s.box(2.90, .405, -5.85, 1.05, .81, .72, blue, true);
    s.prop('wooden_table_02', 4.6, .30);
    const mic = s.spotGroup('mic');
    s.box(0, .873, 0, .23, .06, .20, iron, false, mic);
    s.box(0, 1.03, 0, .043, .31, .043, iron, false, mic);
    s.box(0, 1.19, -.05, .105, .105, .19, rubber, false, mic);
    s.box(0, .917, .041, .045, .030, .035, glow, false, mic);
    s.root.add(broadcast);
    s.box(-1.3, 4.84, -6.4, .14, 3.28, .14, iron);
    s.box(-1.3, 5.75, -6.4, 2.5, .09, .095, iron);
    s.box(-1.3, 6.42, -6.4, .22, .17, .23, glow, false, broadcast);
    s.sign('ЛИНИЯ РЕЙСОВ', 4.6, 1.92, -2.28, 2.4);
    s.finish();
  }

  const spots: Spot[] = (Object.keys(SEASON_POINTS) as SeasonSpot[]).map((id) => ({
    id, kind: 'season', room: 'A', at: SEASON_POINTS[id], title: TITLES[id], text: '', mesh: shown[id] ?? null,
  }));
  const inside = (p: Vec2) => footprints.some((b) => p.x > b.minX && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ)
    || (p.x > DEPOT.x - 5.5 && p.x < DEPOT.x - 2.5 && p.z > -8.5 && p.z < .7);
  const barrier = (model: THREE.Group, box: Box, closed: boolean) => {
    model.visible = closed;
    const index = boxes.indexOf(box);
    if (closed && index < 0) boxes.push(box);
    else if (!closed && index >= 0) boxes.splice(index, 1);
  };
  const setProgress = (step: SeasonProgress) => {
    const missingTicket = ['arrival', 'power', 'clue', 'bus'].includes(step.step);
    barrier(gate, lockedGate, missingTicket);
    barrier(dispatchDoor, dispatchLock, missingTicket || step.step === 'office');
    broadcast.visible = step.step === 'home' || step.step === 'complete';
    lamp.visible = step.power === 'lamp';
    radio.visible = step.power === 'radio';
  };
  const update = (viewer: Vec2, high: boolean) => {
    for (const { centre, root } of groups) root.visible = Math.hypot(centre.x - viewer.x, centre.z - viewer.z) < (high ? 133 : 84);
    if (lamp.visible) bulb.visible = Math.hypot(WORKSHOP.x - viewer.x, WORKSHOP.z - viewer.z) < 17;
  };
  return { spots, footprints, inside, setProgress, update };
}
