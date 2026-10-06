<script setup lang="ts">
import { GEMS, type Gem } from '@/domain/vocabulary'
import { GEM_COLORS } from '@/ui/colors'

defineProps<{ gems: ReadonlySet<Gem> }>()
</script>

<template>
  <ul class="flex gap-1.5" :aria-label="`${gems.size} of ${GEMS.length} gems`">
    <li
      v-for="gem in GEMS"
      :key="gem"
      :title="`${gem} gem${gems.has(gem) ? '' : ' (missing)'}`"
      class="size-4 rotate-45 rounded-[3px] border-2 transition-colors"
      :style="{
        borderColor: GEM_COLORS[gem],
        backgroundColor: gems.has(gem) ? GEM_COLORS[gem] : 'transparent',
        opacity: gems.has(gem) ? 1 : 0.35,
        boxShadow: gems.has(gem) ? `0 0 8px ${GEM_COLORS[gem]}` : 'none',
      }"
    />
  </ul>
</template>
