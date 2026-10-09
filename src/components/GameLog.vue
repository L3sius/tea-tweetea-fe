<script setup lang="ts">
import { computed } from 'vue'
import { describeEvent, teamParts, type Names, type TextPart } from '@/domain/describe'
import type { JournalEntry } from '@/domain/events'
import type { Team } from '@/domain/game'
import type { TeamId } from '@/domain/ids'
import { teamColor } from '@/ui/colors'
import { timeFrom } from '@/ui/format'
import { TtPanel, TtText } from '@/ui/tt'

// What happened, newest first: one block per journal entry (everything that happened together),
// its lines left-aligned with team names in their colours, and a Watch link on moves.

const props = defineProps<{
  log: readonly JournalEntry[]
  names: Names
  teams: ReadonlyMap<TeamId, Team>
  now: Date
  /** Hides entries until their animations have played, so the log never spoils a walk. */
  revealed?: (entry: JournalEntry) => boolean
}>()
const emit = defineEmits<{ watch: [seq: number] }>()

const MAX_ENTRIES = 40

/** Events that start a move worth watching again: a walk or a teleport. */
const MOVE_STARTS = new Set(['move_confirmed', 'teleported'])

type Block = { seq: number; at: Date; lines: TextPart[][]; watch: boolean }

/** Newest first, bookkeeping events left out. */
const blocks = computed(() => {
  void props.now // re-check what has been revealed as time passes
  const teams = [...props.teams.values()]
  const out: Block[] = []
  for (const entry of [...props.log].reverse()) {
    if (props.revealed && !props.revealed(entry)) continue
    const lines = entry.events
      .map((event) => describeEvent(event, props.names))
      .filter((text): text is string => text !== null)
      .map((text) => teamParts(text, teams))
    if (lines.length === 0) continue
    const watch = entry.events.some((e) => MOVE_STARTS.has(e.kind))
    out.push({ seq: entry.seq, at: entry.at, lines, watch })
    if (out.length >= MAX_ENTRIES) break
  }
  return out
})

const colorOf = (id: TeamId | null) => {
  const team = id === null ? undefined : props.teams.get(id)
  return team ? teamColor(team) : undefined
}
</script>

<template>
  <TtPanel title="Game log" width="100%" :padding="12" :gap="6" class="min-h-full">
    <TtText v-if="blocks.length === 0" :size="1" color="muted">Nothing has happened yet.</TtText>
    <ol v-else class="flex w-full flex-col gap-1.5 text-left">
      <li v-for="(block, i) in blocks" :key="block.seq" class="flex flex-col gap-0.5">
        <div class="flex items-baseline justify-between gap-2">
          <time
            class="log-time"
            :datetime="block.at.toISOString()"
            :title="block.at.toLocaleString()"
          >
            {{ timeFrom(block.at, now) }}
          </time>
          <button
            v-if="block.watch"
            type="button"
            class="tt-link tt-1 shrink-0"
            title="Watch this move again on the map"
            @click="emit('watch', block.seq)"
          >
            ▶ Watch
          </button>
        </div>
        <p v-for="(line, j) in block.lines" :key="j" class="tt-1 log-line">
          <span
            v-for="(part, k) in line"
            :key="k"
            :style="part.team === null ? undefined : { color: colorOf(part.team) }"
            >{{ part.text }}</span
          >
        </p>
        <div v-if="i < blocks.length - 1" class="tt-rule mt-1 w-full" />
      </li>
    </ol>
  </TtPanel>
</template>

<style scoped>
/* When it happened, small above the lines: the native 16px step of the pixel font. */
.log-time {
  color: var(--text-muted);
  font-family: var(--font-small);
  font-size: 16px;
  line-height: 1;
  text-shadow: 1px 1px 0 #000;
}
.log-line {
  color: var(--osrs-white);
  overflow-wrap: anywhere;
}
</style>
