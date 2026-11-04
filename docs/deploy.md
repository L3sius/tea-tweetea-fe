# Deploying the website

The site is static files, served at https://tea-osrs.com by Caddy on the clan's droplet
(`161.35.173.209`), next to the Tweety API, Entrana and the hub. Every push to `main` deploys it.

## What is where

- **DNS:** `tea-osrs.com` and `www` are A records to the droplet, DNS only (no proxy). `www`
  redirects to `tea-osrs.com`.
- **Caddy:** `/etc/caddy/Caddyfile` ends with `import tweetea.caddy`; `/etc/caddy/tweetea.caddy`
  is [deploy/tweetea.caddy](../deploy/tweetea.caddy). Caddy gets the HTTPS certificate itself.
- **Releases:** `/srv/tweetea/releases/<UTC time>-<commit>/`, each the built site (`dist/`) at one
  commit, with a `release.json` naming it. `/srv/tweetea/site` links to the live one,
  `/srv/tweetea/previous` to the one before. A few older ones stay; the rest go.
- **Deploy user:** `tweetea-deploy` owns `/srv/tweetea` and nothing else. Its key
  (`~/.ssh/tweetea-deploy`, and the `DEPLOY_SSH_KEY` secret on GitHub) may only run
  `/usr/local/bin/tweetea-release` ([deploy/tweetea-release.sh](../deploy/tweetea-release.sh)).

Never touch the other sites' Caddy blocks or services, and reload Caddy, never restart it.

## Every push to main

[.github/workflows/deploy.yml](../.github/workflows/deploy.yml) runs lint, the unit tests and the
type-check, builds the site and uploads it as a new release, which goes live at once. A failed check
deploys nothing. Watch it under the repo's **Actions** tab, or `gh run watch`.

The workflow can also run by hand (**Run workflow** on the Actions tab), to deploy `main` again.

## By hand (Git Bash)

With the deploy key, from any machine that has it:

```sh
ssh -i ~/.ssh/tweetea-deploy tweetea-deploy@161.35.173.209 status     # live, previous, all releases
ssh -i ~/.ssh/tweetea-deploy tweetea-deploy@161.35.173.209 rollback   # previous release live; again to undo
```

Check: `curl -s https://tea-osrs.com/release.json` names the commit.

## Setting the droplet up

Once, and again after changing `deploy/tweetea.caddy` or `deploy/tweetea-release.sh`. It needs root
on the droplet:

```sh
deploy/setup-droplet.sh
```

It makes the deploy user, installs the release command and lets the deploy key run only that, and
installs the Caddy block. It validates the whole Caddy config first and puts everything back if that
fails.

The GitHub secrets, once (needs `gh`, signed in as a repo admin):

```sh
gh secret set DEPLOY_SSH_KEY -R L3sius/tea-tweetea-fe < ~/.ssh/tweetea-deploy
ssh-keygen -F 161.35.173.209 | grep -v '^#' | gh secret set DEPLOY_KNOWN_HOSTS -R L3sius/tea-tweetea-fe
```

`DEPLOY_KNOWN_HOSTS` holds the droplet's host keys, so CI checks it talks to the droplet.

The backend must let the site call it: `CORS_ORIGINS` in `/etc/tweety/tweety.env` includes
`https://tea-osrs.com` and `https://www.tea-osrs.com` (see [launch.md](launch.md)).
