<script setup lang="ts">
import { useIntervalFn, useNow, useTitle } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import ActivityFeed from '@/components/ActivityFeed.vue'
import { useGameStore } from '@/stores/game'

// The Activity feed in a window of its own, popped out from the board: for a second screen or a
// stream overlay. The app streams the game here too; sound stays with the board.
const { feed, state } = storeToRefs(useGameStore())
const now = useNow({ scheduler: (tick) => useIntervalFn(tick, 1_000) })
useTitle('Drops and kills · Tweetea')
</script>

<template>
  <div class="h-full overflow-y-auto">
    <ActivityFeed v-if="state" :feed="feed" :teams="state.teams" :now="now" detached />
  </div>
</template>
