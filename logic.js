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
  // area as well as the right spot. Every map keeps its own deck of spots, and puzzles are dealt one day at a time
  // from puzzle #1. A deck is reshuffled only when it runs out, so no spot repeats until all of that map's spots
  // have been used.
  // A spot with `added: 'YYYY-MM-DD'` joins its deck `delay` days after that date, and one with `removed` leaves it
  // `delay` days after. Because each day only depends on the days before it, adding or removing spots never changes
  // a puzzle dated earlier than that.
  // opts = { mapStart: { mapKey: 'YYYY-MM-DD' }, homeMap: 'pelican', minOther: 2 }
  //  - mapStart switches maps on: a map not listed is never used, and a listed map only from its date on.
  //    Leave it out (null) and every map is on.
  //  - At least minOther rounds come from maps other than homeMap (when there are enough of their spots live).
  //    The other rounds are drawn in proportion to how many live spots each map has, then the order is shuffled.
  const spotKey = r => r.map + ':' + Number(r.x).toFixed(5) + ':' + Number(r.y).toFixed(5);
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

  function schedule(pool, upTo, perGame, firstDay, delay, opts) {
    const c = cache;
    if (c && c.pool === pool && c.perGame === perGame && c.firstDay === firstDay && c.delay === delay &&
        c.opts === opts && c.days.length > upTo) return c.days;
    const { mapStart = null, homeMap = null, minOther = 0 } = opts || {};
    upTo += 30;   // work a month ahead, so asking for the next few days doesn't start over each time
    const byKey = (a, b) => spotKey(a) < spotKey(b) ? -1 : spotKey(a) > spotKey(b) ? 1 : 0;
    const maps = [...new Set(pool.map(r => r.map))].sort();
    const known = new Set(), decks = {}, days = [];
    maps.forEach(m => { decks[m] = []; });
    for (let i = 0; i <= upTo; i++) {
      const availAll = pool.filter(r => isLive(r, i, firstDay, delay)).sort(byKey);
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
      const onMaps = mapsOn(pool, i, firstDay, delay, mapStart);
      const taken = new Set();
      const left = m => avail[m].filter(r => !taken.has(spotKey(r))).length;
      if (onMaps.reduce((a, m) => a + left(m), 0) < perGame) { days.push([]); continue; }

      // Takes the next spot off map m's deck that isn't already in today's puzzle; reshuffles the deck when it runs out.
      const draw = m => {
        let k = decks[m].findIndex(r => !taken.has(spotKey(r)));
        if (k < 0) {
          const inDeck = new Set(decks[m].map(spotKey));
          decks[m] = decks[m].concat(shuffle(avail[m].filter(r => !inDeck.has(spotKey(r))), mulberry32(hashStr('cycle-' + i + '-' + m))));
          k = decks[m].findIndex(r => !taken.has(spotKey(r)));
        }
        const r = decks[m].splice(k, 1)[0];
        taken.add(spotKey(r));
        return r;
      };
      // Picks a map that still has spots for today, weighted by how many it has.
      const rnd = mulberry32(hashStr('map-' + i));
      const pickMap = list => {
        const ok = list.filter(m => left(m) > 0);
        let t = rnd() * ok.reduce((a, m) => a + left(m), 0);
        return ok.find(m => (t -= left(m)) < 0) || ok[ok.length - 1];
      };
      const others = onMaps.filter(m => m !== homeMap);
      const picks = [];
      for (let k = 0; k < minOther && others.some(m => left(m) > 0); k++) picks.push(draw(pickMap(others)));
      while (picks.length < perGame) picks.push(draw(pickMap(onMaps)));
      days.push(shuffle(picks, mulberry32(hashStr('order-' + i))));
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
