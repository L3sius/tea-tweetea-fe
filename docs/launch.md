# Launching the event

Everything to do, in order, so the event starts on time. Most of it happens once, the week before;
the last part is the day itself. Each step says where it runs.

## What runs where

| Part                                               | Lives at                                                                          | Comes from                             |
| -------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------- |
| Game API (the backend, `tweety`)                   | `https://api.tea-osrs.com`, on the droplet `161.35.173.209`                       | backend repo, `deploy/deploy.sh`       |
| OSRS character models and the tour's music         | `https://api.tea-osrs.com/osrs/`, Caddy on the same droplet, files in `/srv/osrs` | this repo, `npm run characters:upload` |
| This website (with its sound effects in `sounds/`) | `https://tea-osrs.com`                                                            | this repo, `npm run build`             |
| Players' loot and kills                            | the Dink RuneLite plugin, posting to `https://api.tea-osrs.com/dink?token=…`      | each player's RuneLite                 |

The backend's own steps are in its repo: `deploy/README.md` (droplet, deploy, the real event) and
`config/README.md` (the game's config files). This page links them up; it doesn't repeat them.

## The week before

### 1. Backend: the real game config

In the backend repo, the production `board.json`, `challenges.json`, `pools.toml` and `game.toml`
go in `config/` (see its `config/README.md`).

- [ ] `game.toml`: `start` and `end` are the event's real dates and times (UTC).
- [ ] `items.toml`: prices and descriptions are final. The website shows them as served, so there
      is nothing to change here when they move.

### 2. Backend: deploy and settings

On the droplet, `/etc/tweety/tweety.env` (see `deploy/tweety.env.example`):

- [ ] `CONFIG_DIR=config` (not `config/sample`).
- [ ] `ADMIN_CODE` and `DINK_TOKEN` are long random strings (`openssl rand -hex 24`), kept out of
      chat logs.
- [ ] `CORS_ORIGINS` includes `https://tea-osrs.com` and `https://www.tea-osrs.com`.
- [ ] `DEV_TOOLS` is not set. It allows the play-testing shortcuts (give items, pick cards,
      teleport); never in the real event.

Then deploy from a machine with Rust: `deploy/deploy.sh` in the backend repo. After changing
`tweety.env` alone: `systemctl restart tweety`.

### 3. Backend: a fresh game with the teams

From `deploy/README.md`, "Starting the real event":

1. `systemctl stop tweety`, move `/var/lib/tweety/tweety.db` aside (keep it, don't delete it),
   `systemctl start tweety`. The server starts an empty game.
2. Create the teams with admin actions: `POST https://api.tea-osrs.com/admin/action` with the
   header `X-Admin-Code: <ADMIN_CODE>`. `scripts/demo-seed.sh` in the backend repo shows the shape.
   - `create_team { name, code }` for each team. The **code** is what its captain types to log in.
   - `add_member { team, name }` for each player, and `add_account { team, member, rsn }` for each
     of their RuneScape names (alts too). Dink reports by RSN, so a missing account means drops
     that count for nobody.
3. Don't send `start_game` yet: that is for the day itself.

- [ ] Every team created, with its code written down to hand to its captain.
- [ ] Every player's RSNs added, alts included.

### 4. Assets: characters and music

Only needed when `src/characters/roster.json` changed, or the music changed, since the last upload.
It needs SSH access to the droplet (`root@161.35.173.209`). See `tools/characters/README.md`.

```sh
npm install --prefix tools/characters   # once
npm run characters:export                # needs a qodat OSRS cache; writes tools/characters/out/osrs/
npm run characters:upload                # also uploads tools/characters/audio/ (the tour's music)
```

- [ ] `https://api.tea-osrs.com/osrs/anims.json` opens.
- [ ] `https://api.tea-osrs.com/osrs/audio/newbie-melody.ogg` plays.

Browsers keep these files for up to an hour, so upload at least an hour before the start. Without
a `tools/characters/audio/` folder on your machine, the upload leaves the music on the server as it
is.

### 5. Website: build and deploy

```sh
npm ci
npm run build    # type-checks, then builds dist/ with .env.production (the API at api.tea-osrs.com)
```

`dist/` is the whole site, sound effects included (`dist/sounds/`). Put it on `tea-osrs.com`:

> **TODO: write down how `dist/` gets onto `tea-osrs.com`** (which server, which command, who has
> access). Nothing in either repo says yet.

- [ ] `https://tea-osrs.com` opens, and the header shows **Live** (green).
- [ ] A team code logs in, and the team shows in the header.

### 6. Players: Dink

Each player sets up the Dink RuneLite plugin with the event's config. The backend repo keeps it in
`tools/dink/dink-config.json`, without the webhook URL. The webhook URL to add is:

```
https://api.tea-osrs.com/dink?token=<DINK_TOKEN>
```

- [ ] Every player has Dink set up, with the webhook URL.
- [ ] A test drop from one player shows up in the **Activity** tab within a few seconds.

## The day

1. **An hour or more before:** the asset upload (step 4), if anything changed, so browsers have it.
2. **Check the site:** it opens, shows **Live**, every captain can log in with their code, and the
   tour plays (with music after **Begin**).
3. **Start the game:** the admin action `start_game` (same endpoint and header as step 3). Teams
   are placed on the board and the game log says "The game has started!".
4. **Watch it:** `journalctl -u tweety -f` on the droplet shows the server's log.

## During the event

- **A mistake in the journal** (a wrong completion, say): open the site with `?dev` at the end of
  the URL, enter the admin code in the 🛠 Dev panel and press **Undo**. It reverts the newest
  journal entry. With `DEV_TOOLS` off, only the plain admin actions work there (complete a tile,
  gold, undo), not the play-testing shortcuts.
- **A task Dink can't see** (a pet with no name, say): complete it with the admin action
  `complete_tile { team }`, or the Dev panel's button.
- **The server restarts** after `systemctl restart tweety` with the game as it was; open pages
  reconnect by themselves.
- **A new website version:** deploy it as in step 5. Open pages offer a **Reload** button.
