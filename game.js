(() => {
  'use strict';
  const CFG = window.CONFIG, MAPS = window.MAPS, POOL = window.ROUNDS || [], L = window.Logic;
  // Editor mode only works when the page is opened from your own computer,
  // so it stays switched off for anyone visiting the uploaded version.
  const LOCAL = location.protocol === 'file:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const EDIT = LOCAL && new URLSearchParams(location.search).has('edit');
  // Admin mode (?admin=1) has the same rule: it only switches on for a copy opened from your computer.
  const ADMIN = LOCAL && !EDIT && new URLSearchParams(location.search).has('admin');
  // GoatCounter: anonymous page views plus one score event per finished daily (see CONFIG.goatcounter).
  // No cookies and nothing personal; only on the uploaded site, never on your own computer.
  const GC = !LOCAL && CFG.goatcounter;
  if (GC) {
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://gc.zgo.at/count.js';
    s.dataset.goatcounter = 'https://' + CFG.goatcounter + '.goatcounter.com/count';
    document.head.appendChild(s);
  }
  // Sends e.g. "score/10000-12499" so the dashboard shows how many finished and how scores are spread.
  function countScore(score, max) {
    if (!GC) return;
    const step = max / 10, lo = Math.min(9, Math.floor(score / step)) * step;
    const path = 'score/' + Math.round(lo) + '-' + (Math.round(lo + step) - 1);
    const send = () => window.goatcounter && window.goatcounter.count &&
      window.goatcounter.count({ path, title: 'Finished with ' + path.slice(6) + ' points', event: true });
    if (window.goatcounter && window.goatcounter.count) send(); else setTimeout(send, 3000);
  }
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const aspect = k => MAPS[k].height / MAPS[k].width;
  const topMaps = Object.keys(MAPS).filter(k => !MAPS[k].parent);
  const fmtTime = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  // 180 -> "3 minutes", 90 -> "1 minute 30 seconds", 45 -> "45 seconds"
  const timeWords = s => {
    const m = Math.floor(s / 60), r = s % 60, p = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
    return [m && p(m, 'minute'), r && p(r, 'second')].filter(Boolean).join(' ');
  };
  const num = n => Number(n).toLocaleString();

  const viewer = new window.Viewer($('map'));
  document.title = CFG.title;
  $('title').textContent = CFG.title;

  // ---------------- state ----------------
  let currentMap = null;
  let phase = 'idle';            // idle | guess | result
  let rounds = [], idx = 0, total = 0, results = [], today = null, puzzleNo = 0;
  let guess = null, answer = null;
  let timerId = null, deadline = 0, countdownId = null;
  let screen = null;             // the card showing behind the stats/help popups (showStart, showFinal) or null mid-game
  let practice = null;           // admin test game: { name } (never saved), or null for the real daily
  let areaList = [];             // the area buttons players get this game (maps in play)
  const HOME = MAPS[CFG.homeMap] ? CFG.homeMap : topMaps[0];
  const OPTS = { mapStart: CFG.mapStart || null, maxPerArea: CFG.maxPerArea || 2, minGap: CFG.minSpotGap || 0,
    aspects: Object.fromEntries(Object.keys(MAPS).map(k => [k, MAPS[k].height / MAPS[k].width])) };
  const roundsFor = day => L.dailyRounds(POOL, day, CFG.roundsPerGame, CFG.firstDay || L.todayKey(), CFG.newSpotDelayDays, OPTS);
  // Area buttons for a day: every map switched on in CONFIG.mapStart by that day (and that has spots),
  // in the order they're listed in MAPS. Players always get the full set, whichever maps the day's spots are on.
  const areasFor = day => {
    const ms = CFG.mapStart, first = CFG.firstDay || L.todayKey();
    const on = k => !ms || (ms[k] != null && day >= L.dayIndex(first, ms[k]));
    return topMaps.filter(k => on(k) && POOL.some(r => r.map === k && !r.removed));
  };
  let difficulty = CFG.difficulty || 'medium';
  // Each round can have one picture per difficulty (images: {easy, medium, ...}) or a single `image`.
  const imageFor = r => (r.images && (r.images[difficulty] || Object.values(r.images)[0])) || r.image;

  // ---------------- today's progress ----------------
  // Kept only in the player's own browser (localStorage). Only the final score range goes to GoatCounter (countScore).
  // Shape: { day: 'YYYY-MM-DD', results: [{ pts, label }, ...] }
  const SAVE_KEY = 'valleyGuessrDaily';
  function loadToday() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (s && s.day === today && Array.isArray(s.results)) return s.results;
    } catch (e) {}
    return [];
  }
  function saveToday() {
    if (practice) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ day: today, results })); } catch (e) {}
  }

  // Finished dailies, for the stats screen: { 'YYYY-MM-DD': { n: puzzle number, score } }. Also only in this browser.
  const HIST_KEY = 'valleyGuessrHistory';
  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HIST_KEY)) || {}; } catch (e) { return {}; }
  }
  function recordToday() {
    const h = loadHistory();
    if (h[today]) return;
    h[today] = { n: puzzleNo, score: total };
    try { localStorage.setItem(HIST_KEY, JSON.stringify(h)); } catch (e) {}
    countScore(total, CFG.maxScore * rounds.length);
  }

  function setToday() {
    practice = null;
    today = L.todayKey();
    const day = L.dayIndex(CFG.firstDay || today, today);
    puzzleNo = day + 1;
    rounds = roundsFor(day);
    areaList = areasFor(day);
    results = loadToday().slice(0, rounds.length);
    idx = results.length;
    total = results.reduce((t, r) => t + r.pts, 0);
  }

  // ---------------- map display ----------------
  function showMap(k) {
    currentMap = k;
    viewer.setMap(MAPS[k].image, aspect(k));
    // Maps saved at the game's own size get blown up a lot, so keep their pixels crisp.
    viewer.img.style.imageRendering = (MAPS[k].scale || 1) < 1 ? 'pixelated' : '';
    drawMarkers();
    drawTabs();
    if (EDIT && window.Editor) window.Editor.mapChanged(k);
  }

  function drawTabs() {
    const tabs = $('tabs'), m = MAPS[currentMap];
    tabs.innerHTML = '';
    // Area picker: a row of picture tiles along the bottom of the map, one per area.
    // The editor gets every map; players get the maps in today's puzzle, while they're playing.
    const areas = $('areas');
    areas.innerHTML = '';
    const list = EDIT ? topMaps : (phase === 'idle' ? [] : areaList);
    if (list.length > 1) {
      for (const k of list) {
        const b = document.createElement('button');
        b.className = 'area' + ((k === currentMap || m.parent === k) ? ' on' : '');
        b.innerHTML = '<img src="' + esc(MAPS[k].thumb || MAPS[k].image) + '" alt=""><span>' + esc(MAPS[k].name) + '</span>';
        b.title = MAPS[k].name;
        b.onclick = () => showMap(k);
        areas.appendChild(b);
      }
    }
    const top = m.parent ? MAPS[m.parent] : m;
    const c = document.createElement('span');
    c.className = 'crumb'; c.textContent = top.name;
    tabs.appendChild(c);
    const back = $('back');
    if (m.parent) {
      back.hidden = false;
      back.textContent = '← Back outside';
      back.onclick = () => showMap(m.parent);
      const c = document.createElement('span');
      c.className = 'crumb'; c.textContent = m.name;
      tabs.appendChild(c);
    } else back.hidden = true;
  }

  function drawMarkers() {
    const marks = [], lines = [];
    for (const h of (MAPS[currentMap].hotspots || [])) {
      marks.push({ x: h.x, y: h.y, cls: 'door', title: 'Go inside: ' + h.label,
        html: '🚪<span>' + esc(h.label) + '</span>', onClick: () => showMap(h.to) });
    }
    if (EDIT && window.Editor) marks.push(...window.Editor.markers(currentMap));
    if (!EDIT && guess && guess.map === currentMap) marks.push({ ...guess, cls: 'guess', html: '?' });
    if (phase === 'result' && answer.map === currentMap) {
      marks.push({ x: answer.x, y: answer.y, cls: 'answer', html: '★' });
      if (guess && guess.map === currentMap) lines.push({ a: guess, b: answer });
    }
    viewer.setMarkers(marks);
    viewer.setLines(lines);
  }

  // ---------------- game flow ----------------
  function startGame() {
    screen = null;
    $('score').textContent = num(total);
    hideOverlay();
    if (idx < rounds.length) startRound(); else showFinal();
  }

  // Admin: play any list of spots without saving anything.
  function playPractice(list, name) {
    practice = { name };
    rounds = list.slice(); idx = 0; total = 0; results = [];
    // The same area buttons as today's daily, plus any other map these spots are on.
    const today = areasFor(L.dayIndex(CFG.firstDay || L.todayKey(), L.todayKey()));
    areaList = topMaps.filter(k => today.includes(k) || rounds.some(r => r.map === k));
    startGame();
  }

  function startRound() {
    phase = 'guess'; guess = null; answer = rounds[idx];
    $('round').textContent = (idx + 1) + '/' + rounds.length;
    $('shot').src = imageFor(answer);
    if (rounds[idx + 1]) new Image().src = imageFor(rounds[idx + 1]);
    $('result').hidden = true;
    const gb = $('guess-btn');
    gb.hidden = false; gb.disabled = true; gb.textContent = 'Click the map to guess';
    document.getElementById('app').classList.remove('shot-big');
    // Every round starts on the home map (Pelican Town), so where the map opens gives nothing away.
    showMap(areaList.length > 1 ? (areaList.includes(HOME) ? HOME : areaList[0]) : answer.map);
    deadline = Date.now() + CFG.roundSeconds * 1000;
    tick();
    timerId = setInterval(tick, 200);
  }

  function tick() {
    const left = Math.max(0, deadline - Date.now());
    const secs = Math.ceil(left / 1000);
    const frac = 'scaleX(' + (left / (CFG.roundSeconds * 1000)) + ')';
    $('shot-time').textContent = fmtTime(secs);
    $('shot-timer-bar').style.transform = frac;
    $('shot-timer').classList.toggle('warn', secs <= 30);
    $('shot-timer').classList.toggle('hurry', secs <= 10);
    $('app').classList.add('timing');
    if (left <= 0) endRound(true);
  }

  function endRound(timedOut) {
    if (phase !== 'guess') return;
    phase = 'result';
    clearInterval(timerId);
    $('app').classList.remove('timing');
    $('guess-btn').hidden = true;

    const sameMap = !!guess && guess.map === answer.map;
    let pts = 0, d = null;
    if (sameMap) { d = L.distance(aspect(answer.map), guess, answer); pts = L.scoreFor(CFG, d); }
    total += pts;
    results.push({ pts, label: answer.label || 'Round ' + (idx + 1) });
    saveToday();
    $('score').textContent = num(total);

    let title, detail;
    if (!guess) {
      title = "Time's up!"; detail = 'You didn\'t place a guess this round.';
    } else if (!sameMap) {
      title = 'Wrong area!';
      detail = 'You guessed in ' + esc(MAPS[guess.map].name) + ', but it was in ' + esc(MAPS[answer.map].name) + '.';
    } else {
      title = L.verdict(d, CFG);
      detail = d <= CFG.perfectRadius ? 'Right on the money.'
        : 'You were ' + Math.max(1, Math.round(d * 100)) + '% of the map\'s diagonal away.';
    }
    if (answer.label) detail += ' It was <b>' + esc(answer.label) + '</b>.';
    $('r-title').textContent = title;
    $('r-pts').textContent = '+' + num(pts);
    $('r-detail').innerHTML = detail;
    $('next').textContent = idx + 1 < rounds.length ? 'Next round →' : 'See final score';
    $('result').hidden = false;

    showMap(answer.map);
    if (sameMap) viewer.fitPoints([guess, answer], { pad: 0.6, maxScale: 2.5 });
  }

  function nextRound() {
    if (phase !== 'result') return;
    idx++;
    if (idx < rounds.length) startRound(); else showFinal();
  }

  function submitGuess() { if (phase === 'guess' && guess) endRound(false); }

  // ---------------- screens ----------------
  function showOverlay(html) { $('card').innerHTML = html; $('card').className = ''; $('overlay').hidden = false; }
  function hideOverlay() { $('overlay').hidden = true; }

  function showStart() {
    screen = showStart;
    phase = 'idle';
    $('round').textContent = '–';
    if (!POOL.length) {
      showOverlay('<h2>' + esc(CFG.title) + '</h2><p>No rounds yet! Add some screenshots to <b>rounds.js</b> (see the README).</p>');
      return;
    }
    setToday();
    drawTabs();
    if (idx >= rounds.length && !ADMIN) { showFinal(); return; }
    $('score').textContent = num(total);
    const started = idx > 0;
    showOverlay(
      '<h2>' + esc(CFG.title) + ' #' + puzzleNo + '</h2>' +
      '<p>Each day, you\'ll get ' + rounds.length + ' zoomed in screenshots from all over Stardew Valley. ' +
      'Pick the right area, then find where each one is on the map.</p>' +
      '<p><b>You have ' + timeWords(CFG.roundSeconds) + ' per screenshot.</b> If the timer runs out, that round scores 0.</p>' +
      '<p>The closer you are, the more points you\'ll get! (Up to ' + num(CFG.maxScore) + ' each.)</p>' +
      '<div class="row"><button id="play" class="btn big">' +
      (started ? 'Continue (round ' + (idx + 1) + '/' + rounds.length + ')' : 'Play today\'s puzzle') + '</button></div>' +
      '<p class="muted">Everyone gets the same screenshots today. A new puzzle comes out at midnight.</p>' +
      (ADMIN ? '<div id="admin-slot"></div>' : ''));
    $('play').onclick = startGame;
    if (ADMIN && window.Admin) window.Admin.menu($('admin-slot'));
  }

  function showFinal() {
    screen = showFinal;
    phase = 'idle';
    if (!practice) recordToday();
    drawTabs();
    $('round').textContent = '–';
    $('score').textContent = num(total);
    const max = CFG.maxScore * rounds.length;
    const squares = results.map(r => L.tier(r.pts, CFG)).join('');
    const name = practice ? practice.name : CFG.title + ' #' + puzzleNo;
    const share = name + '\n' + num(total) + ' / ' + num(max) + '\n' + squares;
    showOverlay(
      '<h2>' + esc(name) + '</h2><div class="big-score">' + num(total) + '</div>' +
      '<p class="muted">out of ' + num(max) + '</p><div>' + squares + '</div>' +
      '<ol>' + results.map(r => '<li><span>' + esc(r.label) + '</span><span>' + num(r.pts) + '</span></li>').join('') + '</ol>' +
      '<div class="row"><button id="copy" class="btn big">Copy score</button>' +
      (practice ? '' : '<button id="final-stats" class="btn big alt">Statistics</button>') +
      (ADMIN ? '<button id="admin-back" class="btn big alt">Admin menu</button>' : '') + '</div>' +
      (practice ? '<p class="muted">Admin test game: nothing was saved.</p>' : '<p class="muted" id="next-in"></p>'));
    if (ADMIN) $('admin-back').onclick = showStart;
    if (!practice) $('final-stats').onclick = showStats;
    $('copy').onclick = async () => {
      try { await navigator.clipboard.writeText(share); $('copy').textContent = 'Copied!'; }
      catch { window.prompt('Copy your score:', share); }
    };
    if (!practice) startCountdown();
  }

  // ---------------- stats & help popups ----------------
  function closePopup() { if (screen) screen(); else hideOverlay(); }

  function dayDiff(a, b) { return L.dayIndex(a, b); }   // whole days from a to b (b >= a)

  function showStats() {
    const h = loadHistory(), days = Object.keys(h).sort();
    const scores = days.map(d => h[d].score);
    const played = days.length;
    const avg = played ? Math.round(scores.reduce((a, b) => a + b, 0) / played) : 0;
    const best = played ? Math.max(...scores) : 0;
    // Streaks: days in a row with a finished puzzle. The current one survives until a whole day is missed.
    let maxStreak = 0, run = 0;
    days.forEach((d, i) => { run = i && dayDiff(days[i - 1], d) === 1 ? run + 1 : 1; maxStreak = Math.max(maxStreak, run); });
    const now = L.todayKey(), last = days[days.length - 1];
    const streak = last && (last === now || dayDiff(last, now) === 1) ? run : 0;
    // Score spread in five bands of a fifth of the max each.
    const max = CFG.maxScore * CFG.roundsPerGame, band = max / 5;
    const counts = [0, 0, 0, 0, 0];
    scores.forEach(s => counts[Math.min(4, Math.floor(s / band))]++);
    const top = Math.max(1, ...counts), mine = h[now] ? Math.min(4, Math.floor(h[now].score / band)) : -1;
    const tile = (v, label) => '<div class="tile"><b>' + v + '</b><small>' + label + '</small></div>';
    showOverlay(
      '<h2>Statistics</h2>' +
      '<div class="tiles">' + tile(played, 'Played') + tile(num(avg), 'Average') + tile(num(best), 'Best') +
      tile(streak, 'Current streak') + tile(maxStreak, 'Max streak') + '</div>' +
      '<h3>Scores</h3>' +
      (played ? '<div class="dist">' + counts.map((c, i) =>
        '<div class="bar-row"><span>' + (i ? num(i * band / 1000) + 'k' : '0') + '–' + num((i + 1) * band / 1000) + 'k</span>' +
        '<div class="bar' + (i === mine ? ' on' : '') + '" style="width:' + Math.max(8, c / top * 100) + '%">' + c + '</div></div>').reverse().join('') + '</div>'
        : '<p class="muted">Finish today\'s puzzle to start your stats.</p>') +
      '<div class="row"><button id="pop-close" class="btn big">Close</button></div>' +
      '<p class="muted privacy">Your progress and stats are saved only in this browser.' +
      (CFG.goatcounter ? ' We count visits and finished games (just the score range) with ' +
        '<a href="https://www.goatcounter.com" target="_blank" rel="noopener">GoatCounter</a>: ' +
        'no cookies and nothing that identifies you.' : '') + '</p>');
    $('pop-close').onclick = closePopup;
  }

  function showHelp() {
    showOverlay(
      '<h2>How to play</h2>' +
      '<ol class="help">' +
      '<li>Each day, you\'ll get a new selection of ' + CFG.roundsPerGame + ' zoomed in screenshots from all over Stardew Valley.</li>' +
      '<li>Find where each screenshot is on the map, click there, then press <b>Lock in guess</b>. Use + and − (or scroll) to zoom, and drag to move around.</li>' +
      '<li>Use the area buttons at the bottom of the map to switch areas. A guess in the wrong area scores 0.</li>' +
      '<li>You have ' + timeWords(CFG.roundSeconds) + ' per screenshot. The closer you are, the more points you\'ll get! (Up to ' + num(CFG.maxScore) + ' each.)</li>' +
      '<li>Click the screenshot to make it bigger.</li>' +
      '<li>A new puzzle comes out at midnight. Play every day to build your streak.</li>' +
      '</ol>' +
      '<p class="muted">🟩 great · 🟨 close · 🟧 far · 🟥 way off</p>' +
      '<div class="row"><button id="pop-close" class="btn big">Got it</button></div>' +
      '<p class="credit">Made by <a href="https://www.youtube.com/@Dallisaur" target="_blank" rel="noopener">Dallisaur</a></p>' +
      '<p class="fan-note">Valley Guessr is a fan-made game, made with love for ' +
      '<a href="https://www.stardewvalley.net" target="_blank" rel="noopener">Stardew Valley</a>. ' +
      'All maps and screenshots are from the game, which belongs to ConcernedApe. ' +
      'This site isn\'t affiliated with or endorsed by ConcernedApe. If you haven\'t played Stardew Valley yet, go play it! 🌱</p>');
    $('pop-close').onclick = closePopup;
  }

  // Counts down to local midnight, then offers the new puzzle.
  function startCountdown() {
    clearInterval(countdownId);
    const update = () => {
      const el = $('next-in');
      if (!el) { clearInterval(countdownId); return; }
      if (L.todayKey() !== today) {
        clearInterval(countdownId);
        el.innerHTML = '<button id="new-day" class="btn big">Play the new puzzle</button>';
        $('new-day').onclick = showStart;
        return;
      }
      const now = new Date(), midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const s = Math.max(0, Math.ceil((midnight - now) / 1000));
      el.textContent = 'Next puzzle in ' + Math.floor(s / 3600) + ':' +
        String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    };
    update();
    countdownId = setInterval(update, 1000);
  }

  // ---------------- input ----------------
  viewer.onClick(p => {
    if (EDIT || phase !== 'guess') return;
    guess = { map: currentMap, x: p.x, y: p.y };
    drawMarkers();
    const gb = $('guess-btn');
    gb.disabled = false; gb.textContent = 'Lock in guess';
  });
  $('guess-btn').onclick = submitGuess;
  $('stats-btn').onclick = showStats;
  $('help-btn').onclick = showHelp;
  $('next').onclick = nextRound;
  $('zin').onclick = () => viewer.zoomBy(1.6);
  $('zout').onclick = () => viewer.zoomBy(1 / 1.6);
  $('shot-wrap').onclick = () => document.getElementById('app').classList.toggle('shot-big');
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'Escape') document.getElementById('app').classList.remove('shot-big');
    if (e.key === 'Enter') { if (phase === 'guess') submitGuess(); else if (phase === 'result') nextRound(); }
  });

  // ---------------- go ----------------
  const app = { viewer, showMap, currentMap: () => currentMap, redraw: drawMarkers };
  if (EDIT) {
    document.body.classList.add('edit');
    showMap(topMaps[0]);
    const s = document.createElement('script');
    s.src = 'editor.js';
    s.onload = () => window.Editor.init(app);
    s.onerror = () => alert('editor.js is missing from the game folder.');
    document.head.appendChild(s);
  } else if (ADMIN) {
    document.body.classList.add('admin');
    showMap(topMaps[0]);
    const s = document.createElement('script');
    s.src = 'admin.js';
    s.onload = () => {
      window.Admin.init({
        pool: POOL, cfg: CFG, logic: L, esc, playPractice, showStart, showOverlay, roundsFor,
        imageFor: (r, d) => (r.images && (r.images[d] || Object.values(r.images)[0])) || r.image,
        get difficulty() { return difficulty; }, set difficulty(d) { difficulty = d; },
        resetToday() {
          // Also forget today's stats entry, so the replay is recorded instead of the first score.
          const h = loadHistory(); delete h[L.todayKey()];
          try { localStorage.removeItem(SAVE_KEY); localStorage.setItem(HIST_KEY, JSON.stringify(h)); } catch (e) {}
        },
        clearStats() { try { localStorage.removeItem(HIST_KEY); } catch (e) {} },
        quit() { clearInterval(timerId); $('app').classList.remove('timing'); phase = 'idle'; guess = null; $('result').hidden = true; showStart(); },
      });
      showStart();
    };
    s.onerror = () => { alert('admin.js is missing from the game folder.'); showStart(); };
    document.head.appendChild(s);
  } else {
    showMap(topMaps[0]);
    showStart();
  }

  // Handy for testing from the browser console.
  window.__game = { get state() { return { phase, idx, total, guess, answer, currentMap }; }, endRound, startGame };
})();
