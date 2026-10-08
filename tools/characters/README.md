# OSRS character export

Exports what the board needs to draw teams as OSRS characters, from the game cache that
[qodat](https://github.com/Qodat/qodat) downloads, read with
[osrscachereader](https://github.com/Dezinater/osrscachereader). The files keep the game's own
building blocks. The browser merges and animates them like the game client does
(`src/characters/model.ts`).

## Use

```sh
npm install --prefix tools/characters      # once
npm run characters:export                  # write public/osrs/
npm run characters:describe -- 819 824     # name and check animations
npm run characters:describe -- --search emote_
npm run characters:catalog                 # out/human-npcs.tsv: every NPC rigged like a player
```

- The cache is the newest one under `~/.qodat/downloads/`, or `OSRS_CACHE=/path/to/cache` (the
  folder holding `main_file_cache.dat2`).
- `characters:export -- /some/dir` writes elsewhere, for example a CDN bucket. Point the app at it
  with `VITE_OSRS_ASSETS_URL`.
- Re-export after changing `src/characters/roster.json`, since only the animations it names ship.

## What it writes

- `index.json`: every NPC rigged like a player, one entry per distinct look and name (about 4100),
  with its model parts, recolours and scale.
- `models/<id>.bin`: one file per model part (about 3900, 11 MB). A character is a handful of
  parts, so a page loads a few KB per character.
- `framemaps/0.bin`: the player skeleton.
- `anims/<id>.bin` and `anims.json`: every animation in the roster, with the game's name and
  length for each.
- The binary layouts are documented next to their encoders in `export.mjs`.

## The roster

`src/characters/roster.json` names every animation the board uses.

- `styles`: what a team picks, one each of `idle`, `walk` (under 7 steps), `run` (7 or more)
  and `swim` (at sea). The first option is the default.
- `reactions`: pools played for moments on the board, one picked per moment:
  - `celebrate`: a completed tile
  - `despair`: a Joker drawn
  - `arrive`: landing after a teleport
  - `frozen`: the pose held while frozen
  - `use_item`: an item used
  - `pass`: climbing past another team
  - `slip`: caught by a trap
- `easterEggs`: idle emotes, and how often they happen. Besides `idleChancePerMinute`, a walk
  sometimes borrows another style (`gaitChancePerWalk`).
- `featured`: NPCs the character page suggests before a search.
- How each moment is chosen is in `src/characters/acting.ts`. Picks are seeded by the journal, so
  everyone watching sees the same animation.

## Checking animations

- `characters:describe` gives each id's game name (from the cache's gamevals, rev 230 on), whether
  it fits the player skeleton, its frame count and its length.
- The export skips animations made for another skeleton, since they would move the wrong vertices.
- `/characters` in the app plays every style and reaction on any NPC.

## Known gaps

- Textured faces show their base colour, and transparency animations (frame type 5) don't play.
- NPCs with their own skeletons (non-humans) and the newer skeletal animations aren't exported.
- `cache.mjs` patches osrscachereader 1.1.3 for newer caches: model opcodes 61/62 (rev 233+),
  NPC width scale, and reading the gamevals index. Caches before about rev 218 don't load.
