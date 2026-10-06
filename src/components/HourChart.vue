<script setup lang="ts">
import { computed, ref } from 'vue'
import type { StatRow } from '@/domain/activity'
import { formatGp } from '@/ui/format'

const props = defineProps<{ rows: readonly StatRow[]; measure: 'count' | 'value' }>()

const hovered = ref<number | null>(null)
const showTable = ref(false)

const points = computed(() =>
  [...props.rows]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((r) => ({ at: new Date(r.key), count: r.count, value: r.value })),
)
const max = computed(() => Math.max(1, ...points.value.map((p) => p[props.measure])))

const when = (d: Date) =>
  d.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })
const day = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

/** Day labels under the first hour of each day. */
const ticks = computed(() =>
  points.value.flatMap((p, i) =>
    i === 0 || p.at.getDate() !== points.value[i - 1]?.at.getDate()
      ? [{ i, label: day(p.at) }]
      : [],
  ),
)
const active = computed(() => (hovered.value === null ? null : points.value[hovered.value]))
</script>

<template>
  <div>
    <p v-if="points.length === 0" class="py-4 text-sm text-slate-500">No activity yet.</p>
    <template v-else>
      <div class="relative">
        <div
          class="flex h-40 items-end gap-[2px] border-b border-slate-700"
          role="img"
          :aria-label="`Activity per hour, ${measure === 'value' ? 'gp value' : 'events'}`"
          @mouseleave="hovered = null"
        >
          <div
            v-for="(p, i) in points"
            :key="p.at.toISOString()"
            class="flex h-full min-w-[3px] flex-1 items-end"
            @mouseenter="hovered = i"
          >
            <div
              class="w-full rounded-t-[4px] transition-colors"
              :class="hovered === i ? 'bg-amber-300' : 'bg-amber-500/80'"
              :style="{ height: `${Math.max(1, (p[measure] / max) * 100)}%` }"
            />
          </div>
        </div>
        <div
          v-if="active"
          class="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs shadow-lg"
        >
          <span class="text-slate-400">{{ when(active.at) }}</span>
          <span class="ml-2 font-semibold text-slate-100">{{ active.count }} events</span>
          <span class="ml-2 text-amber-300">{{ formatGp(active.value) }}</span>
        </div>
      </div>
      <div class="relative mt-1 h-4 text-[10px] text-slate-500">
        <span
          v-for="t in ticks"
          :key="t.i"
          class="absolute"
          :style="{ left: `${(t.i / points.length) * 100}%` }"
          >{{ t.label }}</span
        >
      </div>
      <button
        type="button"
        class="mt-1 text-xs text-slate-400 underline"
        @click="showTable = !showTable"
      >
        {{ showTable ? 'Hide table' : 'Show as table' }}
      </button>
      <table v-if="showTable" class="mt-2 w-full text-xs">
        <thead class="text-slate-400">
          <tr>
            <th class="text-left font-medium">Hour</th>
            <th class="text-right font-medium">Events</th>
            <th class="text-right font-medium">Value</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in [...points].reverse()" :key="p.at.toISOString()" class="text-slate-300">
            <td>{{ when(p.at) }}</td>
            <td class="text-right tabular-nums">{{ p.count }}</td>
            <td class="text-right tabular-nums">{{ formatGp(p.value) }}</td>
          </tr>
        </tbody>
      </table>
    </template>
  </div>
</template>
