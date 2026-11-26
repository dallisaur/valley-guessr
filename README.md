# Valley Guessr

A GeoGuessr-style guessing game for Stardew Valley. You're shown a small crop of the map and have to click where in
the valley it is. The closer you are, the more points you get.

Plain HTML and JavaScript: no installs, no server, no build step.

## Playing

Double-click `index.html` to play in your browser.

It's a daily game: one puzzle a day, the same 5 spots for everyone, with a 3 minute timer per round. A new puzzle
starts at midnight (the player's own time). Puzzle #1 was 26 November 2026 (`firstDay` in `config.js`).

Each map's spots all get used once before any of them repeats.

The schedule is locked in: adding or removing spots never changes a puzzle that's already out. The editor stamps each
new spot with the date you added it, and it only starts appearing 2 days later (`newSpotDelayDays` in `config.js`),
which leaves room for players in time zones ahead of yours. Removing a spot works the same way: the editor marks it
`removed` instead of deleting it, and it stops appearing 2 days later. Push within a day of exporting so the dates hold.

A player's progress and score for the day are saved only in their own browser (localStorage). If `goatcounter` is
set in `config.js`, the site also sends anonymous counts to GoatCounter: page visits, and one event per finished
puzzle with the score range (e.g. `score/10000-12499`). No cookies, names or personal details. If they leave partway through, they pick up at the next round; once they finish, they see their score and a
countdown until the next puzzle. The **?** button in the top bar explains how to play, and the chart button shows the
player's stats: games played, average and best score, current and longest streak, and a chart of their scores. Stats
are kept in the same browser storage (`valleyGuessrHistory`), and admin test games never count.

## What's in the folder

| File / folder        | What it's for                                                              |
| -------------------- | -------------------------------------------------------------------------- |
| `index.html`         | The page you open to play.                                                 |
| `config.js`          | Settings: title, rounds per day, timer, scoring, difficulty, and maps.     |
| `rounds.js`          | Every spot in the game. Made by the editor, so you don't edit it by hand.  |
| `game.js`            | The game itself: rounds, timer, scoring screen, sharing.                   |
| `viewer.js`          | The zoomable, draggable map.                                               |
| `logic.js`           | Scoring math and which spots each day gets.                                |
| `editor.js`          | The spot editor (only works on your own computer).                         |
| `admin.js`           | Admin/testing tools (only works on your own computer).                     |
| `style.css`          | How everything looks.                                                      |
| `maps/`              | The map images players click on.                                           |
| `screenshots/`       | The cropped images, one per spot per difficulty. Each map has its own subfolder (`screenshots/pelican/`, `screenshots/forest/`). |

## The areas

There are four maps: Pelican Town, Cindersap Forest, The Beach and The Mountain, all switched on.

Each day's puzzle mixes areas: every round can be from any map that's switched on, so players have to find the right
area as well as the right spot. They get area buttons at the bottom of the map, and every round starts on Pelican Town
(`homeMap` in `config.js`), so where the map opens gives nothing away. A guess in the wrong area scores 0.

- `mapStart` in `config.js` lists the maps in use and the date each one starts. A map that isn't listed is never used,
  but its spots and pictures stay put. To switch a new map on, add it like `winter: '2026-12-20'` (any date at least 2 days
  ahead) so today's and tomorrow's puzzles don't change. A switched-on map joins once it has live spots (after the
  usual 2-day wait).
- Every spot is used once before any spot repeats, across all areas. New spots join the cycle that's under way, so
  they show up within the next few weeks.
