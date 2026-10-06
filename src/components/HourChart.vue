<script setup lang="ts">
import { computed, ref } from 'vue'
import type { StatRow } from '@/domain/activity'
import { formatGp } from '@/ui/format'
import { TtText } from '@/ui/tt'

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
  <div class="w-full">
    <TtText v-if="points.length === 0" :size="1" color="muted">No activity yet.</TtText>
    <template v-else>
      <div class="relative">
        <div
          class="tt-sprite-display box-border flex h-48 items-end gap-[3px] !px-1.5 !pt-6 !pb-1"
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
              class="w-full border-2 border-b-0 border-black"
              :style="{
                height: `${Math.max(1, (p[measure] / max) * 100)}%`,
                background: hovered === i ? 'var(--osrs-yellow)' : 'var(--osrs-orange)',
              }"
            />
          </div>
        </div>
        <div
          v-if="active"
          class="pointer-events-none absolute top-1 left-1/2 flex -translate-x-1/2 gap-2 border-[3px] border-black bg-[var(--tooltip-bg)] px-1.5 whitespace-nowrap shadow-[3px_3px_0_#000]"
        >
          <TtText :size="1" color="white">{{ when(active.at) }}</TtText>
          <TtText :size="1">{{ active.count }} events</TtText>
          <TtText :size="1" color="cash">{{ formatGp(active.value) }}</TtText>
        </div>
      </div>
      <div class="relative mt-1 h-5">
        <TtText
          v-for="t in ticks"
          :key="t.i"
          :size="1"
          color="muted"
          class="absolute"
          :style="{ left: `${(t.i / points.length) * 100}%` }"
        >
          {{ t.label }}
        </TtText>
      </div>
      <button type="button" class="tt-link tt-1 mt-1" @click="showTable = !showTable">
        {{ showTable ? 'Hide table' : 'Show as table' }}
      </button>
      <table v-if="showTable" class="tt-1 mt-2 w-full">
        <thead style="color: var(--osrs-orange)">
          <tr>
            <th class="text-left font-normal">Hour</th>
            <th class="text-right font-normal">Events</th>
            <th class="text-right font-normal">Value</th>
          </tr>
        </thead>
        <tbody style="color: var(--osrs-white)">
          <tr v-for="p in [...points].reverse()" :key="p.at.toISOString()">
            <td>{{ when(p.at) }}</td>
            <td class="text-right">{{ p.count }}</td>
            <td class="text-right" style="color: var(--osrs-yellow)">{{ formatGp(p.value) }}</td>
          </tr>
        </tbody>
      </table>
    </template>
  </div>
</template>
