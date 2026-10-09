#!/usr/bin/env bash
# Puts the exported assets (out/osrs/, from export.mjs) and the site's music (audio/, not in git)
# on the server, where Caddy serves them at https://api.tea-osrs.com/osrs/. The new set is copied
# beside the live one, then swapped in, so pages never see half an upload.
# Usage: ./upload.sh [user@host]
set -euo pipefail
cd "$(dirname "$0")"
host="${1:-root@161.35.173.209}"
test -f out/osrs/index.json || { echo "Nothing to upload: run the export first." >&2; exit 1; }
# Seed the copy from the live set, so rsync only sends what changed.
ssh "$host" 'rm -rf /srv/osrs.next && if [ -d /srv/osrs ]; then cp -a /srv/osrs /srv/osrs.next; fi'
rsync -az --delete --no-owner --no-group --chmod=D755,F644 --exclude=/audio/ out/osrs/ "$host:/srv/osrs.next/"
if [ -d audio ]; then
  rsync -az --delete --no-owner --no-group --chmod=D755,F644 audio/ "$host:/srv/osrs.next/audio/"
fi
ssh "$host" 'rm -rf /srv/osrs.old && { [ ! -d /srv/osrs ] || mv /srv/osrs /srv/osrs.old; } && mv /srv/osrs.next /srv/osrs && rm -rf /srv/osrs.old'
curl -sf https://api.tea-osrs.com/osrs/anims.json > /dev/null && echo "https://api.tea-osrs.com/osrs/ is up to date"
