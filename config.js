// ---- Game settings: change these freely ----
window.CONFIG = {
  title: 'Valley Guessr',
  roundsPerGame: 5,        // spots in each day's puzzle
  firstDay: '2026-11-26',  // the date of puzzle #1 (year-month-day). Don't change it once people are playing.
  newSpotDelayDays: 2,     // new (or removed) spots only affect puzzles at least this many days after you add them
  // Each day's puzzle mixes areas: every round can be from any map listed in mapStart, so players have to
  // pick the right area as well as the right spot. A map is used from its date on, once it has spots.
  // To add a map later, list it with a date at least 2 days ahead, e.g. beach: '2026-12-20', so today's and
  // tomorrow's puzzles don't change. A map not listed is never used (its spots stay in rounds.js and the editor).
  mapStart: { pelican: '2026-11-26', forest: '2026-11-26', beach: '2026-11-26', mountain: '2026-11-26' },
  homeMap: 'pelican',      // every round starts on this map
  minOtherMaps: 2,         // at least this many rounds per puzzle come from maps other than homeMap
  roundSeconds: 180,       // time limit per round (180 = 3 minutes)
  maxScore: 5000,          // points for a perfect guess
  perfectRadius: 0.012,    // guesses this close count as a bullseye (fraction of the map's diagonal)
  falloff: 12,             // higher = points drop faster as you get farther away
  // Anonymous visitor and score counts on GoatCounter (goatcounter.com). Put your GoatCounter code here,
  // e.g. 'valleyguessr' if your dashboard is valleyguessr.goatcounter.com. Leave it '' to switch counting off.
  // Nothing is counted when the game is opened from your own computer.
  goatcounter: 'valleyguessr',
};

// ---- Difficulties ----
// px = width and height of the square cut out for that difficulty, in pixels of the original 8000 px Pelican Town
// map (about 3.85 of those per pixel of the game). Other maps use their `scale` so every area shows the same amount
// of the game: Medium is 100 px on Pelican Town = about 26 game pixels across = 26 px on the 1× maps.
// Smaller = harder. Change these any time: open index.html?edit=1, click "Download crops",
// and every round gets re-cut at the new sizes.
// The editor cuts every size, but players only ever see the one named in CONFIG.difficulty below.
window.DIFFICULTIES = [
  { id: 'easy',   name: 'Easy',   px: 200 },
  { id: 'medium', name: 'Medium', px: 100 },
  { id: 'hard',   name: 'Hard',   px: 50 },
];
window.CONFIG.difficulty = 'medium';

// ---- Maps ----
// width/height are the image's size in pixels. Each day's puzzle mixes the maps listed in mapStart above.
// In the editor, a picture button (using `thumb`) appears for every map without a "parent".
// scale = how zoomed-in the image is compared with Pelican Town (pelican-town.webp is about 3.85× the game's
// size; the others are 1×, so 1 / 3.85 = 0.26). The editor uses it so crops show the same amount of game everywhere.
//
// To make a building enterable, give its outdoor map a hotspot (a little door button),
// and add the interior as its own map with "parent" set to the outdoor map:
//
//   pelican: { ...,
//     hotspots: [ { x: 0.314, y: 0.455, label: "Pierre's", to: 'pierres' } ] },
//   pierres: { name: "Pierre's General Store", image: 'maps/pierres.webp',
//              width: 1200, height: 900, parent: 'pelican' },
//
// Tip: open index.html?edit=1 and click the map to get x / y values to paste in.
window.MAPS = {
  pelican: {
    name: 'Pelican Town',
    image: 'maps/pelican-town.webp',
    thumb: 'maps/thumbs/pelican.webp',  // small picture for the area button
    width: 8000,
    height: 6769,
    scale: 1,
    hotspots: [],
  },
  forest: {
    name: 'Cindersap Forest',
    image: 'maps/forest.webp',
    thumb: 'maps/thumbs/forest.webp',  // small picture for the area button
    width: 1920,
    height: 1920,
    scale: 0.26,
  },
  beach: {
    name: 'The Beach',
    image: 'maps/beach.webp',
    thumb: 'maps/thumbs/beach.webp',  // small picture for the area button
    width: 1664,
    height: 800,
    scale: 0.26,
  },
  mountain: {
    name: 'The Mountain',
    image: 'maps/mountain.webp',
    thumb: 'maps/thumbs/mountain.webp',  // small picture for the area button
    width: 2160,
    height: 656,
    scale: 0.26,
  },
};
