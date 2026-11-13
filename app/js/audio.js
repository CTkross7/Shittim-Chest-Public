// 효과음 · 배경음 · 음성 재생 (WebAudio).
//   효과음: 파일 없이 WebAudio 로 직접 합성한다 (원작 게임 음원을 쓰지 않는다). 이름은 코드가 쓰는 이름 그대로
//           UI_Button_Touch · UI_Button_Back · SE_Confirm_01 … · Emo_<감정>
//   배경음 · 음성: 캐릭터 팩의 파일 (전체 경로)
export const EMOS = ['Question', 'Exclaim', 'Respond', 'Dot', 'Chat', 'Heart', 'Music', 'Sad', 'Shy', 'Surprise', 'Sweat', 'Twinkle',
  'Upset', 'Angry', 'Steam', 'Sigh', 'Bulb', 'Tear', 'Zzz'];
// 합성 효과음: [주파수 시작, 끝, 길이(초), 파형, 시작 시각(초)] 의 목록
const N = (f0, f1, d, w = 'sine', t = 0, g = 1) => ({ f0, f1, d, w, t, g });
const SYN = {
  UI_Button_Touch: [N(1180, 1560, 0.045, 'sine', 0, 0.55)],
  UI_Button_Back: [N(760, 520, 0.06, 'sine', 0, 0.5)],
  SE_Confirm_01: [N(1046, 1046, 0.09), N(1568, 1568, 0.14, 'sine', 0.07)],
  SE_Confirm_02: [N(1318, 1318, 0.07), N(1760, 1760, 0.12, 'sine', 0.06)],
  SE_Close_01: [N(880, 440, 0.18, 'triangle', 0, 0.6)],
  SE_Beep_01: [N(1320, 1320, 0.07, 'square', 0, 0.18)],
  Emo_Question: [N(620, 980, 0.16)],
  Emo_Exclaim: [N(900, 1500, 0.07), N(1500, 1500, 0.06, 'sine', 0.07)],
  Emo_Surprise: [N(700, 1400, 0.09), N(1400, 1700, 0.1, 'sine', 0.09)],
  Emo_Respond: [N(980, 1180, 0.06)],
  Emo_Dot: [N(900, 900, 0.035), N(900, 900, 0.035, 'sine', 0.12), N(900, 900, 0.035, 'sine', 0.24)],
  Emo_Chat: [N(800, 1000, 0.05), N(900, 1100, 0.05, 'sine', 0.08)],
  Emo_Heart: [N(1046, 1046, 0.08), N(1318, 1318, 0.12, 'sine', 0.09)],
  Emo_Music: [N(1046, 1046, 0.07), N(1318, 1318, 0.07, 'sine', 0.08), N(1568, 1568, 0.12, 'sine', 0.16)],
  Emo_Shy: [N(900, 1100, 0.06, 'sine', 0, 0.6), N(1000, 1200, 0.06, 'sine', 0.09, 0.6), N(1100, 1300, 0.06, 'sine', 0.18, 0.6)],
  Emo_Sweat: [N(1500, 700, 0.14, 'sine', 0, 0.7)],
  Emo_Sad: [N(660, 440, 0.25, 'triangle', 0, 0.6)],
  Emo_Tear: [N(1400, 800, 0.12, 'sine', 0, 0.6)],
  Emo_Twinkle: [N(1760, 1760, 0.05, 'sine', 0, 0.5), N(2093, 2093, 0.05, 'sine', 0.06, 0.5), N(2637, 2637, 0.09, 'sine', 0.12, 0.5)],
  Emo_Upset: [N(300, 260, 0.18, 'sawtooth', 0, 0.25)],
  Emo_Angry: [N(220, 180, 0.12, 'sawtooth', 0, 0.3), N(240, 200, 0.12, 'sawtooth', 0.14, 0.3)],
  Emo_Steam: [N(400, 200, 0.2, 'triangle', 0, 0.5)],
  Emo_Sigh: [N(520, 330, 0.3, 'sine', 0, 0.5)],
  Emo_Bulb: [N(1318, 1976, 0.1)],
  Emo_Zzz: [N(220, 200, 0.3, 'triangle', 0, 0.5)],
};

