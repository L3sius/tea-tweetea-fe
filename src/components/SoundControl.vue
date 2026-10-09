<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import { computed, ref, useTemplateRef } from 'vue'
import { useSoundStore } from '@/stores/sound'
import { TtButton, TtText } from '@/ui/tt'

// Mute and volume for all sound on the site: a small button that says how loud it is, and opens
// the controls. It sits in the header, and in the tour's corner while the tour hides the header.
const sound = useSoundStore()

const open = ref(false)
const root = useTemplateRef('root')
onClickOutside(root, () => (open.value = false))

const percent = computed(() => Math.round(sound.volume * 100))
</script>

<template>
  <div ref="root" class="relative">
    <TtButton
      size="sm"
      :selected="open"
      :aria-expanded="open"
      aria-haspopup="dialog"
      :title="sound.muted ? 'Sound is off' : `Volume ${percent}%`"
      @click="open = !open"
    >
      {{ sound.muted ? '♪ Off' : `♪ ${percent}%` }}
    </TtButton>
    <div
      v-if="open"
      class="tt-frame-iron absolute top-full right-0 z-[1200] mt-1.5 flex w-56 flex-col gap-2 p-2"
      role="dialog"
      aria-label="Sound"
    >
      <div class="flex items-center justify-between gap-2">
        <TtText :size="1" color="orange">Sound</TtText>
        <TtButton size="sm" :aria-pressed="sound.muted" @click="sound.toggleMute()">
          {{ sound.muted ? 'Unmute' : 'Mute' }}
        </TtButton>
      </div>
      <label class="flex items-center gap-2">
        <TtText :size="1" color="white">Volume</TtText>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          class="volume min-w-0 flex-1"
          :class="{ 'opacity-50': sound.muted }"
          :value="percent"
          @input="sound.setVolume(Number(($event.target as HTMLInputElement).value) / 100)"
        />
      </label>
    </div>
  </div>
</template>

<style scoped>
.volume {
  accent-color: var(--osrs-orange);
}
</style>
