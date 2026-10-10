# End-to-end tests

Playwright drives the site in a browser, as a player would. Run them before you deploy:

```sh
npm run test:e2e            # everything
npm run test:e2e:fixtures   # only the site on recorded responses (no backend)
npm run test:e2e:live       # only the site on a real backend
HEADED=1 npm run test:e2e   # watch the browser while it runs
```

A failed test leaves a screenshot and a trace in `test-results/`. Open the trace with
`npx playwright show-trace <path>/trace.zip` to step through what the browser saw.

## Two kinds of test

| Project    | Folder          | Runs against                                         | Covers                                              |
| ---------- | --------------- | ---------------------------------------------------- | --------------------------------------------------- |
| `fixtures` | `e2e/fixtures/` | the recorded responses in `src/api/fixtures/data/`   | every page, logging in, the tutorial, settings      |
| `live`     | `e2e/live/`     | a real tweety, started on an empty game for the test | whole turns, items, shops, freezes, Dink, two pages |

Playwright starts everything itself: a Vite server for each project (ports 5174 and 5175) and
`scripts/e2e-backend.mjs`, which runs tweety on port 8090 with a control server on 8091. None of
these are the usual 5173 and 8080, so a play-testing setup can keep running next to the tests.

## The live backend

`scripts/e2e-backend.mjs` needs the tweety checkout next to this repo (`../tweety`), or wherever
`TWEETY_DIR` points. It builds tweety with `cargo build --release` when the exe is older than the
sources. On Windows a running tweety locks the exe: stop the play-testing server first, or the
script warns and uses the old build.

Before each live test it starts tweety again on an empty database, and the test seeds two teams
through admin actions (`red` and `blue`, admin code `admin`). Each test plays its own game.

Some tests need the play-testing admin actions (`dev_give_item`, `dev_teleport`, `dev_freeze`,
...). They need a tweety that has them, started with `DEV_TOOLS=1`, which the script does. If the
checkout doesn't have them, those tests are skipped with a message saying so, and the rest still
run. Without a tweety checkout at all, every live test is skipped.

## Writing tests

- Find things the way a player does: by role and name (`getByRole('button', { name: 'Go!' })`).
  If something can't be found that way, give it a proper label in the component; it helps screen
  readers too.
- The board map is a canvas, so nodes have no element to click. Development builds set
  `window.__tweeteaMap` (see `MapProbe` in `env.d.ts`): where a node is on screen, and which nodes
  a click can pick. `clickTile` and `walkTheCard` in `e2e/support/live.ts` use it.
- Set up state through the API (`backend.admin(...)`, `backend.dink(...)`), then test what the
  player sees and does in the page. Check results in the page, or through `backend.state()`.
- Draws, starting tiles and random events are random. Assert what is true whatever comes up, or
  fix the outcome with a dev action (`dev_draw_card`, `dev_teleport`).
