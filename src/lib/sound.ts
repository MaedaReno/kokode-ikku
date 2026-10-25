/**
 * 効果音はファイルを使わず、その場で合成する。
 * iPhone では、利用者が一度画面に触れるまで音を出せないので、最初のタップで準備する。
 */

let ctx: AudioContext | null = null;
let enabled = true;
let noise: AudioBuffer | null = null;

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

function audio(): AudioContext | null {
  if (!enabled) return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function noiseBuffer(ac: AudioContext): AudioBuffer {
  if (noise && noise.sampleRate === ac.sampleRate) return noise;
  const len = ac.sampleRate * 1.5;
  noise = ac.createBuffer(1, len, ac.sampleRate);
  const d = noise.getChannelData(0);
  // 紙の繊維に引っかかる感じを出すため、ところどころ強い粒を混ぜる
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.02 ? 1 : 0.45);
  return noise;
}

/** 最初の操作で音の準備をしておく */
export function installSoundUnlock() {
  const unlock = () => {
    const ac = audio();
    if (ac) {
      // 無音を一度鳴らすと、iPhone でも以降の音が出る
      const b = ac.createBuffer(1, 1, ac.sampleRate);
      const s = ac.createBufferSource();
      s.buffer = b;
      s.connect(ac.destination);
      s.start();
    }
    window.removeEventListener("pointerdown", unlock, true);
  };
  window.addEventListener("pointerdown", unlock, true);
}

/** 筆が紙を擦る音 */
export function playStroke(duration = 0.42) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const band = ac.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = 0.9;
  band.frequency.setValueAtTime(2600 + Math.random() * 600, t);
  band.frequency.linearRampToValueAtTime(1500, t + duration);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.11, t + 0.04);
  gain.gain.setValueAtTime(0.09, t + duration * 0.6);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  src.connect(band).connect(gain).connect(ac.destination);
  src.start(t, Math.random() * 0.8);
  src.stop(t + duration + 0.05);
}

let reverb: ConvolverNode | null = null;

/** 広い部屋で鳴ったような残響。減衰するノイズを響きの型として使う */
function hall(ac: AudioContext): AudioNode {
  if (reverb && reverb.context === ac) return reverb;
  const len = Math.floor(ac.sampleRate * 1.8);
  const ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  reverb = ac.createConvolver();
  reverb.buffer = ir;
  const wet = ac.createGain();
  wet.gain.value = 0.35;
  reverb.connect(wet).connect(ac.destination);
  return reverb;
}

/** 落款を押す音。太鼓のような低い「ドン」に、紙を打つ乾いた音と、鈴の余韻を重ねる */
export function playSeal() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const out = ac.createGain();
  out.gain.value = 0.9;
  out.connect(ac.destination);
  out.connect(hall(ac));

  // 胴鳴り
  const body = ac.createOscillator();
  body.type = "sine";
  body.frequency.setValueAtTime(190, t);
  body.frequency.exponentialRampToValueAtTime(48, t + 0.25);
  const bodyGain = ac.createGain();
  bodyGain.gain.setValueAtTime(0.0001, t);
  bodyGain.gain.exponentialRampToValueAtTime(1, t + 0.006);
  bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
  body.connect(bodyGain).connect(out);
  body.start(t);
  body.stop(t + 0.95);

  // 皮を打つ倍音
  const skin = ac.createOscillator();
  skin.type = "triangle";
  skin.frequency.setValueAtTime(320, t);
  skin.frequency.exponentialRampToValueAtTime(110, t + 0.12);
  const skinGain = ac.createGain();
  skinGain.gain.setValueAtTime(0.35, t);
  skinGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  skin.connect(skinGain).connect(out);
  skin.start(t);
  skin.stop(t + 0.2);

  // 紙に当たる乾いた音
  const click = ac.createBufferSource();
  click.buffer = noiseBuffer(ac);
  const band = ac.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 1400;
  band.Q.value = 0.7;
  const clickGain = ac.createGain();
  clickGain.gain.setValueAtTime(0.9, t);
  clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  click.connect(band).connect(clickGain).connect(out);
  click.start(t);
  click.stop(t + 0.1);

  // 鈴の余韻。少し遅れて、高い音を2つ重ねる
  for (const [freq, delay, vol] of [
    [2093, 0.06, 0.07],
    [3136, 0.09, 0.045],
  ]) {
    const bell = ac.createOscillator();
    bell.type = "sine";
    bell.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t + delay);
    g.gain.exponentialRampToValueAtTime(vol, t + delay + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + delay + 1.6);
    bell.connect(g).connect(out);
    bell.start(t + delay);
    bell.stop(t + delay + 1.65);
  }
}

/** 印を振りかぶるときの、風を切る音 */
export function playWhoosh(duration = 0.5) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  const band = ac.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = 1.2;
  band.frequency.setValueAtTime(400, t);
  band.frequency.exponentialRampToValueAtTime(2400, t + duration);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.25, t + duration * 0.85);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  src.connect(band).connect(g).connect(ac.destination);
  src.start(t);
  src.stop(t + duration + 0.05);
}

/** 押したときの手応え。Android では短く震わせる。iPhone の Safari は非対応なので何もしない */
export function buzz(ms = 18) {
  if (!enabled) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* 対応していない端末では何もしない */
  }
}
