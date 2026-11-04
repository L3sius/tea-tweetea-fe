#!/usr/bin/env bash
# deploy/setup-droplet.sh: sets the droplet up to serve this site at tea-osrs.com, once, as root
# (one SSH login). Safe to run again; rerun after changing tweetea.caddy or tweetea-release.sh.
#
#   deploy/setup-droplet.sh [path to the deploy key's .pub]   (default ~/.ssh/tweetea-deploy.pub)
#
# On the droplet it:
# - makes the user tweetea-deploy, owner of /srv/tweetea (releases/, and the site and previous links)
# - installs deploy/tweetea-release.sh as /usr/local/bin/tweetea-release and lets the deploy key
#   run that command only (GitHub Actions deploys with it, see .github/workflows/deploy.yml)
# - installs deploy/tweetea.caddy as /etc/caddy/tweetea.caddy and imports it from the Caddyfile.
#   The droplet serves other sites (the Tweety API, Entrana, the hub), so the whole config is
#   validated first, put back as it was if that fails, and Caddy is only reloaded, never restarted.
set -euo pipefail
: "${TWEETEA_HOST:=root@161.35.173.209}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
pub="${1:-$HOME/.ssh/tweetea-deploy.pub}"
[[ -f "$pub" ]] || { echo "no deploy key at $pub" >&2; exit 1; }
key="$(cat "$pub")"
[[ "$key" =~ ^ssh-ed25519\ [A-Za-z0-9+/=]+(\ .*)?$ ]] || { echo "$pub is not an ed25519 public key" >&2; exit 1; }

# The files travel inside the remote script, so there is only the one login.
{
  echo 'set -euo pipefail'
  printf 'key=%q\n' "$key"
  echo "cat > /tmp/tweetea-release <<'TWEETEA_RELEASE_EOF'"
  cat "$here/tweetea-release.sh"
  echo 'TWEETEA_RELEASE_EOF'
  echo "cat > /tmp/tweetea.caddy <<'TWEETEA_CADDY_EOF'"
  cat "$here/tweetea.caddy"
  echo 'TWEETEA_CADDY_EOF'
  cat <<'EOF'
id tweetea-deploy >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash tweetea-deploy
mkdir -p /srv/tweetea/releases
chown -R tweetea-deploy:tweetea-deploy /srv/tweetea
chmod 755 /srv/tweetea /srv/tweetea/releases
install -o root -g root -m 755 /tmp/tweetea-release /usr/local/bin/tweetea-release
rm /tmp/tweetea-release
home="$(getent passwd tweetea-deploy | cut -d: -f6)"
install -d -o tweetea-deploy -g tweetea-deploy -m 700 "$home/.ssh"
echo "restrict,command=\"/usr/local/bin/tweetea-release\" $key" > "$home/.ssh/authorized_keys"
chown tweetea-deploy:tweetea-deploy "$home/.ssh/authorized_keys"
chmod 600 "$home/.ssh/authorized_keys"
echo "deploy user ready: tweetea-deploy may only run tweetea-release"

cd /etc/caddy
install -o root -g caddy -m 644 /tmp/tweetea.caddy tweetea.caddy.new
rm /tmp/tweetea.caddy
backup=""
if ! grep -qx "import tweetea.caddy" Caddyfile; then
  backup="Caddyfile.bak-$(date -u +%Y%m%dT%H%M%SZ)"
  cp Caddyfile "$backup"
  printf '\nimport tweetea.caddy\n' >> Caddyfile
fi
if [[ -f tweetea.caddy ]]; then cp tweetea.caddy tweetea.caddy.old; fi
mv tweetea.caddy.new tweetea.caddy
if ! caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null; then
  if [[ -f tweetea.caddy.old ]]; then mv tweetea.caddy.old tweetea.caddy; else rm tweetea.caddy; fi
  if [[ -n "$backup" ]]; then cp "$backup" Caddyfile; fi
  echo "the Caddy block did not validate: the Caddyfile and the block are as they were" >&2
  exit 1
fi
rm -f tweetea.caddy.old
systemctl reload caddy
echo "Caddy reloaded with tweetea.caddy"
EOF
} | ssh "$TWEETEA_HOST" 'bash -s'
