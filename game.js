(() => {
  'use strict';
  const CFG = window.CONFIG, MAPS = window.MAPS, POOL = window.ROUNDS || [], L = window.Logic;
  // Editor mode only works when the page is opened from your own computer,
  // so it stays switched off for anyone visiting the uploaded version.
  const LOCAL = location.protocol === 'file:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const EDIT = LOCAL && new URLSearchParams(location.search).has('edit');
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const aspect = k => MAPS[k].height / MAPS[k].width;
  const topMaps = Object.keys(MAPS).filter(k => !MAPS[k].parent);
  const fmtTime = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  const num = n => Number(n).toLocaleString();

  const viewer = new window.Viewer($('map'));
  document.title = CFG.title;
  $('title').textContent = CFG.title;

  // ---------------- state ----------------
  let currentMap = null;
  let phase = 'idle';            // idle | guess | result
  let rounds = [], idx = 0, total = 0, results = [], daily = null;
  let guess = null, answer = null;
  let timerId = null, deadline = 0;
  const DIFFS = window.DIFFICULTIES || [];
  let difficulty = CFG.defaultDifficulty || (DIFFS[0] && DIFFS[0].id);
  try { const saved = localStorage.getItem('stardewGuessrDifficulty'); if (DIFFS.some(d => d.id === saved)) difficulty = saved; } catch (e) {}
  const diffName = () => (DIFFS.find(d => d.id === difficulty) || {}).name || '';
  // Each round can have one picture per difficulty (images: {easy, medium, ...}) or a single `image`.
  const imageFor = r => (r.images && (r.images[difficulty] || Object.values(r.images)[0])) || r.image;

  // ---------------- map display ----------------
  function showMap(k) {
    currentMap = k;
    viewer.setMap(MAPS[k].image, aspect(k));
    drawMarkers();
    drawTabs();
    if (EDIT && window.Editor) window.Editor.mapChanged(k);
  }

  function drawTabs() {
    const tabs = $('tabs'), m = MAPS[currentMap];
    tabs.innerHTML = '';
    if (topMaps.length > 1) {
      for (const k of topMaps) {
        const b = document.createElement('button');
        b.textContent = MAPS[k].name;
        b.className = (k === currentMap || m.parent === k) ? 'on' : '';
        b.onclick = () => showMap(k);
        tabs.appendChild(b);
      }
    } else {
      const c = document.createElement('span');
      c.className = 'crumb'; c.textContent = MAPS[topMaps[0]].name;
      tabs.appendChild(c);
    }
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
  function startGame(isDaily) {
    daily = isDaily ? L.todayKey() : null;
    const rnd = isDaily ? L.mulberry32(L.hashStr(daily)) : Math.random;
    rounds = L.shuffle(POOL, rnd).slice(0, CFG.roundsPerGame);
    idx = 0; total = 0; results = [];
    $('score').textContent = '0';
    hideOverlay();
    startRound();
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
    showMap(topMaps[0]);
    deadline = Date.now() + CFG.roundSeconds * 1000;
    tick();
    timerId = setInterval(tick, 200);
  }

  function tick() {
    const left = Math.max(0, deadline - Date.now());
    const secs = Math.ceil(left / 1000);
    $('time').textContent = fmtTime(secs);
    $('timer-bar').style.transform = 'scaleX(' + (left / (CFG.roundSeconds * 1000)) + ')';
    $('hud').classList.toggle('warn', secs <= 30);
    if (left <= 0) endRound(true);
  }

  function endRound(timedOut) {
    if (phase !== 'guess') return;
    phase = 'result';
    clearInterval(timerId);
    $('guess-btn').hidden = true;

    const sameMap = !!guess && guess.map === answer.map;
    let pts = 0, d = null;
    if (sameMap) { d = L.distance(aspect(answer.map), guess, answer); pts = L.scoreFor(CFG, d); }
    total += pts;
    results.push({ pts, label: answer.label || 'Round ' + (idx + 1) });
    $('score').textContent = num(total);

    let title, detail;
    if (!guess) {
      title = "Time's up!"; detail = 'You didn\'t place a guess this round.';
    } else if (!sameMap) {
      title = 'Wrong spot!';
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
  function showOverlay(html) { $('card').innerHTML = html; $('overlay').hidden = false; }
  function hideOverlay() { $('overlay').hidden = true; }

  function showStart() {
    phase = 'idle';
    $('time').textContent = '–'; $('round').textContent = '–';
    $('timer-bar').style.transform = 'scaleX(0)'; $('hud').classList.remove('warn');
    if (!POOL.length) {
      showOverlay('<h2>' + esc(CFG.title) + '</h2><p>No rounds yet! Add some screenshots to <b>rounds.js</b> (see the README).</p>');
      return;
    }
    const n = Math.min(CFG.roundsPerGame, POOL.length);
    showOverlay(
      '<h2>' + esc(CFG.title) + '</h2>' +
      '<p>You\'ll see ' + n + ' pictures from Stardew Valley. Find where each one is on the map before the ' +
      fmtTime(CFG.roundSeconds) + ' timer runs out.</p>' +
      '<p>The closer your guess, the more points you get (up to ' + num(CFG.maxScore) + ' per round).</p>' +
      (DIFFS.length ? '<div class="chips" id="chips">' + DIFFS.map(d =>
        '<button class="chip' + (d.id === difficulty ? ' on' : '') + '" data-id="' + esc(d.id) + '">' + esc(d.name) + '</button>').join('') + '</div>' : '') +
      '<div class="row"><button id="play" class="btn big">Play</button>' +
      '<button id="daily" class="btn big alt">Daily challenge</button></div>' +
      '<p class="muted">Daily challenge: everyone gets the same spots today.</p>');
    document.querySelectorAll('#chips .chip').forEach(b => b.onclick = () => {
      difficulty = b.dataset.id;
      try { localStorage.setItem('stardewGuessrDifficulty', difficulty); } catch (e) {}
      document.querySelectorAll('#chips .chip').forEach(x => x.classList.toggle('on', x === b));
    });
    $('play').onclick = () => startGame(false);
    $('daily').onclick = () => startGame(true);
  }

  function showFinal() {
    phase = 'idle';
    const max = CFG.maxScore * rounds.length;
    const squares = results.map(r => L.tier(r.pts, CFG)).join('');
    const share = CFG.title + (diffName() ? ' (' + diffName() + ')' : '') + (daily ? ' – Daily ' + daily : '') +
      '\n' + num(total) + ' / ' + num(max) + '\n' + squares;
    showOverlay(
      '<h2>All done!</h2><div class="big-score">' + num(total) + '</div>' +
      '<p class="muted">out of ' + num(max) + '</p><div>' + squares + '</div>' +
      '<ol>' + results.map(r => '<li><span>' + esc(r.label) + '</span><span>' + num(r.pts) + '</span></li>').join('') + '</ol>' +
      '<div class="row"><button id="again" class="btn big">Play again</button>' +
      '<button id="copy" class="btn big alt">Copy score</button></div>');
    $('again').onclick = showStart;
    $('copy').onclick = async () => {
      try { await navigator.clipboard.writeText(share); $('copy').textContent = 'Copied!'; }
      catch { window.prompt('Copy your score:', share); }
    };
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
  } else {
    showMap(topMaps[0]);
    showStart();
  }

  // Handy for testing from the browser console.
  window.__game = { get state() { return { phase, idx, total, guess, answer, currentMap }; }, endRound, startGame };
})();
