<script setup lang="ts">
import { computed } from 'vue'
import { itemName } from '@/domain/describe'
import type { Team } from '@/domain/game'
import { INVENTORY_LIMIT, ITEM_INFO, SHOP_PRICES, inventorySize } from '@/domain/items'
import { ITEMS, type Item } from '@/domain/vocabulary'

const props = defineProps<{
  /** The shopping team, when this browser manages one that can buy here now. */
  buyer: Team | null
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
        : inventorySize(props.buyer) >= INVENTORY_LIMIT
          ? 'Inventory full'
          : null
    return [{ item, name: itemName(item), text: ITEM_INFO[item].text, price, why }]
  }),
)
</script>

<template>
  <section class="flex min-h-0 flex-col">
    <header class="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
      <span
        class="size-5 rounded-[3px] border-2 border-amber-950"
        style="background: linear-gradient(#f59e0b 0 45%, #fde68a 45%)"
        aria-hidden="true"
      />
      <h2 class="font-semibold text-amber-200">Shop</h2>
      <span v-if="buyer" class="ml-auto text-sm text-amber-300 tabular-nums">
        {{ buyer.gold }} gold
      </span>
      <button
        type="button"
        class="rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-slate-800"
        :class="buyer ? '' : 'ml-auto'"
        aria-label="Close the shop"
        @click="emit('close')"
      >
        ✕
      </button>
    </header>
    <p v-if="!buyer" class="px-4 pt-3 text-xs text-slate-400">
      Every shop sells the same items. Teams buy when they stop on or pass through a shop.
    </p>
    <ul class="min-h-0 flex-1 divide-y divide-slate-800/70 overflow-y-auto">
      <li v-for="row in rows" :key="row.item" class="flex items-start gap-3 px-4 py-2.5">
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-slate-100">{{ row.name }}</p>
          <p class="text-xs text-slate-400">{{ row.text }}</p>
        </div>
        <div class="flex shrink-0 flex-col items-end gap-1">
          <span class="text-sm font-semibold text-amber-300 tabular-nums"> {{ row.price }}g </span>
          <button
            v-if="buyer"
            type="button"
            class="rounded-md bg-amber-500 px-2.5 py-0.5 text-xs font-semibold text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            :disabled="pending || row.why !== null"
            :title="row.why ?? undefined"
            @click="emit('buy', row.item)"
          >
            Buy
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>
