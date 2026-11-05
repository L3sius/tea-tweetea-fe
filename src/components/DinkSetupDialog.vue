<script setup lang="ts">
import { onKeyStroke } from '@vueuse/core'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useDinkStore } from '@/stores/dink'
import { useTutorialStore } from '@/stores/tutorial'
import { TtButton, TtPanel, TtText } from '@/ui/tt'
import DinkSteps from './DinkSteps.vue'

// The Dink setup. It is put in front of a first-time visitor once the tutorial is over (finished
// or skipped), and progress only counts through Dink, so then only "I've set it up" closes it.
// Opened again from the header, it closes on Close, Escape or a click outside.

const dink = useDinkStore()
const tutorial = useTutorialStore()
const route = useRoute()

// The first-visit ask: not over the tutorial, and not for admins on their own page.
const asking = computed(() => !dink.done && tutorial.seen && !tutorial.active && !route.meta.admin)
const open = computed(() => dink.shown || asking.value)
const closable = computed(() => dink.shown && !asking.value)

function close() {
  if (closable.value) dink.hide()
}
onKeyStroke('Escape', close)
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dink-overlay" @click.self="close">
      <TtPanel
        variant="iron"
        title="Set up Dink"
        width="min(560px, calc(100vw - 32px))"
        :padding="15"
        :gap="12"
        role="dialog"
        aria-modal="true"
        aria-label="Set up Dink"
      >
        <TtText :size="1" color="white">
          Your drops, kills and clues reach the game through the Dink RuneLite plugin. Without it
          nothing you do counts for your team. Every player sets it up once, on every account they
          play.
        </TtText>
        <DinkSteps />
        <template v-if="asking">
          <TtText :size="1" color="muted">
            You can open these steps again with <b>Dink</b> at the top.
          </TtText>
          <TtButton @click="dink.confirm">I've set it up</TtButton>
        </template>
        <TtButton v-else @click="close">Close</TtButton>
      </TtPanel>
    </div>
  </Teleport>
</template>

<style scoped>
.dink-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  overflow-y: auto;
  background: rgb(0 0 0 / 0.55);
}
b {
  color: var(--osrs-yellow);
  font-weight: normal;
}
</style>
