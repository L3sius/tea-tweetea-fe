<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { itemName } from '@/domain/describe'
import type { Item } from '@/domain/vocabulary'
import { itemKitSprite, itemSprite } from '@/ui/items'
import { TtSlot } from '@/ui/tt'

const props = withDefaults(
  defineProps<{ item: Item; count?: number; size?: number; selected?: boolean; dim?: boolean }>(),
  { count: 1, size: 90 },
)

/** The catalogue picture failed to load, so the kit sprite or the name stands in. */
const broken = ref(false)
watch(
  () => props.item,
  () => (broken.value = false),
)

const sprite = computed(() => (broken.value ? itemKitSprite(props.item) : itemSprite(props.item)))
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
    <img
      v-if="sprite.url"
      :src="sprite.url"
      alt=""
      class="item-picture"
      :style="{ width: `${size - 36}px`, height: `${size - 36}px` }"
      @error="broken = true"
    />
    <span
      v-else-if="!sprite.icon"
      class="tt-1 pointer-events-none px-1 text-center break-words"
      :class="sprite.gem ? 'absolute right-0 bottom-0.5 left-0' : ''"
      :style="{ color: 'var(--osrs-white)' }"
      >{{ sprite.gem ? 'Necklace' : name }}</span
    >
  </TtSlot>
</template>

<style scoped>
.item-picture {
  object-fit: contain;
  filter: drop-shadow(3px 3px 0 #000);
  pointer-events: none;
}
</style>
