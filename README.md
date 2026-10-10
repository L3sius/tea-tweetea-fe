# tea-tweetea-fe

Website for **Tweetea and the Magic Gems**, an Old School RuneScape clan board game: teams complete
OSRS tasks, draw cards, walk the map and race to collect all eight gems.

**Starting the event?** Follow [docs/launch.md](docs/launch.md): the backend, the assets, this
site and the players' Dink, in order.

## Getting started

```sh
npm install
npm run dev        # offline, against recorded responses (see .env.development)
```

To use a running game API instead, copy `.env.example` to `.env.development.local`.

| Command                     | What it does                                             |
| --------------------------- | -------------------------------------------------------- |
| `npm run dev`               | Dev server on http://localhost:5173                      |
| `npm test`                  | Unit and component tests once (`test:unit` watches)      |
| `npm run test:e2e`          | Playwright end-to-end tests ([docs/e2e.md](docs/e2e.md)) |
| `npm run build`             | Type-check and production build                          |
| `npm run lint`              | oxlint, then ESLint                                      |
| `npm run format`            | Prettier                                                 |
| `npm run fixtures:refresh`  | Re-record API responses from a running server            |
| `npm run characters:export` | Export OSRS characters (tools/characters/)               |
| `npm run characters:upload` | Put them and the music on the server                     |

### Play-testing tools

`npm run dev` (or any build opened with `?dev`) shows a **🛠 Dev** button over the map. It acts on
any team through admin actions: ready to draw, complete a tile, gold, give items, draw a chosen
card (or rig your next card pick), teleport, freeze or thaw, and undo the last journal entry.
Items, cards, teleports and freezing need the backend started with `DEV_TOOLS=1`; the admin code
is `admin` in the sample game. Restart the backend to start over from the sample.

## Architecture

```
src/
  domain/   the game in TypeScript: types, branded ids, pure rules. No Vue, no HTTP.
  api/      everything that knows the server's JSON
    wire/       Zod schemas mirroring responses exactly (snake_case)
    mappers/    wire → domain (and domain commands → wire requests)
    endpoints.ts  each endpoint's schema + mapper, shared by every client
    http/       the real client
    fixtures/   an offline client over recorded responses in fixtures/data/
  config/   typed, validated public env config
  stores/   Pinia stores: the only code that calls the ApiClient (provided in main.ts)
  map/      the world map projection; the image is assets/map/, copied from the backend
  characters/  OSRS characters as team pieces: the roster, the client's animation maths, what plays
               when, and a three.js renderer
  ui/       colours and formatting shared by components
    tt/       the Tweetea design system's Vue components (Tt*), copied from tweetea-design-system/
  assets/tt/  its tokens, fonts and sprites (only what we use)
  components/, views/  the screens
```

- The look is the Tweetea design system: OSRS stone/iron frames, pixel fonts in 16px steps, hard
  shadows. Use the `Tt*` components and `tt-*` classes; Tailwind is for layout only.
  `tweetea-design-system/` (gitignored) is the reference: copy from it, never import it.
- Dependencies point inward: UI → domain ← api. Only `api/` knows the wire format.
- Every response is validated. A response that breaks the contract fails loudly as an
  `invalid_response` `ApiError` instead of rendering wrong.
- The recorded responses double as contract tests (`api/fixtures/contract.spec.ts`): after a
  backend change, run `npm run fixtures:refresh` and the tests show what moved.
- Tests sit next to the code as `*.spec.ts` and run in Node. A component test opts into a DOM with
  `// @vitest-environment jsdom` at the top of the file.

### Characters

A team's piece can be any OSRS NPC built like a player instead of a bird.

- `tools/characters/` exports models and animations from a qodat cache and uploads them to the
  backend droplet, which serves them at `https://api.tea-osrs.com/osrs/` (see its README). They are
  not in this repo; `VITE_OSRS_ASSETS_URL` points the app elsewhere.
- `src/characters/roster.json` lists the animations: the styles a team picks (idle, walk, run,
  swim), reactions to moments on the board, and rare easter eggs.
- `/characters` tries looks on any NPC. A team logged in with its code saves its own look there (the
  `set_appearance` team action); the server keeps it on the team and every board picks it up.

### Sounds

The board plays OSRS sounds as moments show on the map, at the volume of the ♪ control in the
header. They ship with the site in `public/sounds/`; `src/domain/sounds.ts` says which event makes
which sound and who hears it. [docs/sounds.md](docs/sounds.md) lists where each file comes from and
how to add or swap one (levelled to one loudness). The tour's music is on the asset server instead.

### Tutorial

A first visit opens a guided tour of the board (and "How to play" replays it): Earl Grey talks the
player through it while the page builds itself up part by part.

- `src/tutorial/script.ts` holds the lines, gestures, camera moves and what each beat reveals.
- The tour plays on its own frozen world (`src/tutorial/world/`: a copy of the board and of the
  sample game), so it looks the same whatever the live map and game become. Earl Grey's routes are
  tiles of that board, checked by `script.spec.ts`.
- `stores/tutorial.ts` plays it; parts of the page are named with `v-tutorial="'panel'"`, and the
  map's layers with BoardMap's `layers` prop, so the script never depends on particular markup.
- Whether a browser has seen it is kept in `localStorage` (`tweetea.tutorial`); bump `VERSION` in
  the store to show a reworked tour to everyone once.

The game rules are in the rulebook; the API reference is `docs/api.md` in the backend repository.
