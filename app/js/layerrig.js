// 레이어 리그 — 파트별 레이어 방식 (버추얼 모델과 같은 구조). 캐릭터 팩의 rig: "layers" 포즈가 쓴다
//
// tools/rig/make_layers.py 가 만든 레이어를 뒤에서 앞으로 겹쳐 그린다.
//   back(뒷머리) → body(몸) → face(얼굴) → hair(앞·옆·땋은 머리) → ribbon → halo
// 원칙: 그림을 늘리거나 줄이지 않는다. 레이어를 통째로 이동·회전한다.
//   · 머리 묶음(back·face·hair·ribbon)은 목을 축으로 함께 회전 → 이목구비가 일그러지지 않음
//   · 레이어마다 밀리는 양(시차)이 달라 고개를 돌릴 때 입체감이 생김
//   · 머리카락·리본만 뿌리를 고정한 채 끝이 흔들림 (그 레이어 안에서만 일어나 얼굴·몸에는 영향 없음)
//   · 눈 깜빡임·입은 얼굴 위에 눈꺼풀·입 모양을 덧그린다
// 기준점(목·눈·입 위치 등)은 layers.json 의 "rig" 에서 읽는다 → 모델을 바꿔도 코드는 그대로.

const VS = `
attribute vec2 a_pos;
uniform vec4 u_rect;                  // 레이어 사각형 (전체 그림 기준 x, y, w, h)
uniform float u_t, u_head, u_mode;    // mode: 0 고정 · 1 머리카락 · 2 리본 · 3 헤일로 · 5 몸
uniform float u_hz, u_hx, u_hy, u_par;
uniform float u_sway, u_wind, u_breath, u_bob, u_lean, u_scale;
uniform vec2 u_pivot, u_knot, u_halo;
uniform vec3 u_hairz;                 // 머리카락: 중심 x, 흔들림 시작 y, 끝 y
varying vec2 v_uv;

float band(float v, float a, float b) { return smoothstep(a, b, v); }

void main() {
  vec2 uv = u_rect.xy + a_pos * u_rect.zw;
  vec2 p = uv;

  if (u_mode == 1.0) {
    float tip = band(uv.y, u_hairz.y, u_hairz.z);
    float outer = band(abs(uv.x - u_hairz.x), 0.06, 0.36);
    float w = tip * tip * (0.35 + 0.65 * outer);
    float wave = sin(u_t * 1.9 + uv.y * 11.0 + uv.x * 4.0) + 0.5 * sin(u_t * 3.1 + uv.y * 19.0);
    p.x += w * (u_sway + u_wind * wave);
    p.y += w * abs(u_sway) * 0.25;
  } else if (u_mode == 2.0) {
    float w = band(abs(uv.x - u_knot.x), 0.05, 0.40);
    float side = sign(uv.x - u_knot.x);
    p.y += w * (u_wind * 2.2 * sin(u_t * 2.3 + side * 1.3 + uv.x * 5.0) - abs(u_sway) * 0.9 + u_sway * side * 0.8);
  } else if (u_mode == 3.0) {
    p.y += u_wind * 1.6 * sin(u_t * 1.1) + (uv.x - u_halo.x) * u_sway * 1.5;
    p.x += u_sway * 0.9;
  }

  if (u_head == 1.0) {
    vec2 d = p - u_pivot;
    float c = cos(u_hz), s = sin(u_hz);
    p = u_pivot + vec2(d.x * c - d.y * s, d.x * s + d.y * c);
    p += vec2(u_hx + u_par, u_hy);
    p.y -= u_breath;
  } else {
    float up = 1.0 - band(uv.y, u_pivot.y, 1.00);
    p.y -= u_breath * up;
    float chest = band(uv.y, u_pivot.y + 0.02, u_pivot.y + 0.20) * (1.0 - band(uv.y, u_pivot.y + 0.25, 1.0));
    p.x += (uv.x - u_pivot.x) * u_breath * 0.6 * chest;
  }

  p.x += u_lean * (1.0 - uv.y);
  p.y += u_bob;

  v_uv = uv;
  gl_Position = vec4((p * 2.0 - 1.0) * vec2(1.0, -1.0) * u_scale, 0.0, 1.0);
}`;

