<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AnimationShelf from '@/components/AnimationShelf.vue'
import CharacterPreview from '@/components/CharacterPreview.vue'
import NpcPicker from '@/components/NpcPicker.vue'
import StylePicker from '@/components/StylePicker.vue'
import { HEADING } from '@/characters/heading'
import {
  ROSTER,
  RUN_FROM_STEPS,
  STYLES,
  defaultAppearance,
  type Appearance,
  type Style,
} from '@/characters/roster'
import { teamId as toTeamId, type TeamId } from '@/domain/ids'
import { useCharacterStore } from '@/stores/characters'
import { useGameStore } from '@/stores/game'
import { useTeamStore } from '@/stores/team'
import { teamColor } from '@/ui/colors'
import { TtButton, TtPanel, TtText } from '@/ui/tt'

// How each team's piece looks: any OSRS NPC built like a player, and how it stands, walks, runs and
// swims. Anyone can look at teams and try looks on; a team logged in with its code saves its own.
// The dev tools link here with ?team=<id>.

const characters = useCharacterStore()
const game = useGameStore()
const my = useTeamStore()
const route = useRoute()

const fromQuery = route.query.team === undefined ? NaN : Number(route.query.team)
const teamId = ref<TeamId | null>(Number.isInteger(fromQuery) ? toTeamId(fromQuery) : my.teamId)
const team = computed(() => (teamId.value === null ? null : game.state?.teams.get(teamId.value)))
const teams = computed(() => [...(game.state?.teams.values() ?? [])])
const canSave = computed(() => characters.canDress(teamId.value))

const saved = computed(() => (teamId.value === null ? null : characters.appearanceOf(teamId.value)))
const draft = ref<Appearance>(defaultAppearance())
// Start from the team's saved look whenever another team is picked, or once the state arrives.
watch(
  [teamId, () => saved.value !== null],
  () => {
    draft.value = { ...(saved.value ?? defaultAppearance()) }
  },
  { immediate: true },
)
const unsaved = computed(() => JSON.stringify(saved.value) !== JSON.stringify(draft.value))

function save() {
  if (canSave.value) void characters.setAppearance({ ...draft.value })
}
async function backToBird() {
  if (canSave.value && (await characters.setAppearance(null))) draft.value = defaultAppearance()
}

const STYLE_TITLES: Record<Style, string> = {
  idle: 'Standing',
  walk: `Walking (under ${RUN_FROM_STEPS} steps)`,
  run: `Running (${RUN_FROM_STEPS}+ steps)`,
  swim: 'Swimming (at sea)',
}

const HEADINGS = [
  { value: HEADING.south, label: '↓ South' },
  { value: HEADING.west, label: '← West' },
  { value: HEADING.north, label: '↑ North' },
  { value: HEADING.east, label: 'East →' },
]
const heading = ref<number>(HEADING.south)
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div class="mx-auto flex max-w-[1440px] flex-col gap-1.5">
      <TtPanel variant="iron" :padding="6" :gap="3">
        <TtText as="h2" :size="3" font="quill" color="orange" glow>Characters</TtText>
        <TtText :size="1" color="white">
          Pick any OSRS NPC built like a player, then how it stands, walks, runs and swims. On the
          board it also cheers, sulks and fools around on its own. Anyone can try looks on here; a
          team logged in with its code saves its own.
        </TtText>
        <div class="flex flex-wrap gap-1.5">
          <TtButton
            v-for="t in teams"
            :key="t.id"
            size="sm"
            :selected="teamId === t.id"
            @click="teamId = t.id"
          >
            <span :style="{ color: teamColor(t) }">{{ t.name }}</span>
          </TtButton>
        </div>
      </TtPanel>

      <div class="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <TtPanel :padding="12" :gap="9">
          <template #title>
            <span :style="{ color: team ? teamColor(team) : undefined }">
              {{ team ? team.name : 'Preview' }}
            </span>
          </template>
          <div class="flex flex-wrap justify-center gap-1.5">
            <CharacterPreview
              v-for="style in STYLES"
              :key="style"
              :npc="draft.npc"
              :anim="draft[style]"
              :heading="heading"
              :width="44"
              :height="56"
              :scale="2"
            />
          </div>
          <div class="flex flex-wrap justify-center gap-1.5">
            <TtButton
              v-for="h in HEADINGS"
              :key="h.value"
              size="sm"
              :selected="heading === h.value"
              @click="heading = h.value"
            >
              {{ h.label }}
            </TtButton>
          </div>
          <NpcPicker :selected="draft.npc" @pick="draft.npc = $event" />
        </TtPanel>

        <TtPanel :padding="12" :gap="9">
          <section v-for="style in STYLES" :key="style" class="flex flex-col gap-1">
            <h3 class="tt-bold" style="color: var(--osrs-orange)">{{ STYLE_TITLES[style] }}</h3>
            <StylePicker
              v-model="draft[style]"
              :npc="draft.npc"
              :options="ROSTER.styles[style]"
              :heading="heading"
            />
          </section>
        </TtPanel>
      </div>

      <!-- Saving takes the whole look: the character and every animation picked above. -->
      <TtPanel :padding="9" :gap="6">
        <form
          v-if="team && canSave"
          class="flex flex-wrap items-center justify-center gap-1.5"
          @submit.prevent="save"
        >
          <TtButton type="submit" :disabled="!unsaved || characters.saving">
            Save {{ team.name }}’s look
          </TtButton>
          <TtButton v-if="saved" size="sm" :disabled="characters.saving" @click="backToBird">
            Back to a bird
          </TtButton>
        </form>
        <TtText v-else :size="1" color="cyan">
          {{
            team
              ? `Log in as ${team.name} to change its look.`
              : 'Log in as your team to save a look.'
          }}
        </TtText>
        <TtText
          v-if="canSave && characters.message"
          :size="1"
          :color="characters.message.tone === 'ok' ? 'green' : 'red'"
        >
          {{ characters.message.text }}
        </TtText>
      </TtPanel>

      <TtPanel title="On its own" :padding="12" :gap="9">
        <TtText :size="1" color="white">
          These play by themselves: one from the pool when the moment comes, and now and then an
          emote while standing around. Hover one for its name.
        </TtText>
        <AnimationShelf :npc="draft.npc" :heading="heading" />
      </TtPanel>
    </div>
  </div>
</template>
