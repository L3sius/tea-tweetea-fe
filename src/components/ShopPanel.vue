<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { itemName } from '@/domain/describe'
import type { Team } from '@/domain/game'
import { itemEntry, mysteryBoxEntry } from '@/domain/items'
import { ITEMS, type Item } from '@/domain/vocabulary'
import { playEffect } from '@/sound/effects'
import { TtButton, TtDisplayBox, TtPanel, TtSlot, TtText } from '@/ui/tt'
import ItemSlot from './ItemSlot.vue'
import SlotReel from './SlotReel.vue'

const props = defineProps<{
  /** The shopping team, when this browser manages one that can buy here now. */
  buyer: Team | null
  /** What this shop stocks; every shop also sells the mystery box. */
  stock: readonly Item[]
  /** How many items the buyer holds, against the inventory limit. */
  held: number
  inventoryLimit: number
  pending: boolean
  /** The item a mystery box just gave, while the reel spins to it. */
  opening: Item | null
}>()
const emit = defineEmits<{ buy: [item: Item]; buyMysteryBox: []; opened: []; close: [] }>()

/** How long the box's reel spins before it lands on the item. */
const BOX_SPIN_MS = 4000

/** The reel scrolls past every item by name, so each name leads back to its item for its picture. */
const REEL_ITEMS = new Map(ITEMS.map((item) => [itemName(item), item]))
const reelNames = [...REEL_ITEMS.keys()]

/** What the last box gave, shown once the reel has landed on it. */
const gotFromBox = ref<Item | null>(null)

function onLanded() {
  playEffect('casket-open')
  gotFromBox.value = props.opening
  emit('opened')
}

// Closing the shop mid-spin still puts the item in the inventory.
onBeforeUnmount(() => {
  if (props.opening) emit('opened')
})

/** What stops the buyer paying `price`, or null if nothing does. */
function whyNot(price: number): string | null {
  if (!props.buyer) return null
  if (price > props.buyer.gold) return 'Not enough gold'
  if (props.held >= props.inventoryLimit) return 'Inventory full'
  return null
}

const rows = computed(() =>
  props.stock.map((item) => {
    const { description, price } = itemEntry(item)
    return { item, name: itemName(item), description, price, why: whyNot(price) }
  }),
)

const box = computed(() => {
  const entry = mysteryBoxEntry()
  return { ...entry, why: whyNot(entry.price) }
})

/** The picked row: an item from the stock, or the mystery box. */
const picked = ref<Item | 'mystery_box' | null>(null)
watch(picked, () => (gotFromBox.value = null))
const current = computed(() => {
  if (picked.value === 'mystery_box') return { ...box.value, buy: () => emit('buyMysteryBox') }
  const row = rows.value.find((r) => r.item === picked.value)
  return row ? { ...row, buy: () => emit('buy', row.item) } : null
})
</script>

<template>
  <TtPanel
    variant="iron"
    title="Shop"
    width="min(720px, 100%)"
    :padding="15"
    :gap="12"
    class="max-h-full"
  >
    <TtDisplayBox
      v-if="buyer"
      label="Your gold"
      :value="buyer.gold"
      value-color="var(--osrs-yellow)"
      :width="180"
    />
    <TtText :size="1" color="white" class="max-w-[480px]">
      Each shop sells a few items of its own, and every shop sells the mystery box.
    </TtText>

    <ul
      class="grid max-h-[42dvh] w-full justify-center gap-x-1.5 gap-y-2 overflow-y-auto py-2"
      style="grid-template-columns: repeat(auto-fill, 90px)"
      aria-label="Items for sale"
    >
      <li v-for="row in rows" :key="row.item" class="flex flex-col items-center gap-1">
        <ItemSlot
          :item="row.item"
          :selected="picked === row.item"
          :dim="row.why !== null"
          @click="picked = row.item"
        />
        <TtText :size="1" :color="row.why === 'Not enough gold' ? 'red' : 'yellow'">
          {{ row.price }} gold
        </TtText>
      </li>
      <li class="flex flex-col items-center gap-1">
        <TtSlot
          :size="90"
          :icon="box.icon ? undefined : 'mystery-box'"
          :selected="picked === 'mystery_box'"
          :empty="box.why !== null"
          :title="box.name"
          :aria-label="box.name"
          @click="picked = 'mystery_box'"
        >
          <img v-if="box.icon" :src="box.icon" alt="" class="box-picture" />
        </TtSlot>
        <TtText :size="1" :color="box.why === 'Not enough gold' ? 'red' : 'yellow'">
          {{ box.price }} gold
        </TtText>
      </li>
    </ul>

    <!-- A mystery box opens on a reel, which lands on the item the server already drew. -->
    <div v-if="opening" class="flex min-h-[96px] w-full flex-col items-center gap-1.5">
      <TtText :size="2">Opening the mystery box…</TtText>
      <SlotReel
        :winner="itemName(opening)"
        :fakes="reelNames"
        :duration-ms="BOX_SPIN_MS"
        @landed="onLanded"
      >
        <template #pick="{ label }">
          <span class="reel-item">
            <ItemSlot v-if="REEL_ITEMS.get(label)" :item="REEL_ITEMS.get(label)!" :size="48" />
            <span>{{ label }}</span>
          </span>
        </template>
      </SlotReel>
    </div>
    <div v-else-if="gotFromBox" class="flex min-h-[96px] flex-col items-center gap-1.5">
      <TtText :size="2">You got the {{ itemName(gotFromBox) }}!</TtText>
      <TtText :size="1" color="white" class="max-w-[480px]">{{
        itemEntry(gotFromBox).description
      }}</TtText>
      <TtButton
        v-if="buyer"
        size="sm"
        :disabled="pending || box.why !== null"
        :title="box.why ?? undefined"
        @click="emit('buyMysteryBox')"
      >
        {{ box.why ?? `Buy another for ${box.price} gold` }}
      </TtButton>
    </div>
    <div v-else-if="current" class="flex min-h-[96px] flex-col items-center gap-1.5">
      <TtText :size="2">{{ current.name }}</TtText>
      <TtText :size="1" color="white" class="max-w-[480px]">{{ current.description }}</TtText>
      <TtButton
        v-if="buyer"
        size="sm"
        :disabled="pending || current.why !== null"
        :title="current.why ?? undefined"
        @click="current.buy()"
      >
        {{ current.why ?? `Buy for ${current.price} gold` }}
      </TtButton>
    </div>
    <TtText v-else :size="1" color="muted" class="min-h-[96px]">
      Click an item to see what it does.
    </TtText>

    <TtButton v-if="!opening" @click="emit('close')">Close shop</TtButton>
  </TtPanel>
</template>

<style scoped>
.reel-item {
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
}
.box-picture {
  width: 54px;
  height: 54px;
  object-fit: contain;
  filter: drop-shadow(3px 3px 0 #000);
  pointer-events: none;
}
</style>
