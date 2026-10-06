<script setup lang="ts">
import type { Gem } from '@/domain/vocabulary'
import { TtGemTracker } from '@/ui/tt'

withDefaults(defineProps<{ gems: ReadonlySet<Gem>; scale?: number; slots?: boolean }>(), {
  scale: 1,
  slots: false,
})
</script>

<template>
  <TtGemTracker :held="gems" :scale="scale" :slots="slots" />
</template>
