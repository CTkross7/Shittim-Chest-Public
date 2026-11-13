// 터치 효과 — 누른 자리에서 하늘색 링이 퍼지고, 작은 삼각형 조각이 튀어 나갔다 사라진다.
// 화면 전체에 깔린 캔버스 하나에 그린다 (터치는 통과).
export class TapFx {
  constructor(canvas) {
    this.c = canvas; this.g = canvas.getContext('2d'); this.fx = []; this.run = false;
    const fit = () => { const d = Math.min(devicePixelRatio || 1, 2); canvas.width = innerWidth * d; canvas.height = innerHeight * d; this.d = d; };
    fit(); addEventListener('resize', fit);
    addEventListener('pointerdown', (e) => this.add(e.clientX, e.clientY), { capture: true, passive: true });
  }
  add(x, y) {
    const u = Math.min(innerHeight, innerWidth * 0.625) / 800;     // 화면 크기 기준 단위 (css --u 와 같음)
    const parts = Array.from({ length: 7 }, (_, i) => {
      const a = (i / 7) * Math.PI * 2 + Math.random() * 0.6;
      return { a, v: (110 + Math.random() * 120) * u, r: (5 + Math.random() * 5) * u, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 12, fill: i % 3 === 0 };
    });
    this.fx.push({ x, y, t: 0, u, parts });
    if (this.fx.length > 12) this.fx.shift();
    if (!this.run) { this.run = true; this.last = performance.now(); requestAnimationFrame((n) => this.tick(n)); }
  }
  tick(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    const { g, d } = this;
    g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, innerWidth, innerHeight);
    const pl = document.documentElement.dataset.chara === 'plana';
    const C = pl ? '200,150,255' : '110,215,255', C2 = pl ? '210,170,255' : '120,220,255', C3 = pl ? '225,190,255' : '150,230,255';
    for (const f of this.fx) {
      f.t += dt;
      const k = Math.min(1, f.t / 0.45), e = 1 - Math.pow(1 - k, 3), fade = 1 - k;
      // 바깥 링
      g.lineWidth = 3 * f.u * fade + 0.5; g.strokeStyle = `rgba(${C},${0.9 * fade})`;
      g.beginPath(); g.arc(f.x, f.y, (14 + 46 * e) * f.u, 0, Math.PI * 2); g.stroke();
      // 안쪽 얇은 링
      g.lineWidth = 1.5 * f.u; g.strokeStyle = `rgba(255,255,255,${0.8 * fade})`;
      g.beginPath(); g.arc(f.x, f.y, (8 + 30 * e) * f.u, 0, Math.PI * 2); g.stroke();
      // 가운데 빛
      if (f.t < 0.18) {
        const a = 1 - f.t / 0.18, gr = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, 26 * f.u);
        gr.addColorStop(0, `rgba(255,255,255,${0.95 * a})`); gr.addColorStop(0.5, `rgba(${C3},${0.5 * a})`); gr.addColorStop(1, `rgba(${C3},0)`);
        g.fillStyle = gr; g.beginPath(); g.arc(f.x, f.y, 26 * f.u, 0, Math.PI * 2); g.fill();
      }
      // 삼각형 조각
      for (const p of f.parts) {
        const dist = p.v * e * 0.55, px = f.x + Math.cos(p.a) * dist, py = f.y + Math.sin(p.a) * dist, r = p.r * (1 - k * 0.6);
        g.save(); g.translate(px, py); g.rotate(p.rot + p.spin * f.t);
        g.beginPath(); g.moveTo(0, -r); g.lineTo(r * 0.87, r * 0.5); g.lineTo(-r * 0.87, r * 0.5); g.closePath();
        if (p.fill) { g.fillStyle = `rgba(${C2},${fade})`; g.fill(); }
        else { g.lineWidth = 1.4 * f.u; g.strokeStyle = `rgba(${C2},${fade})`; g.stroke(); }
        g.restore();
      }
    }
    this.fx = this.fx.filter((f) => f.t < 0.45);
    if (this.fx.length) requestAnimationFrame((n) => this.tick(n));
    else { this.run = false; g.clearRect(0, 0, innerWidth, innerHeight); }
  }
}
