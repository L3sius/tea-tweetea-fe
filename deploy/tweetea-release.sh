#!/usr/bin/env bash
# /usr/local/bin/tweetea-release on the droplet: the only command the deploy key may run (its
# authorized_keys line forces it, see deploy/setup-droplet.sh). The key's user owns /srv/tweetea
# and nothing else, so CI can put up a release and switch to it, but cannot touch the API, Caddy or
# the other sites.
#
#   deploy <id>   reads the built site as a .tar.gz on stdin into releases/<id>/ and makes it live
#   rollback      makes the previous release live again; run again to undo
#   status        names the live release and lists the others
set -euo pipefail
umask 022
root=/srv/tweetea
# Releases kept besides the live and the previous one.
keep=3

read -r verb arg rest <<<"${SSH_ORIGINAL_COMMAND:-}"
[[ -z "${rest:-}" ]] || { echo "too many arguments" >&2; exit 2; }

# Moves a link in one step, so Caddy never sees it missing.
link() { ln -sfn "$1" "$root/$2.new" && mv -T "$root/$2.new" "$root/$2"; }

case "$verb" in
  deploy)
    [[ "${arg:-}" =~ ^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{7,40}$ ]] || { echo "bad release id" >&2; exit 2; }
    dir="$root/releases/$arg"
    [[ ! -e "$dir" ]] || { echo "release $arg already exists" >&2; exit 1; }
    mkdir -p "$dir"
    if ! tar -xzf - --no-same-owner --no-same-permissions -C "$dir" || [[ ! -f "$dir/index.html" ]]; then
      rm -rf "$dir"
      echo "the upload is not a whole site; nothing changed" >&2
      exit 1
    fi
    chmod -R u=rwX,go=rX "$dir"
    live="$(readlink "$root/site" || true)"
    link "$dir" site
    if [[ -n "$live" ]]; then link "$live" previous; fi
    # Old releases go, except the live and the previous one.
    previous="$(readlink "$root/previous" || true)"
    ls -1d "$root"/releases/*/ | sed 's:/$::' | sort | head -n -"$((keep + 2))" | while read -r old; do
      [[ "$old" == "$dir" || "$old" == "$previous" ]] || rm -rf "$old"
    done
    echo "live: $arg"
    ;;
  rollback)
    live="$(readlink "$root/site")"
    previous="$(readlink "$root/previous" || true)"
    [[ -n "$previous" && -d "$previous" ]] || { echo "no previous release" >&2; exit 1; }
    link "$previous" site
    link "$live" previous
    echo "live: $(basename "$previous")"
    ;;
  status)
    echo "live: $(basename "$(readlink "$root/site" 2>/dev/null || echo none)")"
    echo "previous: $(basename "$(readlink "$root/previous" 2>/dev/null || echo none)")"
    ls -1 "$root/releases"
    ;;
  *)
    echo "usage: deploy <id> | rollback | status" >&2
    exit 2
    ;;
esac
