// A small pan-and-zoom map viewer (no libraries needed).
// Mouse: drag to pan, wheel to zoom. Touch: drag to pan, pinch to zoom.
// Positions everywhere are fractions of the map: x 0..1 left to right, y 0..1 top to bottom.
(function () {
  const W = 1000; // internal map width; height follows the image's aspect ratio
  const MAX_SCALE = 6;

  class Viewer {
    constructor(el) {
      this.el = el;
      el.classList.add('viewer');
      el.innerHTML =
        '<div class="v-world"><img class="v-img" alt="" draggable="false"></div>' +
        '<svg class="v-lines"></svg><div class="v-marks"></div>';
      this.world = el.querySelector('.v-world');
      this.img = el.querySelector('.v-img');
      this.svg = el.querySelector('.v-lines');
      this.marks = el.querySelector('.v-marks');
      this.H = W; this.s = 1; this.tx = 0; this.ty = 0; this.minS = 0.1;
      this.cw = 1; this.ch = 1;
      this.markers = []; this.lines = [];
      this.ptrs = new Map(); this.moved = false;
      this.clickHandler = null;
      this._bind();
      new ResizeObserver(() => this._resize()).observe(el);
    }

    onClick(fn) { this.clickHandler = fn; }

    setMap(src, aspect) {
      this.H = W * aspect;
      this.world.style.width = W + 'px';
      this.world.style.height = this.H + 'px';
      this.img.style.width = W + 'px';
      this.img.style.height = this.H + 'px';
      if (this.img.getAttribute('src') !== src) this.img.src = src;
      this.fit();
    }

    _measure() {
      const r = this.el.getBoundingClientRect();
      this.cw = Math.max(1, r.width); this.ch = Math.max(1, r.height);
      this.minS = Math.min(this.cw / W, this.ch / this.H);
    }

    _resize() {
      const wasFit = Math.abs(this.s - this.minS) < 1e-6;
      this._measure();
      if (wasFit) { this.fit(); return; }
      this.s = Math.min(MAX_SCALE, Math.max(this.minS, this.s));
      this._apply();
    }

    fit() {
      this._measure();
      this.s = this.minS;
      this.tx = (this.cw - W * this.s) / 2;
      this.ty = (this.ch - this.H * this.s) / 2;
      this._apply();
    }

    // Zoom so all the given points {x,y} are in view.
    fitPoints(pts, opts = {}) {
      const pad = opts.pad ?? 0.5, maxS = opts.maxScale ?? 3;
      this._measure();
      const xs = pts.map(p => p.x * W), ys = pts.map(p => p.y * this.H);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const bw = Math.max(x1 - x0, 1), bh = Math.max(y1 - y0, 1);
      let s = Math.min(this.cw / (bw * (1 + 2 * pad)), this.ch / (bh * (1 + 2 * pad)));
      this.s = Math.min(maxS, Math.max(this.minS, s));
      this.tx = this.cw / 2 - ((x0 + x1) / 2) * this.s;
      this.ty = this.ch / 2 - ((y0 + y1) / 2) * this.s;
      this._apply();
    }

    zoomBy(f) { this._zoomAt(f, this.cw / 2, this.ch / 2); }

    setMarkers(list) {
      this.markers = list;
      this.marks.innerHTML = '';
      for (const m of list) {
        const d = document.createElement('div');
        d.className = 'v-pin ' + (m.cls || '');
        if (m.html) d.innerHTML = m.html;
        if (m.title) d.title = m.title;
        if (m.onClick) {
          d.addEventListener('pointerdown', e => e.stopPropagation());
          d.addEventListener('click', e => { e.stopPropagation(); m.onClick(); });
        }
        m.el = d;
        this.marks.appendChild(d);
      }
      this._layout();
    }

    setLines(list) {
      this.lines = list;
      this.svg.innerHTML = '';
      for (const l of list) {
        for (const cls of ['v-line-bg', 'v-line']) {
          const n = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          n.setAttribute('class', cls);
          this.svg.appendChild(n);
        }
      }
      this._layout();
    }

    _toScreen(p) { return [this.tx + p.x * W * this.s, this.ty + p.y * this.H * this.s]; }

    _layout() {
      for (const m of this.markers) {
        const [x, y] = this._toScreen(m);
        m.el.style.left = x + 'px'; m.el.style.top = y + 'px';
      }
      const lines = this.svg.querySelectorAll('line');
      this.lines.forEach((l, i) => {
        const [x1, y1] = this._toScreen(l.a), [x2, y2] = this._toScreen(l.b);
        for (const n of [lines[i * 2], lines[i * 2 + 1]]) {
          n.setAttribute('x1', x1); n.setAttribute('y1', y1);
          n.setAttribute('x2', x2); n.setAttribute('y2', y2);
        }
      });
    }

    _apply() {
      const w = W * this.s, h = this.H * this.s;
      this.tx = w <= this.cw ? (this.cw - w) / 2 : Math.min(0, Math.max(this.cw - w, this.tx));
      this.ty = h <= this.ch ? (this.ch - h) / 2 : Math.min(0, Math.max(this.ch - h, this.ty));
      this.world.style.transform = `translate(${this.tx}px, ${this.ty}px) scale(${this.s})`;
      // Show crisp pixels once zoomed past the image's real resolution; smooth when zoomed out.
      const native = (this.img.naturalWidth || 4000) / W;
      this.img.classList.toggle('pix', this.s >= native);
      this._layout();
    }

    _zoomAt(f, cx, cy) {
      const ns = Math.min(MAX_SCALE, Math.max(this.minS, this.s * f));
      const k = ns / this.s;
      this.tx = cx - (cx - this.tx) * k;
      this.ty = cy - (cy - this.ty) * k;
      this.s = ns;
      this._apply();
    }

    _local(e) {
      const r = this.el.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    }

    _bind() {
      const el = this.el;
      el.addEventListener('pointerdown', e => {
        if (e.button > 0) return;
        el.setPointerCapture(e.pointerId);
        const [x, y] = this._local(e);
        this.ptrs.set(e.pointerId, { x, y, sx: x, sy: y });
        if (this.ptrs.size === 1) this.moved = false; else this.moved = true;
      });
      el.addEventListener('pointermove', e => {
        const p = this.ptrs.get(e.pointerId);
        if (!p) return;
        const [x, y] = this._local(e);
        if (this.ptrs.size === 1) {
          if (!this.moved && Math.hypot(x - p.sx, y - p.sy) > 6) this.moved = true;
          if (this.moved) { this.tx += x - p.x; this.ty += y - p.y; this._apply(); }
          p.x = x; p.y = y;
        } else if (this.ptrs.size === 2) {
          const [a, b] = [...this.ptrs.values()];
          const d0 = Math.hypot(a.x - b.x, a.y - b.y), m0x = (a.x + b.x) / 2, m0y = (a.y + b.y) / 2;
          p.x = x; p.y = y;
          const d1 = Math.hypot(a.x - b.x, a.y - b.y), m1x = (a.x + b.x) / 2, m1y = (a.y + b.y) / 2;
          this.tx += m1x - m0x; this.ty += m1y - m0y;
          if (d0 > 0) this._zoomAt(d1 / d0, m1x, m1y); else this._apply();
        }
      });
      const end = e => {
        if (!this.ptrs.has(e.pointerId)) return;
        const wasSingle = this.ptrs.size === 1;
        this.ptrs.delete(e.pointerId);
        if (e.type === 'pointerup' && wasSingle && !this.moved && this.clickHandler) {
          const [x, y] = this._local(e);
          const fx = (x - this.tx) / (W * this.s), fy = (y - this.ty) / (this.H * this.s);
          if (fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1) this.clickHandler({ x: fx, y: fy });
        }
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      el.addEventListener('wheel', e => {
        e.preventDefault();
        const [x, y] = this._local(e);
        const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
        this._zoomAt(Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018)), x, y);
      }, { passive: false });
    }
  }

  window.Viewer = Viewer;
})();
