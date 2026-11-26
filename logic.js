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
  // Each day's puzzle uses one map. Every map has its own deck of spots, and puzzles are dealt one day at a time
  // from puzzle #1: the day's map is picked, then the next perGame spots come off that map's deck. A deck is
  // reshuffled only when it runs low, so no spot repeats until all of that map's spots have been used.
  // A spot with `added: 'YYYY-MM-DD'` joins its deck `delay` days after that date, and one with `removed` leaves it
  // `delay` days after. Because each day only depends on the days before it, adding or removing spots never changes
  // a puzzle dated earlier than that.
  // Which map a day uses: any map with at least perGame live spots can be picked, more often the higher its
  // `weight` (weights = { mapKey: number }, default 1). Changing weights changes the map of every day after
  // puzzle #1, so only add a weight for a map before its spots go live.
  // mapStart = { mapKey: 'YYYY-MM-DD' } switches maps on: a map not listed is never picked, and a listed map
  // can only be picked from its date on. Leave it out (null) and every map is on.
  const spotKey = r => r.map + ':' + Number(r.x).toFixed(5) + ':' + Number(r.y).toFixed(5);
  let cache = null;

  function schedule(pool, upTo, perGame, firstDay, delay, weights, mapStart) {
    if (cache && cache.pool === pool && cache.perGame === perGame && cache.firstDay === firstDay &&
        cache.delay === delay && cache.weights === weights && cache.mapStart === mapStart && cache.days.length > upTo) return cache.days;
    const from = r => r.added ? dayIndex(firstDay, r.added) + delay : 0;
    const until = r => r.removed ? dayIndex(firstDay, r.removed) + delay : Infinity;
    const byKey = (a, b) => spotKey(a) < spotKey(b) ? -1 : spotKey(a) > spotKey(b) ? 1 : 0;
    const maps = [...new Set(pool.map(r => r.map))].sort();
    const known = new Set(), decks = {}, days = [];
    maps.forEach(m => { decks[m] = []; });
    for (let i = 0; i <= upTo; i++) {
      const availAll = pool.filter(r => from(r) <= i && i < until(r)).sort(byKey);
      const avail = {};
      for (const m of maps) {
        avail[m] = availAll.filter(r => r.map === m);
        const live = new Set(avail[m].map(spotKey));
        decks[m] = decks[m].filter(r => live.has(spotKey(r)));
      }
      // New spots are shuffled into their map's deck (one shuffle for everything new that day).
      const fresh = availAll.filter(r => !known.has(spotKey(r)));
      if (fresh.length) {
        fresh.forEach(r => known.add(spotKey(r)));
        const rnd = mulberry32(hashStr('add-' + i));
        for (const m of maps) {
          const f = fresh.filter(r => r.map === m);
          if (f.length) decks[m] = shuffle(decks[m].concat(f), rnd);
        }
      }
      // Pick today's map. With only one playable map there's no random draw, so a single-map
      // schedule is dealt exactly as before maps were added.
      const isOn = m => !mapStart || (mapStart[m] != null && i >= dayIndex(firstDay, mapStart[m]));
      const playable = maps.filter(m => isOn(m) && avail[m].length >= perGame);
      let map = playable[0];
      if (playable.length > 1) {
        const w = m => (weights && weights[m] != null) ? weights[m] : 1;
        let t = mulberry32(hashStr('map-' + i))() * playable.reduce((a, m) => a + w(m), 0);
        map = playable.find(m => (t -= w(m)) < 0) || playable[playable.length - 1];
      }
      if (!map) { days.push([]); continue; }
      let deck = decks[map];
      if (deck.length < perGame) {
        const inDeck = new Set(deck.map(spotKey));
        deck = deck.concat(shuffle(avail[map].filter(r => !inDeck.has(spotKey(r))), mulberry32(hashStr('cycle-' + i))));
      }
      days.push(deck.splice(0, perGame));
      decks[map] = deck;
    }
    cache = { pool, perGame, firstDay, delay, weights, mapStart, days };
    return days;
  }

  // The spots for puzzle index `day` (0 = puzzle #1).
  function dailyRounds(pool, day, perGame, firstDay, delay = 2, weights = null, mapStart = null) {
    return schedule(pool, day, perGame, firstDay, delay, weights, mapStart)[day];
  }

  const api = { distance, scoreFor, verdict, tier, mulberry32, hashStr, shuffle, todayKey, dayIndex, dailyRounds };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Logic = api;
})(typeof window !== 'undefined' ? window : globalThis);
