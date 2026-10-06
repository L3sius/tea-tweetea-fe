<script setup lang="ts">
import { computed } from 'vue'
import { describeEvent, type Names } from '@/domain/describe'
import type { JournalEntry } from '@/domain/events'
import { timeFrom } from '@/ui/format'

const props = defineProps<{
  log: readonly JournalEntry[]
  names: Names
  now: Date
  /** Hides entries until their animations have played, so the log never spoils a walk. */
  revealed?: (entry: JournalEntry) => boolean
}>()

const MAX_LINES = 60

/** Newest first, bookkeeping events left out. */
const lines = computed(() => {
  void props.now // re-check what has been revealed as time passes
  const out: { key: string; at: Date; text: string }[] = []
  for (const entry of [...props.log].reverse()) {
    if (props.revealed && !props.revealed(entry)) continue
    entry.events.forEach((event, i) => {
      const text = describeEvent(event, props.names)
      if (text !== null) out.push({ key: `${entry.seq}.${i}`, at: entry.at, text })
    })
    if (out.length >= MAX_LINES) break
  }
  return out.slice(0, MAX_LINES)
})
</script>

<template>
  <section class="flex min-h-0 flex-col rounded-xl border border-slate-700/60 bg-slate-900/70">
    <h2 class="border-b border-slate-800 px-4 py-3 font-semibold">Game log</h2>
    <p v-if="lines.length === 0" class="px-4 py-6 text-sm text-slate-500">
      Nothing has happened yet.
    </p>
    <ol v-else class="min-h-0 flex-1 divide-y divide-slate-800/70 overflow-y-auto">
      <li v-for="line in lines" :key="line.key" class="flex gap-3 px-4 py-2 text-sm">
        <span class="flex-1 text-slate-200">{{ line.text }}</span>
        <time
          class="shrink-0 text-xs text-slate-500"
          :datetime="line.at.toISOString()"
          :title="line.at.toLocaleString()"
        >
          {{ timeFrom(line.at, now) }}
        </time>
      </li>
    </ol>
  </section>
</template>
