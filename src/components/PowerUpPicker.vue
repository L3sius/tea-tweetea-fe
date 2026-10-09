<script setup lang="ts">
import { onClickOutside, useElementSize } from '@vueuse/core'
import { computed, ref, useTemplateRef, watch } from 'vue'
import { itemName } from '@/domain/describe'
import type { Tile } from '@/domain/board'
import type { Team } from '@/domain/game'
import {
  INVENTORY_LIMIT,
  ITEM_GROUP,
  ITEM_GROUPS,
  itemEntry,
  inventorySize,
  whyNotUsable,
} from '@/domain/items'
import type { Item } from '@/domain/vocabulary'
import { TtContextMenu, TtText } from '@/ui/tt'
import type { MenuOption } from '@/ui/tt/TtContextMenu.vue'
import ItemSlot from './ItemSlot.vue'

const props = defineProps<{
  team: Team
  /** The team's private inventory. */
  items: ReadonlyMap<Item, number>
  /** The tile the team stands on, for items that only work on land or at sea. */
  here?: Tile
  now: Date
  /** How many blockers the team has on the board, against the per-team limit. */
  blockersPlaced: number
  pending: boolean
  /** Locked items are listed but the menu says why they can't be used yet. */
  locked?: boolean
}>()
const emit = defineEmits<{ use: [item: Item]; discard: [item: Item] }>()

/** Five a row: the ten inventory slots make two full rows. */
const COLUMNS = 5
const GAP = 3
/** As wide as the panel allows, up to a comfortable size. */
const MAX_SLOT = 76

const root = useTemplateRef('root')
const { width } = useElementSize(root)
const slot = computed(() =>
  Math.max(48, Math.min(MAX_SLOT, Math.floor((width.value - (COLUMNS - 1) * GAP) / COLUMNS))),
)

const items = computed(() =>
  [...props.items]
    .filter(([, n]) => n > 0)
    .map(([item, count]) => {
      const group = ITEM_GROUP[item]
      return {
        item,
        count,
        name: itemName(item),
        text: itemEntry(item).description,
        group: ITEM_GROUPS[group],
        held: group === 'held',
        why: whyNotUsable(props.team, item, props.now, props.here, props.blockersPlaced),
      }
    }),
)
/** Item slots, then empty ones up to the inventory limit (and on to whole rows past it). */
const empties = computed(() => {
  const n = items.value.length
  return Math.max(INVENTORY_LIMIT, Math.ceil(n / COLUMNS) * COLUMNS) - n
})

const selected = ref<Item | null>(null)
const menuOpen = ref(false)
const current = computed(() => items.value.find((r) => r.item === selected.value) ?? null)
watch(items, () => {
  if (!current.value) {
    selected.value = null
    menuOpen.value = false
  }
})

function toggle(item: Item) {
  if (selected.value === item && menuOpen.value) {
    menuOpen.value = false
    return
  }
  selected.value = item
  menuOpen.value = true
}

const menuOptions = computed<MenuOption[]>(() => {
  const r = current.value
  if (!r) return []
  const out: MenuOption[] = []
  if (!r.held)
    out.push({
      verb: 'Use',
      target: r.name,
      disabled: props.pending ? 'Wait a moment' : props.locked ? 'Finish your tile first' : r.why,
    })
  out.push({ verb: 'Drop', target: r.name, disabled: props.pending ? 'Wait a moment' : null })
  out.push({ verb: 'Cancel' })
  return out
})

function onSelect(o: MenuOption) {
  menuOpen.value = false
  const r = current.value
  if (!r) return
  if (o.verb === 'Use') emit('use', r.item)
  else if (o.verb === 'Drop') emit('discard', r.item)
}

/** The menu opens under the picked slot, flipped left on the right-hand columns. */
const menuStyle = computed(() => {
  const i = items.value.findIndex((r) => r.item === selected.value)
  const col = i % COLUMNS
  const row = Math.floor(i / COLUMNS)
  const size = slot.value
  const top = `${row * (size + GAP) + size * 0.66}px`
  return col < COLUMNS / 2
    ? { top, left: `${col * (size + GAP) + size / 3}px` }
    : { top, right: `${(COLUMNS - 1 - col) * (size + GAP) + size / 3}px` }
})

const grid = useTemplateRef('grid')
onClickOutside(grid, () => (menuOpen.value = false))
</script>

<template>
  <div ref="root" class="flex w-full flex-col items-center gap-2">
    <TtText :size="1" color="orange">
      Inventory ({{ inventorySize(props.items) }}/{{ INVENTORY_LIMIT }})
    </TtText>
    <div
      ref="grid"
      class="relative grid justify-center"
      :style="{ gridTemplateColumns: `repeat(${COLUMNS}, ${slot}px)`, gap: `${GAP}px` }"
    >
      <ItemSlot
        v-for="r in items"
        :key="r.item"
        :item="r.item"
        :count="r.count"
        :size="slot"
        :selected="selected === r.item"
        @click="toggle(r.item)"
      />
      <div
        v-for="i in empties"
        :key="`e${i}`"
        class="tt-sprite-slot"
        :style="{ width: `${slot}px`, height: `${slot}px`, filter: 'brightness(.7)' }"
      />
      <div v-if="menuOpen && current" class="absolute z-10" :style="menuStyle">
        <TtContextMenu :options="menuOptions" @select="onSelect" />
      </div>
    </div>

    <TtText v-if="items.length === 0" :size="1" color="muted">
      No items yet. Shops sell them, and drawing a 7 or an Ace gives one free.
    </TtText>
    <div v-else-if="current" class="flex max-w-[360px] flex-col items-center gap-1">
      <TtText :size="1" color="orange">{{ current.group.label }}: {{ current.group.hint }}</TtText>
      <TtText :size="1" color="white">{{ current.text }}</TtText>
      <TtText v-if="current.why && !locked && !current.held" :size="1" color="muted">
        {{ current.why }}
      </TtText>
    </div>
    <TtText v-else :size="1" color="muted">Click an item to use or drop it.</TtText>
  </div>
</template>
