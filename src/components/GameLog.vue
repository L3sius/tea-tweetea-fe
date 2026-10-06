<script setup lang="ts">
import { computed } from 'vue'
import { describeEvent, type Names } from '@/domain/describe'
import type { JournalEntry } from '@/domain/events'
import { timeFrom } from '@/ui/format'
import { TtDivider, TtPanel, TtText } from '@/ui/tt'

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
  <TtPanel title="Game log" width="100%" :padding="12" :gap="6" class="min-h-full">
    <TtText v-if="lines.length === 0" :size="1" color="muted">Nothing has happened yet.</TtText>
    <ol v-else class="flex w-full flex-col gap-1.5">
      <li v-for="(line, i) in lines" :key="line.key" class="flex flex-col items-center gap-1.5">
        <p class="flex flex-wrap items-baseline justify-center gap-x-2">
          <time :datetime="line.at.toISOString()" :title="line.at.toLocaleString()">
            <TtText :size="1" color="muted">{{ timeFrom(line.at, now) }}</TtText>
          </time>
          <TtText :size="1" color="white">{{ line.text }}</TtText>
        </p>
        <TtDivider v-if="i < lines.length - 1" length="80%" style="opacity: 0.6" />
      </li>
    </ol>
  </TtPanel>
</template>
