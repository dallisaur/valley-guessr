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

  function todayKey(d = new Date()) {
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  // Days from firstDay to day (both 'YYYY-MM-DD'): 0 for puzzle #1, 1 for #2, and so on.
  function dayIndex(firstDay, day) {
    const utc = k => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
    return Math.max(0, Math.round((utc(day) - utc(firstDay)) / 86400000));
  }

  // ---- The daily schedule ----
  // Each day's puzzle mixes maps: every round can come from any switched-on map, so players have to find the right
  // area as well as the right spot. Puzzles are dealt one day at a time from puzzle #1:
  //  - Every spot is used once before spots start repeating (across all maps). Each spot keeps a count of how often
  //    it's been used, and a day takes spots with the lowest count. A new spot starts at the current lowest count,
  //    so it joins the cycle that's under way instead of jumping the queue.
  //  - Each map works through its spots at the same pace (the map with the biggest share of spots left goes first),
  //    so the end of a cycle doesn't leave one map's spots for the last few days.
  //  - At most maxPerArea rounds from one map, so each puzzle covers several areas (raised automatically when
  //    there are too few maps to fill a puzzle, e.g. a themed week with only two maps).
  //  - No two spots on the same map closer than minGap (a fraction of the map's diagonal), no spot from the last
  //    `recentDays` puzzles, and no two rounds in a row from the same map where it can be avoided.
  // When the rules can't all be met (usually the last few spots of a cycle), a leftover spot waits a day rather
  // than crowding a puzzle; the area limit and spacing give way only when there's no other choice.
  // A spot with `added: 'YYYY-MM-DD'` joins `delay` days after that date, and one with `removed` leaves `delay` days
  // after. Because each day only depends on the days before it, adding or removing spots never changes a puzzle
  // dated earlier than that.
  // opts = { mapStart: { mapKey: 'YYYY-MM-DD' }, maxPerArea: 2, minGap: 0.1, aspects: { mapKey: height / width } }
  //  - mapStart switches maps on: a map not listed is never used, and a listed map only from its date on.
  //    Leave it out (null) and every map is on.
  const spotKey = r => r.map + ':' + Number(r.x).toFixed(5) + ':' + Number(r.y).toFixed(5);
  const recentDays = 7;
  let cache = null;

  // Whether spot r is in the game on day index i.
  function isLive(r, i, firstDay, delay) {
    return (!r.added || i >= dayIndex(firstDay, r.added) + delay) && (!r.removed || i < dayIndex(firstDay, r.removed) + delay);
  }

  // The maps in play on day index i: switched on by then, with at least one live spot.
  function mapsOn(pool, i, firstDay, delay, mapStart) {
    const on = m => !mapStart || (mapStart[m] != null && i >= dayIndex(firstDay, mapStart[m]));
    return [...new Set(pool.filter(r => isLive(r, i, firstDay, delay)).map(r => r.map))].filter(on).sort();
  }

  // Orders a day's spots so no two rounds in a row are from the same map, if any order allows it.
  function spreadOrder(list, rnd) {
    const start = shuffle(list, rnd), n = start.length, used = new Array(n).fill(false), out = [];
    const go = () => {
      if (out.length === n) return true;
      for (let k = 0; k < n; k++) {
        if (used[k] || (out.length && start[k].map === out[out.length - 1].map)) continue;
        used[k] = true; out.push(start[k]);
        if (go()) return true;
        used[k] = false; out.pop();
      }
      return false;
    };
    return go() ? out : start;
  }

  function schedule(pool, upTo, perGame, firstDay, delay, opts) {
    const c = cache;
    if (c && c.pool === pool && c.perGame === perGame && c.firstDay === firstDay && c.delay === delay &&
        c.opts === opts && c.days.length > upTo) return c.days;
    const { mapStart = null, maxPerArea = 2, minGap = 0, aspects = {} } = opts || {};
    upTo += 30;   // work a month ahead, so asking for the next few days doesn't start over each time

    // Work out each spot's key, and when it's in the game, once up front.
    const spots = pool.map(r => ({ r, key: spotKey(r), map: r.map,
      from: r.added ? dayIndex(firstDay, r.added) + delay : 0,
      until: r.removed ? dayIndex(firstDay, r.removed) + delay : Infinity }))
      .sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
    const startDay = {};
    if (mapStart) for (const m in mapStart) startDay[m] = dayIndex(firstDay, mapStart[m]);
    const mapOn = (m, i) => !mapStart || (startDay[m] != null && i >= startDay[m]);
    const uses = new Map(), lastDay = new Map(), days = [];

    for (let i = 0; i <= upTo; i++) {
      const live = spots.filter(s => s.from <= i && i < s.until && mapOn(s.map, i));
      if (live.length < perGame) { days.push([]); continue; }
      // New spots join the cycle that's under way.
      let floor = Infinity;
      for (const s of live) if (uses.has(s.key)) floor = Math.min(floor, uses.get(s.key));
      if (floor === Infinity) floor = 0;
      for (const s of live) if (!uses.has(s.key)) uses.set(s.key, floor);
      const low = Math.min(...live.map(s => uses.get(s.key)));

      // Each map's spot count, and how many of them are still to be used this cycle.
      const total = {}, left = {};
      for (const s of live) {
        total[s.map] = (total[s.map] || 0) + 1;
        if (uses.get(s.key) === low) left[s.map] = (left[s.map] || 0) + 1;
      }
      const cap = Math.max(maxPerArea, Math.ceil(perGame / Object.keys(total).length));
      const rnd = mulberry32(hashStr('day-' + i));
      const picks = [], perMap = {};
      const tooClose = s => picks.some(p => p.map === s.map && distance(aspects[s.map] || 1, p.r, s.r) < minGap);
      const recent = s => lastDay.has(s.key) && i - lastDay.get(s.key) <= recentDays;
      // Rule levels, strictest first: [extra uses allowed, area limit, spacing, not recent].
      const levels = [[0, 1, 1, 1], [1, 1, 1, 1], [0, 1, 1, 0], [1, 1, 1, 0], [0, 1, 0, 0],
                      [Infinity, 1, 1, 0], [Infinity, 1, 0, 0], [0, 0, 0, 0], [Infinity, 0, 0, 0]];
      while (picks.length < perGame) {
        let cands = [];
        for (const [extra, capOn, gapOn, recentOn] of levels) {
          cands = live.filter(s => !picks.includes(s) && uses.get(s.key) <= low + extra &&
            !(capOn && (perMap[s.map] || 0) >= cap) && !(gapOn && tooClose(s)) && !(recentOn && recent(s)));
          if (cands.length) break;
        }
        // Prefer the least-used spots among the candidates.
        const best = Math.min(...cands.map(s => uses.get(s.key)));
        cands = cands.filter(s => uses.get(s.key) === best);
        // Pick the map with the biggest share of its spots still to use this cycle (random among near-ties),
        // then a random spot on it.
        const byMap = {};
        cands.forEach(s => (byMap[s.map] = byMap[s.map] || []).push(s));
        const share = m => (left[m] || 0) / total[m];
        const ms = Object.keys(byMap).sort();
        const top = Math.max(...ms.map(share));
        const near = ms.filter(m => share(m) >= top - 0.05);
        const m = near[Math.floor(rnd() * near.length)];
        const s = byMap[m][Math.floor(rnd() * byMap[m].length)];
        picks.push(s);
        perMap[s.map] = (perMap[s.map] || 0) + 1;
        if (uses.get(s.key) === low) left[s.map]--;
      }
      for (const s of picks) { uses.set(s.key, uses.get(s.key) + 1); lastDay.set(s.key, i); }
      days.push(spreadOrder(picks, rnd).map(s => s.r));
    }
    cache = { pool, perGame, firstDay, delay, opts, days };
    return days;
  }

  // The spots for puzzle index `day` (0 = puzzle #1).
  function dailyRounds(pool, day, perGame, firstDay, delay = 2, opts = null) {
    return schedule(pool, day, perGame, firstDay, delay, opts)[day];
  }

  const api = { distance, scoreFor, verdict, tier, mulberry32, hashStr, shuffle, todayKey, dayIndex, dailyRounds, mapsOn };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Logic = api;
})(typeof window !== 'undefined' ? window : globalThis);
