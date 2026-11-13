// 캐릭터 리그 묶음: 팩의 포즈 종류에 따라 정지 이미지 리그(StillRig) 또는 레이어 리그(LayerRig)를 쓴다.
//   rig: "still"  — 몸통 + 표정 레이어 + 셰이더 휘기 (stillrig.js)
//   rig: "layers" — 파트별 레이어(뒷머리 · 몸 · 얼굴 · 머리카락 · 리본 · 헤일로)를 따로 움직임 (layerrig.js)
// 두 리그는 WebGL 상태를 따로 쓰므로 캔버스도 따로 둔다.
import { StillRig } from './stillrig.js';
import { LayerRig } from './layerrig.js';

export class CharaRig {
  constructor(canvas) {
    this.c1 = canvas; this.cur = null; this.layers = {}; this._face0 = null; this._motion = {};
    this.still = new StillRig(canvas, null);
  }
  _layerCanvas() {
    if (!this.c2) { this.c2 = document.createElement('canvas'); this.c2.className = this.c1.className; this.c2.setAttribute('aria-hidden', 'true'); this.c1.after(this.c2); }
    return this.c2;
  }
  setModel(m) {
    if (!m) return;
    if (m.rig === 'layers') {
      const k = m.base;
      if (!this.layers[k]) this.layers[k] = new LayerRig(this._layerCanvas(), m);
      this.cur = this.layers[k];
      this.c1.hidden = true; this.c2.hidden = false;
    } else {
      this.cur = this.still; this.still.face0 = this._face0; this.still.setModel(m);
      this.c1.hidden = false; if (this.c2) this.c2.hidden = true;
    }
    this.cur.motion = this._motion;
    if (this.cur.aspect) this.c1.parentElement?.parentElement?.style.setProperty('--ar', String(this.cur.aspect));
    this.cur.resize?.();
  }
  set face0(v) { this._face0 = v; if (this.cur) this.cur.face0 = v; }
  get face0() { return this._face0; }
  set motion(v) { this._motion = v; if (this.cur) this.cur.motion = v; }
  get motion() { return this._motion; }
  get rig() { return this.cur && this.cur.rig && this.cur.rig.head ? this.cur.rig : null; }
  get ok() { return !!(this.cur && this.cur.ok); }
  get faces() { return this.cur ? this.cur.faces : []; }
  get scale() { return this.cur ? this.cur.scale ?? 1 : 1; }
  get sk() { return null; }
  has(f) { return !!(this.cur && this.cur.has && this.cur.has(f)); }
  resize() { this.cur?.resize?.(); }
  update(dt) { this.cur?.update?.(dt); }
  expr(f) { this.cur?.expr?.(f); }
  talk(on) { this.cur?.talk?.(on); }
  look(x, y) { this.cur?.look?.(x, y); }
  pat() { return this.cur?.pat?.() || false; }
}
