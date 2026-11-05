<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { readConfig } from '@/config/env'
import { TtButton, TtText } from '@/ui/tt'

// How to connect the Dink RuneLite plugin: Dink loads the event's settings, webhook included, from
// the server's /dink/config. Shown in the setup dialog.

const api = readConfig().api
// On recorded fixtures there is no server of our own; the real one is what players set up.
const configUrl = `${api.mode === 'http' ? api.baseUrl.replace(/\/+$/, '') : 'https://api.tea-osrs.com'}/dink/config`

const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
async function copy() {
  try {
    await navigator.clipboard.writeText(configUrl)
  } catch {
    // No clipboard (an insecure page, say): the address is there to select by hand.
    return
  }
  copied.value = true
  clearTimeout(timer)
  timer = setTimeout(() => (copied.value = false), 2000)
}
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="flex w-full flex-col gap-3 text-left">
    <ol class="dink-steps flex flex-col gap-2">
      <li>
        <TtText :size="1" color="white" align="left">
          Install <b>Dink</b> from the RuneLite Plugin Hub.
        </TtText>
      </li>
      <li>
        <TtText :size="1" color="white" align="left">
          Open the Dink settings, then <b>Advanced</b>.
        </TtText>
      </li>
      <li>
        <!-- Its own box, so the item keeps its number. -->
        <div class="flex flex-col gap-1.5">
          <TtText :size="1" color="white" align="left">
            Paste this into <b>Dynamic Config URL</b>:
          </TtText>
          <div class="flex flex-wrap items-center gap-2">
            <code class="dink-url">{{ configUrl }}</code>
            <TtButton size="sm" :width="88" @click="copy">{{
              copied ? 'Copied' : 'Copy'
            }}</TtButton>
          </div>
        </div>
      </li>
      <li>
        <TtText :size="1" color="white" align="left">
          Set <b>Import Policy</b> to <b>Overwrite Webhooks</b>.
        </TtText>
      </li>
      <li>
        <TtText :size="1" color="white" align="left">
          Turn the Dink plugin <b>off</b>, then <b>on</b> again.
        </TtText>
      </li>
      <li>
        <TtText :size="1" color="white" align="left">
          Close the settings with the <b>&lt;</b> back arrow.
        </TtText>
      </li>
      <li>
        <!-- Not a Dink setting, but Dink only hears of a combat achievement the game announces. -->
        <TtText :size="1" color="white" align="left">
          Only if you already have some combat achievements: in the OSRS settings, turn on
          <b>Combat Achievement Tasks</b> and allow <b>repeat completion</b>. Without it, the game
          doesn't announce a task you already have, so it can't count.
        </TtText>
      </li>
    </ol>
    <TtText :size="1" color="orange" align="left">
      Don't change the Dink settings after this, or your drops may count for the wrong thing or not
      at all.
    </TtText>
  </div>
</template>

<style scoped>
.dink-steps {
  margin: 0;
  text-align: left;
  padding-left: 1.6em;
  list-style: decimal;
  color: var(--osrs-orange);
  font-family: var(--font-bold);
}
.dink-steps b {
  color: var(--osrs-yellow);
  font-weight: normal;
}
.dink-url {
  padding: 3px 8px;
  border: 1px solid rgb(0 0 0 / 0.6);
  background: rgb(0 0 0 / 0.45);
  color: var(--osrs-yellow);
  font-family: var(--font-small);
  font-size: var(--fs-1);
  overflow-wrap: anywhere;
  user-select: all;
}
</style>
