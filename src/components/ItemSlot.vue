<script setup lang="ts">
import { computed } from 'vue'
import { itemName } from '@/domain/describe'
import type { Item } from '@/domain/vocabulary'
import { itemSprite } from '@/ui/items'
import { TtSlot } from '@/ui/tt'

const props = withDefaults(
  defineProps<{ item: Item; count?: number; size?: number; selected?: boolean; dim?: boolean }>(),
  { count: 1, size: 90 },
)

const sprite = computed(() => itemSprite(props.item))
const name = computed(() => itemName(props.item))
</script>

<template>
  <TtSlot
    :size="size"
    :icon="sprite.icon"
    :gem="sprite.gem"
    :quantity="count"
    :selected="selected"
    :empty="dim"
    :title="name"
    :aria-label="count > 1 ? `${name} x${count}` : name"
  >
    <span
      v-if="!sprite.icon"
      class="tt-1 pointer-events-none px-1 text-center break-words"
      :class="sprite.gem ? 'absolute right-0 bottom-0.5 left-0' : ''"
      :style="{ color: 'var(--osrs-white)' }"
      >{{ sprite.gem ? 'Bell' : name }}</span
    >
  </TtSlot>
</template>
