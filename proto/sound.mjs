// Звук прототипа: ветер, шаги, мигание фонаря, удар при появлении Стрелка.
import { effects, makeAudio } from '../ep03/audio.mjs';
const au = makeAudio(5);
const fx = au.mk();
const k = effects(au, fx);
k.wind(0, 5); k.drone(0, 5); k.steps(1.5, 3.4); k.flick(3.1); k.sting(3.25); k.heart(3.6); k.flick(4.15); k.heart(4.25); k.boom(4.6); k.scream(4.62);
au.wav(new URL('./sound.wav', import.meta.url).pathname, fx);
