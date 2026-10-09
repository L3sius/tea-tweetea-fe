<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { itemName } from '@/domain/describe'
import type { Item } from '@/domain/vocabulary'
import { itemKitSprite, itemSprite } from '@/ui/items'
import { TtSlot } from '@/ui/tt'

const props = withDefaults(
  defineProps<{
    item: Item
    count?: number
    size?: number
    selected?: boolean
    dim?: boolean
    /** Hover text in place of the plain name, such as what the item does. */
    hint?: string
  }>(),
  { count: 1, size: 90, hint: undefined },
)

/** The catalogue picture failed to load, so the kit sprite or the name stands in. */
const broken = ref(false)
watch(
  () => props.item,
  () => (broken.value = false),
)

const sprite = computed(() => (broken.value ? itemKitSprite(props.item) : itemSprite(props.item)))
const name = computed(() => itemName(props.item))
/** The picture inside the slot's frame, in step with the slot from small to large. */
const picture = computed(() => Math.round(props.size * 0.6))
</script>

<template>
  <TtSlot
    :size="size"
    :icon="sprite.icon"
    :quantity="count"
    :selected="selected"
    :empty="dim"
    :title="hint ?? name"
    :aria-label="count > 1 ? `${name} x${count}` : name"
  >
    <img
      v-if="sprite.url"
      :src="sprite.url"
      alt=""
      class="item-picture"
      :style="{ width: `${picture}px`, height: `${picture}px` }"
      @error="broken = true"
    />
    <span
      v-else-if="!sprite.icon"
      class="tt-1 pointer-events-none px-1 text-center break-words"
      :style="{ color: 'var(--osrs-white)' }"
      >{{ name }}</span
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
