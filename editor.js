// Editor mode: click spots on the map, and it cuts the tiny images for you.
// Only loaded when index.html is opened from your own computer with ?edit=1.
// You can leave this file out when you upload the game to the internet.
(() => {
  'use strict';
  const MAPS = window.MAPS, DIFFS = window.DIFFICULTIES || [];
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let api = null;
  let rounds = [];          // [{map, x, y, label, added?, removed?, saved?}]
  const today = () => window.Logic.todayKey();
  // Spots already in rounds.js are never deleted, only marked removed, so past daily puzzles stay the same.
  const shown = () => rounds.filter(r => !r.removed);
  // The list on the right only shows spots on the map that's open.
  const here = () => shown().filter(r => r.map === api.currentMap());
  const sources = {};       // mapKey -> { bitmap, w, h }
  let lastClick = null;

  // ---------- minimal .zip writer (no compression; the crops are tiny anyway) ----------
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function makeZip(files) {
    const enc = new TextEncoder(), parts = [], central = [];
    const d = new Date();
    const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, size, true); lh.setUint32(22, size, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, f.data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, size, true); ch.setUint32(24, size, true); ch.setUint16(28, name.length, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + size;
    }
    const cdSize = central.reduce((a, c) => a + c.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
  }

  // ---------- UI ----------
  function msg(text, bad) { const m = $('ed-msg'); m.textContent = text; m.className = bad ? 'bad' : 'muted'; }

  function render() {
    const ol = $('ed-list');
    ol.innerHTML = '';
    here().forEach((r, i) => {
      const li = document.createElement('li');
      li.innerHTML = '<button class="n" title="Show on map">' + (i + 1) + '</button>' +
        '<input class="lbl" placeholder="name (optional)" value="' + esc(r.label) + '">' +
        '<button class="x" title="Remove this spot">×</button>';
      li.querySelector('.n').onclick = () => { api.showMap(r.map); api.viewer.fitPoints([r], { pad: 1, maxScale: 2 }); };
      li.querySelector('.lbl').oninput = e => { r.label = e.target.value; };
      li.querySelector('.lbl').onkeydown = e => { if (e.key === 'Enter') e.target.blur(); };
      li.querySelector('.x').onclick = () => {
        if (r.saved) r.removed = today(); else rounds.splice(rounds.indexOf(r), 1);
        render(); api.redraw();
      };
      ol.appendChild(li);
    });
    const n = here().length, all = shown().length;
    $('ed-count').textContent = n + (n === 1 ? ' spot' : ' spots') + ' here · ' + all + ' total';
    $('ed-dl').disabled = !all;
  }

  function onClick(p) {
    const map = api.currentMap();
    lastClick = { map, x: p.x, y: p.y };
    rounds.push({ map, x: p.x, y: p.y, label: '', added: today() });
    render(); api.redraw(); updateLast();
    const inputs = $('ed-list').querySelectorAll('.lbl');
    const last = inputs[inputs.length - 1];
    if (last) { last.focus({ preventScroll: true }); last.scrollIntoView({ block: 'nearest' }); }
  }

  function updateLast() {
    if (!lastClick) return;
    const f = v => v.toFixed(4);
    $('ed-last').textContent = '{ x: ' + f(lastClick.x) + ', y: ' + f(lastClick.y) + ", label: 'Building', to: 'map-id' },";
  }

  async function pickSource(file, map = api.currentMap(), quiet = false) {
    const m = MAPS[map];
    if (!file) return;
    try {
      const bitmap = await createImageBitmap(file);
      const shape = bitmap.width / bitmap.height, want = m.width / m.height;
      if (Math.abs(shape - want) / want > 0.01) {
        msg('That image is ' + bitmap.width + '×' + bitmap.height + ', which is a different shape from ' + m.name + '. Pick the original full-size map.', true);
        return;
      }
      sources[map] = { bitmap, w: bitmap.width, h: bitmap.height };
      if (map === api.currentMap()) mapChanged(map);
      if (!quiet) msg('Ready. Click the map to add spots.');
    } catch (e) { if (!quiet) msg('Couldn\'t open that image: ' + e.message, true); }
  }

  // When the game runs from a local server (e.g. VS Code's Live Server), the map images in maps/ can be
  // loaded automatically. Opened as a plain file, the browser blocks this, so you pick them by hand instead.
  // Only images that are already full size (as wide as config.js says) are used; Pelican Town's game image is a
  // smaller copy, so for new Pelican Town spots you still pick the original 8000 px map.
  async function autoLoad() {
    for (const k of Object.keys(MAPS)) {
      try {
        const r = await fetch(MAPS[k].image);
        if (!r.ok) continue;
        const blob = await r.blob(), bmp = await createImageBitmap(blob);
        if (bmp.width === MAPS[k].width) await pickSource(blob, k, true);
      } catch (e) {}
    }
  }

  function mapChanged(map) {
    $('ed-mapname').textContent = MAPS[map].name;
    const s = sources[map];
    $('ed-srcinfo').textContent = s ? 'Loaded ✓ (' + s.w + '×' + s.h + ')' : 'Not chosen yet';
    const sc = MAPS[map].scale || 1;
    $('ed-sizes').textContent = DIFFS.map(d => d.name + ' ' + Math.max(1, Math.round(d.px * sc)) + 'px').join(' · ');
    if (api) render();
  }

  // ---------- cutting the crops ----------
  const toBytes = canvas => new Promise((res, rej) =>
    canvas.toBlob(b => b ? b.arrayBuffer().then(a => res(new Uint8Array(a))) : rej(new Error('crop failed')), 'image/png'));

  async function download() {
    // Spots on a map whose full-size image isn't loaded keep their existing pictures; new spots need it.
    const missing = [...new Set(rounds.filter(r => !sources[r.map] && !r.images).map(r => r.map))].map(k => MAPS[k].name);
    if (missing.length) { msg('First choose the full-size map image for: ' + missing.join(', ') + ' (switch tabs to pick each one).', true); return; }
    $('ed-dl').disabled = true; msg('Cutting crops…');
    try {
      const files = [], lines = [];
      for (const r of rounds) {
        const src = sources[r.map];
        const key = r.map + '-' + Math.round(r.x * 10000) + '-' + Math.round(r.y * 10000);
        // Crop sizes are in Pelican Town pixels; `scale` shrinks them on maps saved at a smaller zoom,
        // so every area shows the same amount of the game.
        const scale = (MAPS[r.map].scale || 1) * (src ? src.w / MAPS[r.map].width : 1);
        const images = src ? {} : r.images;
        for (const d of src ? DIFFS : []) {
          const n = Math.max(1, Math.min(Math.round(d.px * scale), src.w, src.h));
          const left = Math.min(src.w - n, Math.max(0, Math.round(r.x * src.w - n / 2)));
          const top = Math.min(src.h - n, Math.max(0, Math.round(r.y * src.h - n / 2)));
          const c = document.createElement('canvas'); c.width = c.height = n;
          const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
          ctx.drawImage(src.bitmap, left, top, n, n, 0, 0, n, n);
          // Each map's pictures live in their own folder (screenshots/forest/...). A spot that already has
          // pictures keeps its file names, so re-cutting never moves or duplicates anything.
          const name = (r.images && r.images[d.id]) || 'screenshots/' + r.map + '/' + key + '-' + d.id + '.png';
          files.push({ name, data: await toBytes(c) });
          images[d.id] = name;
        }
        lines.push('  { map: ' + JSON.stringify(r.map) + ', x: ' + r.x.toFixed(5) + ', y: ' + r.y.toFixed(5) +
          (r.label.trim() ? ', label: ' + JSON.stringify(r.label.trim()) : '') +
          (r.added ? ', added: ' + JSON.stringify(r.added) : '') +
          (r.removed ? ', removed: ' + JSON.stringify(r.removed) : '') +
          ', images: ' + JSON.stringify(images) + ' },');
      }
      const js = '// Your rounds. Made by the editor (index.html?edit=1): click spots on the map, then download.\n' +
        '// x and y are fractions of the map (0 = left/top, 1 = right/bottom). Names are optional.\n' +
        '// added / removed are the dates a spot was added or taken out, so the daily schedule only changes for future days.\n' +
        'window.ROUNDS = [\n' + lines.join('\n') + '\n];\n';
      files.push({ name: 'rounds.js', data: new TextEncoder().encode(js) });
      const blob = makeZip(files);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'new-rounds.zip';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      msg('Downloaded new-rounds.zip with ' + shown().length + ' spots. Open it and drag everything inside into your game folder (replace when asked).');
    } catch (e) { msg('Something went wrong: ' + e.message, true); }
    $('ed-dl').disabled = !shown().length;
  }

  // ---------- hooks used by game.js ----------
  window.Editor = {
    init(a) {
      api = a;
      rounds = (window.ROUNDS || []).map(r => ({ map: r.map, x: r.x, y: r.y, label: r.label || '',
        added: r.added, removed: r.removed, images: r.images, saved: true }));
      $('ed-src').onchange = e => pickSource(e.target.files[0]);
      $('ed-dl').onclick = download;
      $('editor').hidden = false;
      api.viewer.onClick(onClick);
      render(); mapChanged(api.currentMap()); api.redraw();
      msg('Start by choosing your full-size map image above.');
      autoLoad().then(() => { mapChanged(api.currentMap()); if (sources[api.currentMap()]) msg('Map images loaded. Click the map to add spots.'); });
    },
    mapChanged,
    markers(map) {
      return shown().filter(r => r.map === map).map((r, i) => ({ ...r, i }))
        .map(r => ({ x: r.x, y: r.y, cls: 'edit', html: String(r.i + 1) }));
    },
  };
})();
