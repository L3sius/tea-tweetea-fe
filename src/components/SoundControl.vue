<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import { computed, ref, useTemplateRef } from 'vue'
import { useSoundStore } from '@/stores/sound'
import { TtButton, TtText } from '@/ui/tt'

// Mute, and a volume each for the music and the sound effects: a small button that opens the
// controls, with the volumes on hover. It sits in the header, and in the tour's corner while the
// tour hides the header.
const sound = useSoundStore()

const open = ref(false)
const root = useTemplateRef('root')
onClickOutside(root, () => (open.value = false))

const percent = (volume: number) => Math.round(volume * 100)
const sliders = computed(() => [
  { label: 'Music', value: percent(sound.musicVolume), set: sound.setMusicVolume },
  { label: 'Effects', value: percent(sound.effectsVolume), set: sound.setEffectsVolume },
])
const summary = computed(() =>
  sound.muted
    ? 'Sound is off'
    : `Music ${percent(sound.musicVolume)}% · Effects ${percent(sound.effectsVolume)}%`,
)
</script>

<template>
  <div ref="root" class="relative">
    <TtButton
      size="sm"
      :selected="open"
      :aria-expanded="open"
      aria-haspopup="dialog"
      :title="summary"
      @click="open = !open"
    >
      {{ sound.muted ? '♪ Off' : '♪ On' }}
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
      <label v-for="slider in sliders" :key="slider.label" class="flex items-center gap-2">
        <TtText :size="1" color="white" class="w-12 shrink-0">{{ slider.label }}</TtText>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          class="volume min-w-0 flex-1"
          :class="{ 'opacity-50': sound.muted }"
          :value="slider.value"
          :title="`${slider.label} ${slider.value}%`"
          @input="slider.set(Number(($event.target as HTMLInputElement).value) / 100)"
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