const FS = `
precision mediump float;
uniform sampler2D u_tex;
uniform vec4 u_frect;
uniform float u_alpha, u_flash, u_face, u_blink, u_mopen;
uniform vec4 u_eye, u_lid, u_skinUp, u_skinDn, u_mouth;
varying vec2 v_uv;

vec4 tex(vec2 full) { return texture2D(u_tex, (full - u_frect.xy) / u_frect.zw); }
vec3 unpm(vec4 c) { return c.rgb / max(c.a, 0.01); }

void main() {
  vec2 uv = v_uv;
  vec4 c = tex(uv);

  if (u_face == 1.0 && c.a > 0.02) {
    vec3 rgb = c.rgb / c.a;

    // 눈 감기 — 눈의 곡선을 따라 눈꺼풀이 내려와 덮는다
    if (u_blink > 0.002) {
      vec2 q = abs(uv - u_eye.xy) / u_eye.zw;
      float sock = 1.0 - smoothstep(0.80, 1.08, pow(pow(q.x, 4.0) + pow(q.y, 4.0), 0.25));
      float cx = uv.x - u_eye.x;
      float lid = mix(u_lid.x + u_lid.z * cx * cx, u_lid.y - u_lid.w * cx * cx, u_blink);
      float cover = smoothstep(lid + 0.004, lid - 0.004, uv.y);
      float k = clamp((uv.x - u_skinUp.x) / (u_skinUp.z - u_skinUp.x), 0.0, 1.0);
      vec3 up = unpm(tex(vec2(mix(u_skinUp.x, u_skinUp.z, k), u_skinUp.y)));
      vec3 dn = unpm(tex(vec2(mix(u_skinDn.x, u_skinDn.z, k), u_skinDn.y)));
      // 샘플선이 선화(머리카락 외곽선 등)를 밟으면 세로 줄무늬가 생긴다 → 어두운 쪽은 버린다
      float lu = dot(up, vec3(.299, .587, .114)), ld = dot(dn, vec3(.299, .587, .114));
      if (lu < ld - 0.06) up = dn; else if (ld < lu - 0.06) dn = up;
      vec3 skin = mix(up, dn, smoothstep(u_lid.x, u_lid.y, uv.y));
      vec3 col = mix(skin, skin * vec3(0.32, 0.30, 0.40), smoothstep(0.008, 0.0, abs(uv.y - lid)));
      rgb = mix(rgb, col, cover * sock);
    }

    // 입 벌리기 — 원화는 다문 미소. 말할 때 입술선 아래로 입 모양을 그린다
    if (u_mopen > 0.02) {
      vec2 m = (uv - vec2(u_mouth.x, u_mouth.y + u_mouth.w * 0.55 * u_mopen))
             / vec2(u_mouth.z * (0.70 + 0.30 * u_mopen), u_mouth.w * u_mopen);
      float d = length(m);
      float inside = 1.0 - smoothstep(0.86, 1.0, d);
      vec3 mouthCol = mix(vec3(0.62, 0.25, 0.33), vec3(0.93, 0.52, 0.55), smoothstep(-0.1, 0.8, m.y));   // 안쪽 → 혀
      vec3 rim = vec3(0.55, 0.22, 0.28);
      rgb = mix(rgb, mix(mouthCol, rim, smoothstep(0.70, 0.95, d)), inside);
    }
    c.rgb = rgb * c.a;
  }

  c.rgb = mix(c.rgb, vec3(c.a), u_flash);
  gl_FragColor = c * u_alpha;
}`;

// 레이어별 설정 — head: 머리에 붙음 · par: 시차 · mode · sway/wind: 흔들림 배율 · lag: 머리를 늦게 따라옴
const RIG = {
  back:   { head: 1, par: -0.55, mode: 1, sway: 0.75, wind: 0.70 },
  body:   { head: 0, par: 0,     mode: 5, sway: 0,    wind: 0 },
  face:   { head: 1, par: 1.00,  mode: 0, sway: 0,    wind: 0, face: 1 },
  hair:   { head: 1, par: 0.45,  mode: 1, sway: 1.00, wind: 1.00 },
  ribbon: { head: 1, par: 0.25,  mode: 2, sway: 1.00, wind: 1.00 },
  halo:   { head: 1, par: -0.30, mode: 3, sway: 1.00, wind: 1.00, lag: 1 },
};
const UNIFORMS = ['u_rect', 'u_frect', 'u_t', 'u_head', 'u_mode', 'u_hz', 'u_hx', 'u_hy', 'u_par', 'u_sway', 'u_wind', 'u_breath',
  'u_bob', 'u_lean', 'u_scale', 'u_pivot', 'u_knot', 'u_halo', 'u_hairz', 'u_alpha', 'u_flash', 'u_face', 'u_blink', 'u_mopen',
  'u_eye', 'u_lid', 'u_skinUp', 'u_skinDn', 'u_mouth'];
const lerp = (a, b, t) => a + (b - a) * t;