- Each puzzle has at most `maxPerArea` (2) rounds from one area, and spots from the same area in one puzzle are at
  least `minSpotGap` apart (a tenth of the map's diagonal), so no two are right next to each other. A spot never
  comes back within a week. These give way only if there aren't enough spots to keep them.

The Forest, Beach and Mountain images in `maps/` are full size (the game's own 1× size). Pelican Town's game image is a
smaller copy of the 8000 px original. `scale` in `config.js` makes crops cover the same amount of the game on every
map, so a Medium crop is 100 px of the original Pelican Town map and 26 px elsewhere (about 26 game pixels across).

## Adding new spots

1. Open the editor: add `?edit=1` to the end of the address and press Enter.
   Easiest is VS Code's **Live Server** (right-click `index.html` → Open with Live Server). Then the Forest, Beach and
   Mountain images load by themselves. If you open `index.html` as a plain file instead, pick each image yourself.
2. Click the picture button for the map you want (on the map, near the bottom). The list on the right only shows
   that map's spots. If it says "Not chosen yet", click **Choose file** and pick that map's
   full-size image: `maps/forest.webp`, `maps/beach.webp` or `maps/mountain.webp`, or the original 8000 px Pelican Town map.
3. Click the map wherever you want a new spot. Type a name if you like, then press Enter. Spots belong to the area
   that's showing when you click.
4. Click **Download crops (.zip)**.
5. Open the zip and drag everything inside (the `screenshots` folder and `rounds.js`) into the game folder.
   Replace when asked.

Spots on a map whose full-size image you haven't loaded keep their existing pictures, so you only need the image for
the areas you're adding to. Never delete the old `screenshots` folder: unzip on top of it and replace when asked. New
pictures go into a folder per map (`screenshots/pelican/`, `screenshots/forest/`, `screenshots/beach/`...), and existing ones keep their names.
To remove a spot, click the × next to it before downloading. Spots that were already in the game stay in
`rounds.js` marked as `removed`, so past puzzles don't change. Don't delete lines from `rounds.js` by hand.

## Admin mode (testing)

Open `index.html` from your computer and add `?admin=1` to the end of the address. The start screen gets an Admin box
where you can:

- **Reset today's progress** so you can play the daily again, exactly like a player would.
- **Clear my stats** to wipe your own stats history.
- **Play any puzzle number** (past or future) and see which spots it has and what date it falls on.
- **Free play** with 5 random spots.
- Switch between **Easy / Medium / Hard** crops for testing.
- **View all spots**: every picture, its name, and the next puzzle it appears in. Click one to play just that spot.
- **Open the editor** to add or remove spots.

An **Admin menu** button in the top bar stops a game and takes you back. Test games are never saved; only the normal
"Play today's puzzle" button saves progress.

Like the editor, admin mode only switches on when the game is opened from your own computer, so `?admin=1` does
nothing on the live site. The `admin.js` file is still uploaded with the rest of the game, so someone curious could
read it, but it only lets them test the game in their own browser. It can't change anything for other players.

## Changing the difficulty

Players always get the size named by `CONFIG.difficulty` in `config.js` (Medium, about 26 game pixels across). The editor still cuts every
size under `DIFFICULTIES`, so you can switch by changing that one line. To change the sizes themselves, edit the `px`
numbers (smaller = harder), then open the editor and download the zip again so every spot is re-cut.

## Adding more maps and building interiors

`config.js` explains how to add another area (it gets an area button automatically; set its `scale` and make a small `thumb` picture), and how to make buildings
enterable with a door button. The editor has a "Door button helper" for finding door positions.

## Saving your changes (git)

This folder is a git repository, so every change you save is kept in its history. After you change something:

```sh
git add -A
git commit -m "Describe what you changed"
git push
```

## Putting it online

The game is hosted for free with **GitHub Pages** at **https://valleyguessr.com** (repo **Settings → Pages**, deployed
from the `main` branch). Every time you push, the live site updates within a minute or two.

The `CNAME` file tells GitHub Pages which domain to use. Don't delete it. The domain's DNS has four `A` records for `@`
(`185.199.108.153`, `.109.153`, `.110.153`, `.111.153`) and a `CNAME` record for `www` pointing to `dallisaur.github.io`.

Editor mode only works when `index.html` is opened from your own computer, so visitors can't use it.

It can also be uploaded to itch.io as an HTML5 project (zip the folder and upload it).

## Credits

Stardew Valley, its map, and its artwork belong to ConcernedApe. This is a free, non-commercial fan project and isn't
affiliated with ConcernedApe.
