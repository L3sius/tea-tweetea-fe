<script setup lang="ts">
import { computed, ref } from 'vue'
import { itemName } from '@/domain/describe'
import type { Team } from '@/domain/game'
import { INVENTORY_LIMIT, SHOP_PRICES, itemEntry } from '@/domain/items'
import { ITEMS, type Item } from '@/domain/vocabulary'
import { TtButton, TtDisplayBox, TtPanel, TtText } from '@/ui/tt'
import ItemSlot from './ItemSlot.vue'

const props = defineProps<{
  /** The shopping team, when this browser manages one that can buy here now. */
  buyer: Team | null
  /** How many items the buyer holds, against the inventory limit. */
  held: number
  pending: boolean
}>()
const emit = defineEmits<{ buy: [item: Item]; close: [] }>()

const rows = computed(() =>
  ITEMS.flatMap((item) => {
    const price = SHOP_PRICES[item]
    if (price === undefined) return []
    const why = !props.buyer
      ? null
      : price > props.buyer.gold
        ? 'Not enough gold'
        : props.held >= INVENTORY_LIMIT
          ? 'Inventory full'
          : null
    return [{ item, name: itemName(item), text: itemEntry(item).description, price, why }]
  }),
)

const picked = ref<Item | null>(null)
const current = computed(() => rows.value.find((r) => r.item === picked.value) ?? null)
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
    <TtText v-else :size="1" color="white" class="max-w-[480px]">
      Every shop sells the same items. Teams buy when they stop on or pass through a shop.
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
    </ul>

    <div v-if="current" class="flex min-h-[96px] flex-col items-center gap-1.5">
      <TtText :size="2">{{ current.name }}</TtText>
      <TtText :size="1" color="white" class="max-w-[480px]">{{ current.text }}</TtText>
      <TtButton
        v-if="buyer"
        size="sm"
        :disabled="pending || current.why !== null"
        :title="current.why ?? undefined"
        @click="emit('buy', current.item)"
      >
        {{ current.why ?? `Buy for ${current.price} gold` }}
      </TtButton>
    </div>
    <TtText v-else :size="1" color="muted" class="min-h-[96px]">
      Click an item to see what it does.
    </TtText>

    <TtButton @click="emit('close')">Close shop</TtButton>
  </TtPanel>
</template>
