// ---- Game settings: change these freely ----
window.CONFIG = {
  title: 'Valley Guessr',
  roundsPerGame: 5,        // rounds picked at random from rounds.js
  roundSeconds: 180,       // time limit per round (180 = 3 minutes)
  maxScore: 5000,          // points for a perfect guess
  perfectRadius: 0.012,    // guesses this close count as a bullseye (fraction of the map's diagonal)
  falloff: 12,             // higher = points drop faster as you get farther away
};

// ---- Difficulties ----
// px = width and height of the square cut out of the full-size map for that difficulty.
// Smaller = harder. Change these any time: open index.html?edit=1, click "Download crops",
// and every round gets re-cut at the new sizes.
window.DIFFICULTIES = [
  { id: 'easy',   name: 'Easy',   px: 100 },
  { id: 'medium', name: 'Medium', px: 50 },
  { id: 'hard',   name: 'Hard',   px: 25 },
];
window.CONFIG.defaultDifficulty = 'medium';

// ---- Maps ----
// width/height only matter for the shape (aspect ratio) of the image.
// To add another area (Cindersap Forest, Beach, Mountain...), drop its image in maps/
// and add an entry here. Tabs appear automatically for every map without a "parent".
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
    width: 8000,
    height: 6769,
    hotspots: [],
  },
};