export class LayerRig {
  /** model: { base: 'packs/…/poses/stand/', anchor: {head, emo, neck, cx}, faces: {이름: {lid, mouth}}, face0 } */
  constructor(canvas, model) {
    this.c = canvas;
    this.ok = false;
    this.t = 0;
    this.talking = false;
    this.target = { x: 0, y: 0 };
    this.p = { blink: 0, mopen: 0, hz: 0, hx: 0, hy: 0, hair: 0, breath: 0, bob: 0, lean: 0, wind: 1, alpha: 1, flash: 0 };
    this.v = { hz: 0, hair: 0 };
    this.halo = { hz: 0, hx: 0, hy: 0 };
    this.glance = { z: 0, x: 0, y: 0, next: 3 };
    this.blinkAt = 1.6;
    this.face = { lid: 0, mouth: 0 };
    this.hopUntil = 0;
    this.layers = [];
    this.scale = 0.94; this.sk = null; this.model = model;
    this.faceMap = model.faces || {}; this.faces = Object.keys(this.faceMap); this.f0 = model.face0;
    this._init(model.base.replace(/\/?$/, '/'));
  }
  setModel() { /* 레이어 리그는 캐릭터마다 새로 만든다 (rig.js) */ }
  has(f) { return f != null && Object.prototype.hasOwnProperty.call(this.faceMap, String(f)); }

