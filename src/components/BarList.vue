<script setup lang="ts">
import { computed } from 'vue'
import { TtText } from '@/ui/tt'

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
  <TtText v-if="rows.length === 0" :size="1" color="muted">{{ empty ?? 'No data yet.' }}</TtText>
  <ol v-else class="flex w-full flex-col gap-1">
    <li
      v-for="(row, i) in rows"
      :key="row.key"
      class="grid grid-cols-[1.75rem_minmax(0,13rem)_1fr_4.5rem] items-center gap-2"
      :title="
        row.note ? `${row.label}: ${row.display} · ${row.note}` : `${row.label}: ${row.display}`
      "
    >
      <TtText :size="1" color="orange" align="right" block>{{ i + 1 }}.</TtText>
      <TtText
        :size="1"
        :font="row.color ? 'bold' : 'small'"
        :color="row.color ?? 'white'"
        align="left"
        block
        class="truncate"
      >
        {{ row.label }}
      </TtText>
      <span class="h-[18px]" aria-hidden="true">
        <span
          class="block h-full border-2 border-black transition-[width] duration-500 ease-[steps(6)]"
          :style="{
            width: `max(9px, ${(row.value / max) * 100}%)`,
            background: row.color ?? 'var(--osrs-orange)',
          }"
        />
      </span>
      <TtText :size="1" align="right" block>{{ row.display }}</TtText>
    </li>
  </ol>
</template>
