// 정지 이미지 캐릭터 리그 (StillRig)
//
// 캐릭터 팩의 투명 PNG/SVG 레이어를 겹쳐 그린 뒤, 화면 휘기(warp) 셰이더로 숨쉬기 · 몸 흔들림 · 고개 기울임을 준다.
//   body       몸통 (얼굴 영역 포함 · 기본 얼굴)
//   face/<id>  표정 레이어 — 몸통과 같은 캔버스 크기 · 같은 위치 (바꿀 때 120ms 교차 페이드)
//   blink      눈 감은 레이어 (선택: 없으면 깜빡임 생략)
//   mouth      입 벌린 레이어 (선택: 없으면 립싱크 생략)
// 모든 레이어는 같은 크기 · 같은 위치에 맞춘 그림이어야 한다 (docs/PACKS.md).
//
// main.js 가 쓰는 메서드: setModel · resize · update · expr · talk · look · pat · has
//   rig = { head:[x,y], emo:[x,y], halo:[x,y], face:{cx, chin, top} }  (요소 안 비율 좌표. head · emo 는 위가 0, face 는 아래가 0)

const VS = 'attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
// 레이어 합성: 그림 한 장을 캔버스에 맞춰(contain) 그린다
const VS_L = 'attribute vec2 p;uniform vec4 r;varying vec2 uv;void main(){uv=vec2(p.x,1.-p.y);gl_Position=vec4(r.xy+p*r.zw,0.,1.);}';
const FS_L = 'precision mediump float;varying vec2 uv;uniform sampler2D tx;uniform float a;void main(){gl_FragColor=texture2D(tx,uv)*a;}';
// 화면 휘기: 발은 고정, 위로 갈수록 좌우로 흔들림 · 숨 들이쉴 때 가슴 위가 살짝 올라가고 벌어짐 · 목 위는 따로 기울임 · 옷자락은 한 박자 늦게.
// 시간에 따른 값은 JS(배정밀도)에서 계산해 넘긴다 — 폰 GPU 의 mediump 로 큰 시간 값을 sin 하면 값이 계단처럼 끊긴다.
const FS_W = `precision mediump float;varying vec2 uv;uniform sampler2D tx;uniform float B,S,H,ks,kc,sw,bb,ar,hn,hx,gx,gy;
  float ss(float a,float b,float x){return smoothstep(a,b,x);}
  void main(){
    vec2 q=uv; float y=q.y, x=(q.x-hx)*ar;
    float up=ss(.05,1.,y);
    vec2 d=vec2(0.);
    d.x+=sw*S*up*up*y;
    float chest=ss(hn-.38,hn-.12,y);
    d.y+=bb*B*chest;
    d.x+=bb*.6*B*x*exp(-pow((y-(hn-.16))/.09,2.));
    float hd=ss(hn-.03,hn+.05,y); float ang=sw*.9*H*hd;
    vec2 r=vec2(x,y-hn); d+=vec2(-r.y*ang, r.x*ang);
    d+=vec2(gx,gy)*hd;                                          /* 시선: 머리를 포인터 쪽으로 살짝 */
    float sk=1.-ss(.0,.33,y);
    d.x+=sw*.35*(ks*cos(y*4.)+kc*sin(y*4.))*sk*abs(x)*3.;
    d.x/=ar;
    vec2 sp=q-d; gl_FragColor=(sp.x<0.||sp.x>1.||sp.y<0.||sp.y>1.)?vec4(0.):texture2D(tx,sp);
  }`;

const loadImg = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });

export class StillRig {
  /** model: { base, w, h, layers:{body, faces:{id:path}, blink, mouth}, anchor:{head, emo, neck, cx}, face0 } */
  constructor(canvas, model) {
    this.c = canvas; this.ok = false; this.t = 0; this.scale = 1; this.rig = null; this.sk = null;
    this.face = null; this.prev = null; this.fadeT = 1; this.gaze = { x: 0, y: 0, tx: 0, ty: 0 };
    this.blinkUntil = 0; this.nextBlink = 2; this.mouthUntil = 0; this.mouthOpen = false; this.mouthFlip = 0;
    this.tex = {}; this.motion = {};
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
    this.gl = gl;
    if (gl) this._initGL();
    addEventListener('resize', () => this.resize());
    if (model) this.setModel(model);
  }