  async _init(dir) {
    const gl = this.c.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true });
    if (!gl) return;
    this.gl = gl;
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
      return s;
    };
    const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return;
    const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(pr)); return; }
    gl.useProgram(pr); this.pr = pr;

    const N = 48, verts = [], idx = [];
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) verts.push(i / N, j / N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * (N + 1) + i, b = a + 1, c2 = a + N + 1, d = c2 + 1;
      idx.push(a, b, c2, b, d, c2);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'a_pos'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    this.count = idx.length;
    this.u = Object.fromEntries(UNIFORMS.map((n) => [n, gl.getUniformLocation(pr, n)]));
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.resize(); addEventListener('resize', () => this.resize());

    try {
      const man = await (await fetch(dir + 'layers.json')).json();
      this.rig = man.rig;
      this.aspect = man.aspect;
      // main.js 가 쓰는 자리 (말풍선 · 감정 아이콘 · 몸 휘기): 팩의 anchor (위가 0)
      const A = this.model.anchor || {}, head = A.head || [man.rig.pivot[0], man.rig.eye[1]];
      Object.assign(this.rig, { head, emo: A.emo || [head[0] + 0.25, head[1] - 0.2], face: { cx: A.cx ?? head[0], chin: 1 - (A.neck ?? head[1] + 0.12), top: 1 - Math.max(0, head[1] - 0.15) } });
      this.c.parentElement?.parentElement?.style.setProperty('--ar', String(this.aspect));
      // 기준점은 프로그램 전체에 한 번만 넘긴다
      const R = man.rig, u = this.u;
      gl.uniform2f(u.u_pivot, ...R.pivot); gl.uniform2f(u.u_knot, ...R.knot); gl.uniform2f(u.u_halo, ...R.halo);
      gl.uniform3f(u.u_hairz, ...R.hair);
      gl.uniform4f(u.u_eye, ...R.eye); gl.uniform4f(u.u_lid, ...R.lid);
      gl.uniform4f(u.u_skinUp, ...R.skinUp); gl.uniform4f(u.u_skinDn, ...R.skinDn); gl.uniform4f(u.u_mouth, ...R.mouth);
      const load = (L) => new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => {
          const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          res({ ...L, tex, rig: RIG[L.name] || RIG.body });
        };
        img.onerror = rej; img.src = dir + L.name + '.png';
      });
      this.layers = await Promise.all(man.layers.map(load));
      this.ok = true; this.c.classList.add('ready');
    } catch (e) { console.warn('layer rig failed', e); }
  }

  resize() {
    const d = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(this.c.clientWidth * d)), h = Math.max(1, Math.round(this.c.clientHeight * d));
    if (this.c.width !== w || this.c.height !== h) { this.c.width = w; this.c.height = h; }
    if (this.gl) this.gl.viewport(0, 0, w, h);
  }

  /** 말하는 중: true/false 또는 말하는 시간(ms) */
  talk(on) {
    clearTimeout(this._tt);
    if (typeof on === 'number') { this.talking = on > 0; if (on > 0) this._tt = setTimeout(() => { this.talking = false; }, on); }
    else this.talking = !!on;
  }
  pat() { return false; }
  /** 표정: 팩의 faces 에 정한 눈꺼풀(lid) · 입(mouth) 값 */
  expr(code) {
    const F = this.faceMap[String(code)] || this.faceMap[this.f0] || {};
    this.face = { lid: F.lid || 0, mouth: F.mouth || 0 };
  }
  /** 손을 내린 모델이라 손 흔들기 대신 고개를 갸웃하며 인사한다 */
  wave() { this.v.hz += 0.55; this.hopUntil = this.t + 0.45; }
  hop() { this.hopUntil = this.t + 0.5; this.blinkAt = this.t + 0.12; }
  look(x, y) { this.target.x = Math.max(-1, Math.min(1, x)); this.target.y = Math.max(-1, Math.min(1, y)); }
  flash() { this.p.flash = 0.55; }

  update(dt) {
    if (!this.ok) return;
    dt = Math.min(dt, 0.05);
    this.t += dt;
    const t = this.t, p = this.p, g = this.glance;

    // 머리는 거의 고정, 숨쉬기·머리카락 흔들림·눈 깜빡임만 계속된다.
    // 큰 움직임(폴짝·인사·흔들기)은 캐릭터 전체에 거는 액션으로 따로 처리한다 (main.js act()).
    if (t >= g.next) {                       // 아주 가끔 고개 각도가 살짝 바뀐다
      g.z = (Math.random() - 0.5) * 0.016; g.x = 0; g.y = 0;
      g.next = t + 5 + Math.random() * 6;
    }
    p.breath = lerp(p.breath, (Math.sin(t * 1.65) * 0.5 + 0.5) * 0.0055, 0.12);         // 3.8초 주기 호흡
    p.bob = Math.sin(t * 1.65 + 0.6) * 0.0012;

    const aimZ = Math.sin(t * 0.55) * 0.006 + g.z + this.target.x * 0.012;
    this.v.hz += ((aimZ - p.hz) * 30 - this.v.hz * 9) * dt;
    p.hz += this.v.hz * dt;
    p.hx = lerp(p.hx, this.target.x * 0.002, 0.04);
    p.hy = lerp(p.hy, this.target.y * 0.0015, 0.04);

    const aimHair = -this.v.hz * 0.05 - p.hz * 0.08 + Math.sin(t * 0.9) * 0.0018;          // 머리카락 관성
    this.v.hair += ((aimHair - p.hair) * 30 - this.v.hair * 5.5) * dt;
    p.hair += this.v.hair * dt;

    const h = this.halo;                                                                   // 헤일로는 한 박자 늦게
    h.hz = lerp(h.hz, p.hz, 0.08); h.hx = lerp(h.hx, p.hx, 0.08); h.hy = lerp(h.hy, p.hy, 0.08);
    p.lean = lerp(p.lean, Math.sin(t * 0.37) * 0.0015, 0.05);

    const E = this.face;                                                                   // 표정 (눈 감은 웃음·졸림·놀람)
    if (t >= this.blinkAt) {                                                               // 눈 깜빡임
      const e = t - this.blinkAt;
      const b = e < 0.06 ? e / 0.06 : e < 0.14 ? 1 - (e - 0.06) / 0.08 : 0;
      p.blink = Math.max(E.lid, b);
      if (e >= 0.14) { this.blinkAt = t + (Math.random() < 0.2 ? 0.18 : 2.2 + Math.random() * 3.5); }
    } else p.blink = lerp(p.blink, E.lid, 0.25);

    // 입: 음절마다 열고 닫는다 (반쯤 열린 상태가 오래 머물지 않게)
    const syl = this.talking ? (Math.sin(t * 15) > -0.1 ? 0.75 + Math.sin(t * 4.1) * 0.2 : 0.05) : 0;
    p.mopen = lerp(p.mopen, Math.max(E.mouth, syl), 0.45);
    p.flash = lerp(p.flash, 0, 0.1);
    this.draw();
  }

  draw() {
    const { gl, u, p } = this;
    if (!gl || !this.ok) return;
    gl.useProgram(this.pr);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(u.u_t, this.t); gl.uniform1f(u.u_scale, 0.94);
    gl.uniform1f(u.u_breath, p.breath); gl.uniform1f(u.u_bob, p.bob); gl.uniform1f(u.u_lean, p.lean);
    gl.uniform1f(u.u_alpha, p.alpha); gl.uniform1f(u.u_flash, p.flash);
    gl.uniform1f(u.u_blink, p.blink); gl.uniform1f(u.u_mopen, p.mopen);
    const turn = p.hz * 0.03;                       // 시차는 아주 약하게 (얼굴이 머리카락에서 미끄러지지 않게)
    for (const L of this.layers) {
      const r = L.rig, src = r.lag && !p.freeze ? this.halo : p;
      gl.bindTexture(gl.TEXTURE_2D, L.tex);
      gl.uniform4f(u.u_rect, L.x, L.y, L.w, L.h); gl.uniform4f(u.u_frect, L.x, L.y, L.w, L.h);
      gl.uniform1f(u.u_head, r.head); gl.uniform1f(u.u_mode, r.mode); gl.uniform1f(u.u_face, r.face ? 1 : 0);
      gl.uniform1f(u.u_hz, src.hz); gl.uniform1f(u.u_hx, src.hx); gl.uniform1f(u.u_hy, src.hy);
      gl.uniform1f(u.u_par, turn * r.par);
      gl.uniform1f(u.u_sway, p.hair * r.sway); gl.uniform1f(u.u_wind, 0.0040 * p.wind * r.wind);
      gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    }
  }
}
