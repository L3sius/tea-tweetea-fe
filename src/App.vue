<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onMounted, onUnmounted } from 'vue'
import { RouterView } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { useGameStore } from '@/stores/game'
import { useTeamStore } from '@/stores/team'
import { useFrontendUpdates } from '@/ui/frontendUpdates'

const game = useGameStore()
const team = useTeamStore()
const { error, newBuildAvailable } = storeToRefs(game)
const frontendUpdated = useFrontendUpdates()

// The game streams for as long as the app is open, whichever page is showing.
onMounted(() => {
  void game.start()
  void team.restore()
})
onUnmounted(() => game.stop())

const reload = () => window.location.reload()
</script>

<template>
  <div class="flex h-dvh flex-col overflow-hidden">
    <AppHeader />
    <div
      v-if="newBuildAvailable || frontendUpdated"
      class="z-[1100] flex items-center gap-3 bg-sky-900/80 px-4 py-1.5 text-sm text-sky-100"
    >
      {{ frontendUpdated ? 'A new version of this site is out.' : 'The game server was updated.' }}
      <button type="button" class="font-semibold underline" @click="reload">Reload</button>
    </div>
    <div
      v-if="error"
      role="alert"
      class="z-[1100] border-b border-red-500/40 bg-red-950/80 px-4 py-2 text-sm whitespace-pre-line text-red-200"
    >
      {{ error }}
    </div>
    <main class="relative min-h-0 flex-1">
      <RouterView />
    </main>
  </div>
</template>
