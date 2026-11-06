<script setup lang="ts">
import type { PartProgress } from '@/domain/describe'
import { TtText } from '@/ui/tt'

// A compound tile's steps, each with its own count (capped at what it needs); a done step is green.
// The tile's overall progress bar sits above it.

defineProps<{ parts: PartProgress[] }>()
</script>

<template>
  <ul v-if="parts.length" class="flex w-[330px] max-w-full flex-col gap-0.5" aria-label="Steps">
    <li v-for="part in parts" :key="part.name" class="flex justify-between gap-3">
      <TtText :size="1" color="white" align="left">{{ part.name }}</TtText>
      <TtText
        :size="1"
        :color="part.done >= part.needed ? 'green' : 'white'"
        class="whitespace-nowrap"
      >
        {{ part.done }} / {{ part.needed }}
      </TtText>
    </li>
  </ul>
</template>
