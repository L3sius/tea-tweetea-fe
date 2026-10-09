<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onMounted, onUnmounted, watch } from 'vue'
import { RouterView } from 'vue-router'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import TutorialOverlay from '@/components/TutorialOverlay.vue'
import { useGameStore } from '@/stores/game'
import { useTeamStore } from '@/stores/team'
import { useTutorialStore } from '@/stores/tutorial'
import { vTutorial } from '@/tutorial/directive'
import { useFrontendUpdates } from '@/ui/frontendUpdates'
import { TtButton, TtText } from '@/ui/tt'

const game = useGameStore()
const team = useTeamStore()
const { error, newBuildAvailable } = storeToRefs(game)
const frontendUpdated = useFrontendUpdates()
const tutorial = useTutorialStore()
const router = useRouter()

// A first visit opens the tutorial on the board, once the board has loaded.
watch(
  () => game.board,
  async (board) => {
    if (!board || tutorial.seen || tutorial.active) return
    await router.push('/')
    tutorial.start()
  },
  { immediate: true },
)

// The game streams for as long as the app is open, whichever page is showing.
onMounted(() => {
  void game.start()
  void team.restore()
})
onUnmounted(() => game.stop())

const reload = () => window.location.reload()
</script>

<template>
  <div class="flex h-dvh flex-col gap-1.5 overflow-hidden p-1.5">
    <AppHeader v-tutorial="'header'" />
    <div
      v-if="newBuildAvailable || frontendUpdated"
      class="tt-sprite-display z-[1100] flex flex-wrap items-center justify-center gap-3 px-3"
    >
      <TtText :size="1" color="white">
        {{
          frontendUpdated ? 'A new version of this site is out.' : 'The game server was updated.'
        }}
      </TtText>
      <TtButton size="sm" @click="reload">Reload</TtButton>
    </div>
    <div
      v-if="error"
      role="alert"
      class="tt-sprite-display z-[1100] px-3 py-1 text-center whitespace-pre-line"
    >
      <TtText :size="1" color="red">{{ error }}</TtText>
    </div>
    <main class="relative min-h-0 flex-1">
      <RouterView />
    </main>
    <TutorialOverlay v-if="tutorial.cover !== 'off'" />
  </div>
</template>
