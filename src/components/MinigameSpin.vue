<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Spin } from '@/stores/game'
import { TtPanel, TtText } from '@/ui/tt'
import SlotReel from './SlotReel.vue'

// A minigame being "picked": the reel spins through joke picks and stops on the one the server
// already chose. It can't be skipped; it closes itself shortly after it lands.

const props = defineProps<{ spin: Spin; teamName: string | null; teamColor: string }>()
const emit = defineEmits<{ done: [] }>()

/** How long the result stays up after the reel stops. */
const LANDED_MS = 2200

const landed = ref(false)
const title = computed(() => (landed.value ? props.spin.winner : 'Picking a minigame…'))

function onLanded() {
  landed.value = true
  setTimeout(() => emit('done'), LANDED_MS)
}
</script>

<template>
  <TtPanel variant="iron" width="min(720px, 100%)" :padding="12" :gap="9">
    <template #title>{{ title }}</template>
    <TtText v-if="teamName" :size="1" color="white">
      <span :style="{ color: teamColor }">{{ teamName }}</span> landed on a red tile. Every team can
      join in.
    </TtText>
    <SlotReel :winner="spin.winner" @landed="onLanded" />
  </TtPanel>
</template>
