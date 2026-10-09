# Sounds

The board plays OSRS sounds as moments show on the map: a card turning, a spell landing, a gem
collected. They ship with the site in `public/sounds/` (34 files, about 0.6 MB), so a deploy always
carries the sounds its code plays. The tour's music is bigger and lives on the asset server instead
(`tools/characters/audio/`, see `tools/characters/README.md`).

## How it works

- `src/domain/sounds.ts` says which sound each game event makes, and who hears it:
  - **everyone**: big moments (gems, Jokers, spells, blockers, teleports, minigames).
  - **team**: small ones (cards, feathers, shops, tiles completed, items dropped), heard only by
    the team they happen to and by whoever follows that team on the map.
- `Choreography` (`src/domain/motion.ts`) schedules each sound at the moment its event shows on the
  board, like the callouts: a gem sounds when the walk reaches it, not when the server says so.
  Replays play their sounds too.
- `src/sound/effects.ts` plays them at the site's volume (the ♪ control in the header). It stays
  quiet while the tab is hidden and during the tour. A sound that can't play stays silent.
- `sounds.spec.ts` fails if a sound named in `SOUNDS` has no file in `public/sounds/`.

## Where each sound comes from

Sound effects are from the OSRS cache, by sound ID (names from the OSRS Wiki's
[list of sound IDs](https://oldschool.runescape.wiki/w/List_of_sound_IDs)). Jingles are from the
OSRS Wiki's [jingles](https://oldschool.runescape.wiki/w/Jingles), by name.

| File                 | Plays when                                                | Source                                 |
| -------------------- | --------------------------------------------------------- | -------------------------------------- |
| `card-turn`          | a card is drawn                                           | sound 3809 `patterns_turncard`         |
| `joker`              | a Joker is drawn                                          | jingle "Bad Roll (Death Plateau)"      |
| `free-item`          | a 7 or Ace gives a free item                              | jingle "Lucky Win (Death Plateau)"     |
| `ice-barrage-cast`   | Ice Barrage is cast                                       | sound 171 `ice_cast`                   |
| `ice-barrage-impact` | Ice Barrage freezes its target                            | sound 168 `ice_barrage_impact`         |
| `entangle-cast`      | Entangle is cast                                          | sound 151 `entangle_cast_and_fire`     |
| `entangle-hit`       | Entangle freezes its target                               | sound 153 `entangle_hit`               |
| `axe-throw`          | Morrigan's throwing axe                                   | sound 3841 `godwars_axe_throw`         |
| `feather-wind`       | a feather is used                                         | sound 220 `windstrike_cast_and_fire`   |
| `quetzal-whistle`    | the Quetzal whistle                                       | sound 1569 `whistle`                   |
| `ogre-boat`          | the Ogre boat                                             | sound 2728 `canoe_paddle_loop`         |
| `group-teleport`     | Group teleport                                            | sound 199 `tele_other_cast`            |
| `banana-place`       | a Banana is placed                                        | sound 1261 `banana_slicing`            |
| `swarm-place`        | a Harpie bug swarm is placed                              | sound 537 `insect_attack`              |
| `snake-charm`        | a Snake charmer is placed                                 | sound 1219 `NTK_snake_charm`           |
| `web-place`          | a Wilderness web is placed                                | sound 3604 `small_spider_attack`       |
| `banana-slip`        | a team walks onto a Banana                                | sound 1748 `royal_comedy_slip`         |
| `swarm-hit`          | a team walks onto a swarm                                 | sound 540 `insect_trapped`             |
| `stunned`            | a team walks onto a Snake charmer, or is frozen otherwise | sound 3005 `stun_impact`               |
| `web-stuck`          | a team walks onto a web                                   | sound 1280 `TBCU_spider_stick`         |
| `protect-from-magic` | Protect from Magic blocks a freeze                        | sound 2675 `protect_from_magic`        |
| `item-drop`          | a team drops an item                                      | sound 2739 `put_down`                  |
| `teleport`           | a team teleports (Joker, dev tools)                       | sound 200 `teleport_all`               |
| `thaw`               | a team thaws                                              | sound 2541 `shatter`                   |
| `coins`              | a team enters a shop                                      | sound 2115 `coins`                     |
| `coins-recorded`     | a team buys                                               | a recording of the in-game coins sound |
| `casket-open`        | the mystery box reel lands                                | sound 50 `casket_open`                 |
| `level-up`           | a gem is collected                                        | jingle "Attack Level Up!"              |
| `oh-dear`            | a gem is lost                                             | jingle "Oh Dear!"                      |
| `fanfare`            | a tile is completed                                       | sound 2930 `fanfare`                   |
| `horn`               | a minigame opens                                          | sound 3302 `barbassault_horn`          |
| `victory`            | a minigame ends                                           | jingle "Victory! (Castle Wars)"        |
| `genie`              | a random event happens                                    | sound 2301 `genie_appear`              |
| `quest-complete`     | a team wins the game                                      | jingle "Quest Complete 1"              |

The quetzal's wing flaps, the Venenatis web and Lunar Tele Group are newer sounds than the cache
dump we had, so the closest older sound stands in for them.

## Adding or swapping a sound

Every file is mono Ogg Vorbis, levelled so its loudest moment is the same: **-16 LUFS** momentary
loudness (EBU R128, what ears judge), with true peaks under **-1 dBTP**. Cache sounds come out very
quiet (OSRS turns them up itself), so a new one needs levelling or it is barely heard next to the
jingles. Level from the original (`.flac` or `.wav`), not from an `.ogg`: Vorbis drops detail it
takes to be too quiet to hear, and turning it up afterwards brings out the damage.

1. Measure the original. The largest `M:` value is its loudest moment; `Peak:` is its true peak.

   ```sh
   ffmpeg -v verbose -i original.flac -ac 1 -af "apad=pad_dur=0.5,ebur128=peak=true:framelog=verbose" -f null - 2>&1 | grep -E " M: |Peak:"
   ```

2. Work out the gain: the smaller of `-16 - (largest M)` and `-1 - (Peak)`.
3. Encode it with that gain:

   ```sh
   ffmpeg -i original.flac -ac 1 -af "volume=<gain>dB" -c:a libvorbis -q:a 5 public/sounds/<name>.ogg
   ```

4. Add the name to `SOUNDS` in `src/domain/sounds.ts`, use it in `soundFor`, and add a row above.
