// Pure game logic (no page code), so it can be tested on its own.
(function (root) {
  // Distance between two points on one map, as a fraction of the map's diagonal.
  // aspect = map height / map width; points are {x, y} fractions (0..1).
  function distance(aspect, a, b) {
    const dx = a.x - b.x;
    const dy = (a.y - b.y) * aspect;
    return Math.hypot(dx, dy) / Math.hypot(1, aspect);
  }

  // Points for a given distance: full marks inside the bullseye, then smooth falloff.
  function scoreFor(cfg, d) {
    const e = Math.max(0, d - cfg.perfectRadius);
    return Math.round(cfg.maxScore * Math.exp(-cfg.falloff * e));
  }

  function verdict(d, cfg) {
    if (d <= cfg.perfectRadius) return 'Bullseye!';
    if (d < 0.04) return 'So close!';
    if (d < 0.12) return 'Not far!';
    return 'Way off!';
  }

  function tier(pts, cfg) {
    const f = pts / cfg.maxScore;
    return f >= 0.8 ? '🟩' : f >= 0.4 ? '🟨' : f >= 0.1 ? '🟧' : '🟥';
  }

  // Small seeded random generator, so the daily challenge is the same for everyone.
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function shuffle(arr, rnd) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function todayKey() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  const api = { distance, scoreFor, verdict, tier, mulberry32, hashStr, shuffle, todayKey };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Logic = api;
})(typeof window !== 'undefined' ? window : globalThis);
