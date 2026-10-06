<script setup lang="ts">
import { computed } from 'vue'

export type BarRow = {
  key: string
  label: string
  value: number
  display: string
  color?: string
  note?: string
}

const props = defineProps<{ rows: readonly BarRow[]; empty?: string }>()

const max = computed(() => Math.max(1, ...props.rows.map((r) => r.value)))
</script>

<template>
  <p v-if="rows.length === 0" class="py-4 text-sm text-slate-500">{{ empty ?? 'No data yet.' }}</p>
  <ol v-else class="flex flex-col gap-1.5">
    <li
      v-for="(row, i) in rows"
      :key="row.key"
      class="grid grid-cols-[1.5rem_minmax(0,9rem)_1fr_auto] items-center gap-2 text-sm"
      :title="
        row.note ? `${row.label}: ${row.display} · ${row.note}` : `${row.label}: ${row.display}`
      "
    >
      <span class="text-right text-xs text-slate-500 tabular-nums">{{ i + 1 }}</span>
      <span class="flex items-center gap-1.5 truncate text-slate-200">
        <span
          v-if="row.color"
          class="size-2 shrink-0 rounded-full"
          :style="{ background: row.color }"
          aria-hidden="true"
        />
        <span class="truncate">{{ row.label }}</span>
      </span>
      <span class="h-3 overflow-hidden" aria-hidden="true">
        <span
          class="block h-full rounded-r-[4px] transition-[width] duration-500"
          :style="{ width: `${(row.value / max) * 100}%`, background: row.color ?? '#f59e0b' }"
        />
      </span>
      <span class="w-16 text-right text-slate-300 tabular-nums">{{ row.display }}</span>
    </li>
  </ol>
</template>
