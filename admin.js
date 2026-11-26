// Admin mode: open index.html?admin=1 from your own computer (it never switches on for the live site).
// Lets you replay the daily, play any day's puzzle or random spots, switch difficulty, and browse every spot.
// Nothing played here is saved, except "Play today's puzzle", which works exactly like it does for players.
window.Admin = (() => {
  let A;
  const $ = id => document.getElementById(id);
  const DIFFS = window.DIFFICULTIES || [];
  const DAY = 86400000;

  const todayIdx = () => A.logic.dayIndex(A.cfg.firstDay, A.logic.todayKey());
  // The calendar date of puzzle index i, as 'YYYY-MM-DD'.
  function dateOf(i) {
    const [y, m, d] = A.cfg.firstDay.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d) + i * DAY);
    return t.toISOString().slice(0, 10);
  }
  const roundsFor = i => A.roundsFor(i);

  function init(api) {
    A = api;
    const b = document.createElement('button');
    b.id = 'admin-quit'; b.className = 'btn small'; b.textContent = 'Admin menu';
    b.title = 'Stop this game and go back to the admin menu';
    b.onclick = () => A.quit();
    document.getElementById('hud').appendChild(b);
  }

  function menu(slot) {
    const t = todayIdx();
    slot.innerHTML =
      '<div class="admin-box">' +
      '<h3>Admin</h3>' +
      '<p class="muted">Only on your computer. Test games here are never saved.</p>' +
      '<div class="chips" id="adm-diff">' + DIFFS.map(d =>
        '<button class="chip' + (d.id === A.difficulty ? ' on' : '') + '" data-id="' + A.esc(d.id) + '">' + A.esc(d.name) + '</button>').join('') + '</div>' +
      '<div class="row">' +
      '<button id="adm-reset" class="btn small">Reset today\'s progress</button>' +
      '<button id="adm-stats" class="btn small">Clear my stats</button>' +
      '<button id="adm-free" class="btn small">Free play (' + A.cfg.roundsPerGame + ' random, any map)</button>' +
      '<button id="adm-all" class="btn small">View all spots</button>' +
      '<a class="btn small" href="index.html?edit=1">Open editor</a>' +
      '</div>' +
      '<div class="row adm-day">Puzzle # <input id="adm-n" type="number" min="1" value="' + (t + 1) + '">' +
      '<span id="adm-date" class="muted"></span>' +
      '<button id="adm-play" class="btn small">Play it</button></div>' +
      '<p id="adm-spots" class="muted"></p>' +
      '<p id="adm-msg" class="muted"></p>' +
      '</div>';

    slot.querySelectorAll('#adm-diff .chip').forEach(c => c.onclick = () => {
      A.difficulty = c.dataset.id;
      slot.querySelectorAll('#adm-diff .chip').forEach(x => x.classList.toggle('on', x === c));
    });
    $('adm-reset').onclick = () => { A.resetToday(); A.showStart(); $('adm-msg').textContent = 'Today\'s progress and today\'s stats entry cleared. You can play the daily again.'; };
    $('adm-stats').onclick = () => { A.clearStats(); A.showStart(); $('adm-msg').textContent = 'Stats cleared.'; };
    $('adm-free').onclick = () => A.playPractice(A.logic.shuffle(A.pool.filter(r => !r.removed), Math.random).slice(0, A.cfg.roundsPerGame), 'Free play');
    $('adm-all').onclick = gallery;
    const n = $('adm-n');
    const showDay = () => {
      const i = Math.max(0, (parseInt(n.value, 10) || 1) - 1);
      $('adm-date').textContent = dateOf(i) + (i === t ? ' (today)' : '');
      const rs = roundsFor(i);
      $('adm-spots').textContent = rs.map((r, k) => (r.label || 'Spot ' + (k + 1)) + ' (' + ((window.MAPS[r.map] || {}).name || r.map) + ')').join(', ');
    };
    n.oninput = showDay; showDay();
    $('adm-play').onclick = () => {
      const i = Math.max(0, (parseInt(n.value, 10) || 1) - 1);
      A.playPractice(roundsFor(i), A.cfg.title + ' #' + (i + 1) + ' (test)');
    };
  }

  function gallery() {
    // When each spot next comes up, looking ahead one full cycle from today.
    const t = todayIdx(), next = new Map();
    const live = A.pool.filter(r => !r.removed);
    const perCycle = Math.max(1, Math.floor(live.length / A.cfg.roundsPerGame));
    for (let i = t; i < t + perCycle; i++) for (const r of roundsFor(i)) if (!next.has(r)) next.set(r, i);

    A.showOverlay(
      '<h2>All spots (' + live.length + ')</h2>' +
      '<p class="muted">Showing the ' + A.esc((DIFFS.find(d => d.id === A.difficulty) || {}).name || A.difficulty) +
      ' crop. Click a picture to play just that spot.</p>' +
      '<div class="row"><button id="adm-back" class="btn small">← Back</button></div>' +
      '<div class="adm-grid">' + A.pool.map((r, k) => {
        const i = next.get(r);
        return '<figure data-k="' + k + '"><img loading="lazy" src="' + A.esc(A.imageFor(r, A.difficulty)) + '" alt="">' +
          '<figcaption><b>' + A.esc(r.label || 'Spot ' + (k + 1)) + '</b><br><span class="muted">' +
          A.esc((window.MAPS[r.map] || {}).name || r.map) + '<br>' +
          (r.removed ? 'removed ' + r.removed : i === undefined ? 'not in the next ' + perCycle + ' days' : '#' + (i + 1) + ' · ' + dateOf(i) + (i === t ? ' (today)' : '')) +
          (r.added && !r.removed ? '<br>added ' + r.added : '') +
          '</span></figcaption></figure>';
      }).join('') + '</div>');
    document.getElementById('card').classList.add('wide');
    $('adm-back').onclick = A.showStart;
    document.querySelectorAll('.adm-grid figure').forEach(f => f.onclick = () => {
      const r = A.pool[+f.dataset.k];
      A.playPractice([r], r.label || 'Spot ' + (+f.dataset.k + 1));
    });
  }

  return { init, menu };
})();
