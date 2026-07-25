/* ============================================================
   Звук терминала на Web Audio.
   Сигнал берётся из сэмпла (SFX_SAMPLES в consts.ts), а если файл
   не задан или не загрузился — синтезируется из осцилляторов и шума.
   Так шаблон работает и вовсе без аудиофайлов.
   ============================================================ */

import { SFX_SAMPLES } from '../consts';

const STORE_KEY = 'sound';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
// значение читается сразу: модуль может понадобиться раньше, чем скрипт шапки
let enabled = readEnabled();

function readEnabled() {
  try {
    return localStorage.getItem(STORE_KEY) !== '0';
  } catch {
    return true; // приватный режим браузера — просто оставляем звук включённым
  }
}

/** декодированные сэмплы из SFX_SAMPLES; пусто — значит играет синтез */
const samples = new Map<string, AudioBuffer>();
let samplesLoading = false;

/** подгружаем пользовательские файлы один раз, при первом создании контекста */
function loadSamples(ac: AudioContext) {
  if (samplesLoading) return;
  samplesLoading = true;
  for (const [name, url] of Object.entries(SFX_SAMPLES)) {
    if (!url) continue;
    fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status + ' ' + url))))
      .then((data) => ac.decodeAudioData(data))
      .then((buf) => samples.set(name, buf))
      // файла нет или он битый — не беда, для этого сигнала останется синтез
      .catch((e) => console.warn('[sfx] sample skipped:', e.message));
  }
}

/** проигрывает сэмпл, если он загружен; иначе отдаёт false и звучит синтез */
function sample(name: string, gain = 1) {
  const buf = samples.get(name);
  const ac = audio();
  if (!buf || !ac || !master) return false;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const amp = ac.createGain();
  amp.gain.value = gain;
  src.connect(amp).connect(master);
  src.start();
  return true;
}

/** AudioContext создаётся лениво: до первого жеста браузер его всё равно заглушит */
function audio(): AudioContext | null {
  if (!enabled) return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.18; // общая громкость: сигналы должны быть фоном, а не ударом
    master.connect(ctx.destination);
    loadSamples(ctx);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** одиночный тон с экспоненциальным спадом */
function tone(opts: {
  freq: number;
  /** конечная частота для «съезда» тона; по умолчанию без глиссандо */
  freqTo?: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  /** частота среза ФНЧ: глушит верхние гармоники — звук «из корпуса», а не из наушников */
  lowpass?: number;
}) {
  const ac = audio();
  if (!ac || !master) return;

  const t0 = ac.currentTime + (opts.delay ?? 0);
  const osc = ac.createOscillator();
  const amp = ac.createGain();

  osc.type = opts.type ?? 'square';
  osc.frequency.setValueAtTime(opts.freq, t0);
  if (opts.freqTo) osc.frequency.exponentialRampToValueAtTime(opts.freqTo, t0 + opts.dur);

  const peak = opts.gain ?? 0.6;
  // короткая атака вместо щелчка на старте, дальше экспоненциальный хвост
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(peak, t0 + 0.004);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);

  let out: AudioNode = osc;
  if (opts.lowpass) {
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = opts.lowpass;
    osc.connect(lp);
    out = lp;
  }

  out.connect(amp).connect(master);
  osc.start(t0);
  osc.stop(t0 + opts.dur + 0.02);
}

/** щелчок реле: очень короткий всплеск отфильтрованного шума */
function noise(dur = 0.03, gain = 0.35, freq = 1800) {
  const ac = audio();
  if (!ac || !master) return;

  const frames = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buf = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    // затухание к концу буфера, чтобы не было обрыва
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  }

  const src = ac.createBufferSource();
  src.buffer = buf;

  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = 0.8;

  const amp = ac.createGain();
  amp.gain.value = gain;

  src.connect(bp).connect(amp).connect(master);
  src.start();
}

let lastHover = 0;

export const sfx = {
  /** наведение на кликабельное слово/строку — короткий сухой блип */
  hover() {
    // при быстром проходе мышью по сетке символов блипы не должны сливаться в очередь
    const now = performance.now();
    if (now - lastHover < 45) return;
    lastHover = now;
    if (sample('hover', 0.5)) return;
    tone({ freq: 240, dur: 0.035, type: 'square', gain: 0.5, lowpass: 900 });
  },

  /** подтверждение выбора — двойной тон вверх */
  select() {
    if (sample('select', 0.6)) return;
    tone({ freq: 240, dur: 0.04, gain: 0.5, lowpass: 900 });
    tone({ freq: 330, dur: 0.07, gain: 0.45, delay: 0.04, lowpass: 1000 });
  },

  /** отказ — низкое дребезжание */
  deny() {
    if (sample('deny', 0.6)) return;
    tone({ freq: 190, freqTo: 120, dur: 0.22, type: 'sawtooth', gain: 0.4 });
    tone({ freq: 96, dur: 0.24, type: 'square', gain: 0.25, delay: 0.02 });
  },

  /** доступ разрешён — восходящее арпеджио */
  grant() {
    if (sample('grant', 0.7)) return;
    [260, 330, 390].forEach((f, i) =>
      tone({ freq: f, dur: 0.13, type: 'square', gain: 0.45, lowpass: 1000, delay: i * 0.11 }),
    );
  },

  /** печать символа */
  key() {
    if (sample('key', 0.4)) return;
    tone({ freq: 700 + Math.random() * 200, dur: 0.02, gain: 0.2, lowpass: 1600 });
    noise(0.008, 0.08, 1400);
  },

  /** включение экрана */
  power() {
    if (sample('power')) return;
    tone({ freq: 60, freqTo: 220, dur: 0.5, type: 'sawtooth', gain: 0.22 });
    noise(0.14, 0.1, 900);
  },

  get enabled() {
    return enabled;
  },

  set enabled(on: boolean) {
    enabled = on;
    try {
      localStorage.setItem(STORE_KEY, on ? '1' : '0');
    } catch {}
    if (!on && ctx) ctx.suspend();
  },
};

/**
 * Навешивает звук на элементы по селектору внутри root.
 * Работает и с мышью, и с клавиатурой (focus), и переживает
 * перерисовку DOM — слушатели вешаются через делегирование.
 */
export function bindSfx(root: ParentNode | Document = document, selector = '[data-sfx]') {
  const target = (e: Event) =>
    (e.target as HTMLElement | null)?.closest<HTMLElement>(selector) ?? null;

  // pointerover, а не mouseover: не звенит при скролле на тач-устройствах
  root.addEventListener('pointerover', (e) => {
    if ((e as PointerEvent).pointerType !== 'mouse') return;
    const el = target(e);
    // всплывающий pointerover внутри одного элемента не должен повторять блип
    if (el && !el.contains((e as PointerEvent).relatedTarget as Node)) sfx.hover();
  });

  root.addEventListener('focusin', (e) => {
    if (target(e)) sfx.hover();
  });

  root.addEventListener('click', (e) => {
    const el = target(e);
    if (el && el.dataset.sfx !== 'hover') sfx.select();
  });
}