export class Audio {
  constructor(base = '') {
    this.base = base; this.buf = {}; this.ctx = null; this.vol = 0.8; this.bgmVol = 0.35; this.bgm = null;
  }
  async unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.out = this.ctx.createGain(); this.out.gain.value = this.vol; this.out.connect(this.ctx.destination);
      this.bgmOut = this.ctx.createGain(); this.bgmOut.gain.value = 0; this.bgmOut.connect(this.ctx.destination);
      this.ready = Promise.resolve();
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    return this.ready;
  }
  async _load(name) {
    try {
      const r = await fetch(name.includes('/') ? name : this.base + name + '.ogg');      // 팩 음원 (전체 경로)
      this.buf[name] = await this.ctx.decodeAudioData(await r.arrayBuffer());
    } catch (e) { console.warn('audio', name, e); }
  }
  /** 앱이 뒤로 가면 소리를 완전히 멈춘다 (BGM·음성 포함) */
  suspend() { try { this.vsrc?.stop(); } catch (_) { /* 끝남 */ } if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setVolume(v) { this.vol = v; if (this.out) this.out.gain.value = v; }
  setBgmVolume(v) { this.bgmVol = v; if (this.bgmOut) this.bgmOut.gain.setTargetAtTime(v, this.ctx.currentTime, 0.3); }
  /** name: 'UI_Button_Touch' · 'Emo_Heart' … — 접두사가 없으면 SE_ 로 본다. 합성 효과음이 있으면 그것을 낸다 */
  play(name, { volume = 1, rate = 1 } = {}) {
    if (!/^(SE|UI|Emo|Theme)_/.test(name) && !name.includes('/')) name = 'SE_' + name;
    if (!this.ctx) return null;
    if (SYN[name]) return this._synth(SYN[name], volume);
    const b = this.buf[name];
    if (!b) return null;
    const s = this.ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = rate;
    const g = this.ctx.createGain(); g.gain.value = volume; s.connect(g).connect(this.out); s.start();
    return s;
  }
  _synth(notes, volume) {
    const c = this.ctx, t0 = c.currentTime + 0.005;
    for (const n of notes) {
      const o = c.createOscillator(), g = c.createGain(), s = t0 + n.t, e = s + n.d;
      o.type = n.w; o.frequency.setValueAtTime(n.f0, s); o.frequency.exponentialRampToValueAtTime(Math.max(20, n.f1), e);
      const v = 0.22 * n.g * volume;
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(v, s + 0.006); g.gain.exponentialRampToValueAtTime(0.0008, e + 0.04);
      o.connect(g).connect(this.out); o.start(s); o.stop(e + 0.06);
    }
    return true;
  }
  /** 캐릭터 음성 (팩의 파일). 길이(초)를 돌려준다 — 입 움직임 · 말풍선 시간에 쓴다 */
  async voice(key, { volume = 1 } = {}) {
    if (!this.ctx) return 0;
    const name = key;      // 팩 음성: 'packs/…/voice/talk_1.ogg' (전체 경로)
    if (!this.buf[name]) {
      try { const r = await fetch(key); this.buf[name] = await this.ctx.decodeAudioData(await r.arrayBuffer()); }
      catch (e) { console.warn('voice', key, e); return 0; }
    }
    try { this.vsrc?.stop(); } catch (_) { /* 이미 끝남 */ }
    const s = this.ctx.createBufferSource(); s.buffer = this.buf[name];
    const g = this.ctx.createGain(); g.gain.value = volume * 1.15; s.connect(g).connect(this.out); s.start();
    this.vsrc = s;
    return s.buffer.duration;
  }
  stopVoice() { try { this.vsrc?.stop(); } catch (_) { /* 이미 끝남 */ } this.vsrc = null; }
  /** 배경음 바꾸기: 지금 곡을 완전히 줄여 끈 다음 새 곡을 서서히 올린다 (두 곡이 겹치지 않게) */
  async playBgm(name) {
    if (!this.ctx) return;
    const tok = (this.bgmTok = (this.bgmTok || 0) + 1);
    this.bgmName = name;                       // 곧바로 이름을 바꿔 같은 곡을 두 번 틀지 않게
    const out = this._fadeOut(0.45);
    if (!this.buf[name]) await this._load(name);
    await out;
    if (tok !== this.bgmTok) return;           // 그 사이 다른 곡으로 바뀜
    const b = this.buf[name]; if (!b) return;
    this.bgmOut.gain.setTargetAtTime(this.bgmVol, this.ctx.currentTime, 0.05);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0, this.ctx.currentTime); g.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 0.8);
    const s = this.ctx.createBufferSource(); s.buffer = b; s.loop = true; s.connect(g).connect(this.bgmOut); s.start();
    this.bgm = s; this.bgmG = g;
  }
  /** 지금 곡을 t 초 동안 줄이고 멈춘다. 다 줄면 끝나는 Promise */
  _fadeOut(t) {
    const s = this.bgm, g = this.bgmG; this.bgm = null; this.bgmG = null;
    if (!s) return Promise.resolve();
    const now = this.ctx.currentTime;
    try { g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(g.gain.value, now); g.gain.linearRampToValueAtTime(0, now + t); } catch (_) { /* */ }
    return new Promise((r) => setTimeout(() => { try { s.stop(); } catch (_) { /* 이미 정지 */ } r(); }, t * 1000 + 30));
  }
  stopBgm(t = 0.6) {
    this.bgmTok = (this.bgmTok || 0) + 1; this.bgmName = null;
    this._fadeOut(t);
  }

}
