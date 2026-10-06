<script setup lang="ts">
import { computed } from 'vue'
import { itemName } from '@/domain/describe'
import type { Team } from '@/domain/game'
import { ITEM_GROUP, ITEM_GROUPS, ITEM_INFO, whyNotUsable, type ItemGroup } from '@/domain/items'
import type { Item } from '@/domain/vocabulary'

const props = defineProps<{
  team: Team
  now: Date
  pending: boolean
  /** Locked items are listed but their buttons say why they can't be used yet. */
  locked?: boolean
}>()
const emit = defineEmits<{ use: [item: Item]; discard: [item: Item] }>()

const ORDER: ItemGroup[] = ['draw', 'you', 'rival', 'board', 'everyone', 'held']

const groups = computed(() =>
  ORDER.map((group) => ({
    group,
    ...ITEM_GROUPS[group],
    items: [...props.team.items]
      .filter(([item, n]) => n > 0 && ITEM_GROUP[item] === group)
      .map(([item, count]) => ({
        item,
        count,
        name: itemName(item),
        text: ITEM_INFO[item].text,
        why: whyNotUsable(props.team, item, props.now),
      })),
  })).filter((g) => g.items.length > 0),
)

const GROUP_STYLE: Record<ItemGroup, string> = {
  draw: 'bg-emerald-500/15 text-emerald-300',
  you: 'bg-sky-500/15 text-sky-300',
  rival: 'bg-red-500/15 text-red-300',
  board: 'bg-orange-500/15 text-orange-300',
  everyone: 'bg-violet-500/15 text-violet-300',
  held: 'bg-slate-500/15 text-slate-400',
}
</script>

<template>
  <p v-if="groups.length === 0" class="text-xs text-slate-500">
    No items yet. Shops sell them, and drawing a 7 or an Ace gives one free.
  </p>
  <div v-else class="flex flex-col gap-3">
    <section v-for="g in groups" :key="g.group">
      <h4 class="mb-1 flex items-baseline gap-2">
        <span
          class="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
          :class="GROUP_STYLE[g.group]"
        >
          {{ g.label }}
        </span>
        <span class="text-[11px] text-slate-500">{{ g.hint }}</span>
      </h4>
      <ul class="flex flex-col gap-1.5">
        <li
          v-for="row in g.items"
          :key="row.item"
          class="flex items-start gap-2 rounded-md border border-slate-700/50 bg-slate-800/50 px-2.5 py-1.5"
        >
          <div class="min-w-0 flex-1">
            <p class="font-medium text-slate-100">
              {{ row.name
              }}<span v-if="row.count > 1" class="text-slate-400"> ×{{ row.count }}</span>
            </p>
            <p class="text-xs text-slate-400">{{ row.text }}</p>
            <p v-if="row.why && !locked && g.group !== 'held'" class="text-[11px] text-slate-500">
              {{ row.why }}
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <button
              v-if="g.group !== 'held'"
              type="button"
              class="rounded-md bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-400"
              :disabled="pending || locked || row.why !== null"
              :title="row.why ?? `Use ${row.name}`"
              @click="emit('use', row.item)"
            >
              Use
            </button>
            <button
              type="button"
              class="rounded px-1.5 py-1 text-xs text-slate-500 hover:bg-slate-700 hover:text-slate-300"
              :disabled="pending"
              title="Throw away"
              :aria-label="`Throw away ${row.name}`"
              @click="emit('discard', row.item)"
            >
              🗑
            </button>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>