  _initGL() {
    const gl = this.gl;
    const prog = (vs, fs, names) => {
      const sh = (k, s) => { const o = gl.createShader(k); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(o)); return o; };
      const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
      const u = {}; for (const n of names) u[n] = gl.getUniformLocation(p, n);
      return { p, u, a: gl.getAttribLocation(p, 'p') };
    };
    this.L = prog(VS_L, FS_L, ['tx', 'a', 'r']);
    this.W = prog(VS, FS_W, ['tx', 'B', 'S', 'H', 'ks', 'kc', 'sw', 'bb', 'ar', 'hn', 'hx', 'gx', 'gy']);
    this.quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    this.full = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.full);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.fb = { f: gl.createFramebuffer(), tex: gl.createTexture(), w: 0, h: 0 };
  }

  _upload(im) {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);     // 반투명 가장자리가 하얗게 뜨지 않게
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    return t;
  }

  /** 캐릭터(포즈) 바꾸기. 한 번 읽은 그림은 기억해 둔다 */
  async setModel(m) {
    this.model = m; this.ok = false;
    if (!m || !this.gl) return;
    const key = m.base;
    const L = m.layers || {};
    const paths = { body: L.body, blink: L.blink, mouth: L.mouth };
    for (const [id, p] of Object.entries(L.faces || {})) paths['face:' + id] = p;
    const got = {};
    await Promise.all(Object.entries(paths).filter(([, p]) => p).map(async ([k, p]) => {
      const ck = key + '|' + k;
      if (!this.tex[ck]) { const im = await loadImg(m.base + p); if (im) this.tex[ck] = { t: this._upload(im), w: im.naturalWidth || im.width, h: im.naturalHeight || im.height }; }
      if (this.tex[ck]) got[k] = this.tex[ck];
    }));
    if (this.model !== m || !got.body) return;               // 읽는 사이 다른 캐릭터로 바뀜 / 몸통 그림 없음
    this.lay = got;
    this.faces = Object.keys(got).filter((k) => k.startsWith('face:')).map((k) => k.slice(5));
    this.w = m.w || got.body.w; this.h = m.h || got.body.h;
    this.aspect = this.w / this.h;
    const A = m.anchor || {};
    const head = A.head || [0.5, 0.2], emo = A.emo || [head[0] + 0.18, Math.max(0.02, head[1] - 0.12)];
    const neck = A.neck ?? head[1] + 0.12;                    // 위가 0
    this.rig = { head, emo, halo: [head[0], Math.max(0, head[1] - 0.1)], face: { cx: A.cx ?? head[0], chin: 1 - neck, top: 1 - Math.max(0, head[1] - 0.12) } };
    this.f0 = this.has(this.face0) ? this.face0 : this.has(m.face0) ? m.face0 : this.faces[0] || null;
    this.face = this.f0; this.prev = null; this.fadeT = 1;
    this.c.parentElement?.parentElement?.style.setProperty('--ar', String(this.aspect));
    this.resize();
    this.ok = true; this.c.classList.add('ready');
  }

  has(f) { return f != null && !!(this.lay && this.lay['face:' + f]); }

  resize() {
    const d = Math.min(devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.round(this.c.clientWidth * d)), h = Math.max(1, Math.round(this.c.clientHeight * d));
    if (this.c.width !== w || this.c.height !== h) { this.c.width = w; this.c.height = h; }
  }

  /** 표정 바꾸기. 팩에 없는 표정은 기본 표정 */
  expr(code) {
    let c = code == null ? this.f0 : String(code);
    if (!this.ok) { this.face0 = this.face0 || c; return; }
    if (!this.has(c)) c = this.f0;
    if (c === this.face) return;
    this.prev = this.face; this.face = c; this.fadeT = 0;
  }
  /** 말하는 중: true/false, 또는 말하는 시간(ms) — 입 레이어가 있으면 입을 여닫는다 */
  talk(on) {
    const now = performance.now();
    this.mouthUntil = on === true ? Infinity : on === false ? 0 : now + Math.max(0, +on || 0);
    if (!on) this.mouthOpen = false;
  }
  look(x, y) { this.gaze.tx = Math.max(-1, Math.min(1, x)); this.gaze.ty = Math.max(-1, Math.min(1, y)); }
  pat() { return false; }

  update(dt) {
    if (!this.ok) return;
    dt = Math.min(dt, 0.1); this.t += dt;
    const now = performance.now();
    // 깜빡임: 3.5~4.5초마다 (가끔 두 번)
    if (this.lay.blink && this.t >= this.nextBlink) {
      this.blinkUntil = now + 110;
      if (Math.random() < 0.3) this.blink2 = now + 260;
      this.nextBlink = this.t + 3.5 + Math.random();
    }
    if (this.blink2 && now >= this.blink2) { this.blinkUntil = now + 100; this.blink2 = 0; }
    // 입: 말하는 동안 불규칙하게 여닫기
    if (this.lay.mouth && now < this.mouthUntil) {
      if (now >= this.mouthFlip) { this.mouthOpen = !this.mouthOpen; this.mouthFlip = now + (this.mouthOpen ? 90 + Math.random() * 90 : 60 + Math.random() * 80); }
    } else this.mouthOpen = false;
    this.fadeT = Math.min(1, this.fadeT + dt / 0.12);
    const G = this.gaze; G.x += (G.tx - G.x) * Math.min(1, dt * 4); G.y += (G.ty - G.y) * Math.min(1, dt * 4);
    this.draw(now);
  }

  _fbPrep(w, h) {
    const gl = this.gl, F = this.fb;
    if (F.w === w && F.h === h) return true;
    gl.bindTexture(gl.TEXTURE_2D, F.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    gl.bindFramebuffer(gl.FRAMEBUFFER, F.f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, F.tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (ok) { F.w = w; F.h = h; }
    return ok;
  }

  _layer(t, a, rect) {
    if (!t || a <= 0) return;
    const gl = this.gl, L = this.L;
    gl.bindTexture(gl.TEXTURE_2D, t.t); gl.uniform1f(L.u.a, a); gl.uniform4fv(L.u.r, rect);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  draw(now = performance.now()) {
    const gl = this.gl, c = this.c, W = c.width, H = c.height;
    const warp = !document.documentElement.classList.contains('lowpower') && this._fbPrep(W, H);
    gl.bindFramebuffer(gl.FRAMEBUFFER, warp ? this.fb.f : null);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    // 그림이 캔버스 안에 다 들어오게 (contain), 아래 가운데 정렬
    const k = Math.min(W / this.w, H / this.h), dw = this.w * k / W * 2, dh = this.h * k / H * 2;
    const rect = [-dw / 2, -1, dw, dh];
    const L = this.L;
    gl.useProgram(L.p); gl.activeTexture(gl.TEXTURE0); gl.uniform1i(L.u.tx, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); gl.enableVertexAttribArray(L.a); gl.vertexAttribPointer(L.a, 2, gl.FLOAT, false, 0, 0);
    const ly = this.lay;
    this._layer(ly.body, 1, rect);
    const f = this.fadeT, cur = ly['face:' + this.face], prev = this.prev && ly['face:' + this.prev];
    if (prev && f < 1) this._layer(prev, 1 - f, rect);
    this._layer(cur, prev && f < 1 ? f : 1, rect);
    if (now < this.blinkUntil && this.face === this.f0) this._layer(ly.blink, 1, rect);   // 기본 표정일 때만 깜빡임 (표정마다 눈 모양이 다르다)
    if (this.mouthOpen) this._layer(ly.mouth, 1, rect);
    gl.disableVertexAttribArray(L.a);
    if (warp) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); this._warp(W, H, dw / 2, dh / 2); }
  }

  _warp(W, H, sx, sy) {
    const gl = this.gl, P = this.W, u = P.u, m = this.motion || {}, A = this.rig;
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.BLEND);
    gl.useProgram(P.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.full); gl.enableVertexAttribArray(P.a); gl.vertexAttribPointer(P.a, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.fb.tex); gl.uniform1i(u.tx, 0);
    const t = performance.now() / 1000, br = m.breath || 3.6, w = 2 * Math.PI;
    gl.uniform1f(u.B, 0.5 - 0.5 * Math.cos(w * t / br));
    gl.uniform1f(u.S, Math.sin(w * t / (br * 2.3) + 0.7));
    gl.uniform1f(u.H, Math.sin(w * t / (br * 1.7) + 2.1));
    const a = w * t / (br * 2.3) - 0.6;
    gl.uniform1f(u.ks, Math.sin(a)); gl.uniform1f(u.kc, Math.cos(a));
    gl.uniform1f(u.sw, (Math.max(0.6, m.sway ?? 0.5) * Math.PI / 180) * 1.3);
    gl.uniform1f(u.bb, Math.max(0.4, m.bob ?? 0.4) / 100 * 2.2);
    gl.uniform1f(u.ar, W / H);
    // 그림 좌표(위가 0) → 캔버스 좌표(아래가 0). 그림은 캔버스 아래 가운데에 붙어 있다
    const neckUp = A.face.chin * sy;                     // 캔버스 높이 비율
    gl.uniform1f(u.hn, m.neck ?? neckUp);
    gl.uniform1f(u.hx, 0.5 + ((m.cx ?? A.face.cx) - 0.5) * sx);
    gl.uniform1f(u.gx, this.gaze.x * 0.006); gl.uniform1f(u.gy, -this.gaze.y * 0.004);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disableVertexAttribArray(P.a);
    gl.enable(gl.BLEND);
  }
}
