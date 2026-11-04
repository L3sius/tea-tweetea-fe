<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useTutorialStore } from '@/stores/tutorial'
import { TtButton, TtPanel, TtText } from '@/ui/tt'
import DinkSteps from './DinkSteps.vue'

// The Dink setup, put in front of a first-time visitor once the tutorial is over (finished or
// skipped). Progress only counts through Dink, so only "I've set it up" closes it; the FAQ page
// keeps the same steps for later.

const DONE_KEY = 'tweetea.dinkSetup'

const tutorial = useTutorialStore()
const route = useRoute()

const done = ref(readDone())
// Not over the tutorial, and not for admins on their own page.
const open = computed(() => !done.value && tutorial.seen && !tutorial.active && !route.meta.admin)

function confirm() {
  done.value = true
  try {
    localStorage.setItem(DONE_KEY, '1')
  } catch {
    // Asked again next visit.
  }
}

function readDone(): boolean {
  try {
    return localStorage.getItem(DONE_KEY) === '1'
  } catch {
    return false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dink-overlay">
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
          nothing you do counts for your team.
        </TtText>
        <DinkSteps />
        <TtText :size="1" color="muted">You can find these steps again on the FAQ page.</TtText>
        <TtButton @click="confirm">I've set it up</TtButton>
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
</style>
