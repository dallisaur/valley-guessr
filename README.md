# Valley Guessr

A GeoGuessr-style guessing game for Stardew Valley. You're shown a small crop of the map and have to click where in
the valley it is. The closer you are, the more points you get.

Plain HTML and JavaScript: no installs, no server, no build step.

## Playing

Double-click `index.html` to play in your browser.

Each game is 5 random rounds with a 3 minute timer per round. There are three difficulties (the smaller the crop,
the harder it is), and a **Daily challenge** that gives everyone the same rounds on the same day.

## What's in the folder

| File / folder        | What it's for                                                              |
| -------------------- | -------------------------------------------------------------------------- |
| `index.html`         | The page you open to play.                                                 |
| `config.js`          | Settings: title, rounds per game, timer, scoring, difficulties, and maps.  |
| `rounds.js`          | Every spot in the game. Made by the editor, so you don't edit it by hand.  |
| `game.js`            | The game itself: rounds, timer, scoring screen, sharing.                   |
| `viewer.js`          | The zoomable, draggable map.                                               |
| `logic.js`           | Scoring math and the daily-challenge randomizer.                           |
| `editor.js`          | The spot editor (only works on your own computer).                         |
| `style.css`          | How everything looks.                                                      |
| `maps/`              | The map images players click on.                                           |
| `screenshots/`       | The cropped images shown each round, one per spot per difficulty.          |

## Adding new spots

1. Open `index.html` in your browser, click the address bar, add `?edit=1` to the very end, and press Enter.
2. Click **Choose file** and pick your original full-size map image (the big one, 8000 px wide).
3. Click the map wherever you want a new spot. Type a name if you like, then press Enter.
4. Click **Download crops (.zip)**.
5. Open the zip and drag everything inside (the `screenshots` folder and `rounds.js`) into the game folder.
   Replace when asked.

Each spot is cut out at every difficulty size at once, and the exact location is saved with it.
The editor starts with all your existing spots, so each download contains everything, old and new.
To remove a spot, click the × next to it before downloading.

When you replace the `screenshots` folder, delete the old one first so no leftover images pile up.

## Changing the difficulty sizes

Open `config.js` and change the `px` numbers under `DIFFICULTIES` (smaller = harder). You can add or rename
difficulties too. Then open the editor and download the zip again, and every spot is re-cut at the new sizes.

## Adding more maps and building interiors

`config.js` explains how to add Cindersap Forest, the Beach, and other areas (each gets a tab automatically), and how
to make buildings enterable with a door button. The editor has a "Door button helper" for finding door positions.
In the editor, pick the full-size image for each map (switch tabs to do each one).

## Saving your changes (git)

This folder is a git repository, so every change you save is kept in its history. After you change something:

```sh
git add -A
git commit -m "Describe what you changed"
git push
```

## Putting it online

The game is hosted for free with **GitHub Pages**. Every time you push, the live site updates within a minute or two.
If you buy a domain later, you can point it at GitHub Pages in the repo's **Settings → Pages**.

Editor mode only works when `index.html` is opened from your own computer, so visitors can't use it.

It can also be uploaded to itch.io as an HTML5 project (zip the folder and upload it).

## Credits

Stardew Valley, its map, and its artwork belong to ConcernedApe. This is a free, non-commercial fan project and isn't
affiliated with ConcernedApe.
