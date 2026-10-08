<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import { loadNpcs, type NpcLook } from '@/characters/assets'
import { ROSTER } from '@/characters/roster'
import { TtButton } from '@/ui/tt'

// Finds an NPC among every one rigged like a player, by name or id.

const props = defineProps<{ selected: number }>()
const emit = defineEmits<{ pick: [npc: number] }>()

const SHOWN = 40

const npcs = shallowRef<NpcLook[]>([])
const failed = ref(false)
const query = ref('')

onMounted(async () => {
  try {
    npcs.value = (await loadNpcs()).npcs
  } catch {
    failed.value = true
  }
})

/** Any NPC but the one already picked, for when nothing comes to mind. */
function pickRandom() {
  const others = npcs.value.filter((npc) => npc.id !== props.selected)
  const npc = others[Math.floor(Math.random() * others.length)]
  if (npc) emit('pick', npc.id)
}

const matches = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (q === '') {
    const featured = new Set(ROSTER.featured)
    return npcs.value.filter((npc) => featured.has(npc.id))
  }
  const id = Number(q)
  return npcs.value
    .filter((npc) => npc.name.toLowerCase().includes(q) || npc.id === id)
    .slice(0, SHOWN)
})
/** The matches, with the picked NPC on top when it isn't among them (a random pick, say). */
const results = computed(() => {
  const picked = npcs.value.find((npc) => npc.id === props.selected)
  return picked && !matches.value.includes(picked) ? [picked, ...matches.value] : matches.value
})
</script>

<template>
  <div class="flex min-h-0 flex-col gap-1.5">
    <div class="flex gap-1.5">
      <input
        v-model="query"
        type="search"
        class="tt-input min-w-0 flex-1"
        :placeholder="`Search ${npcs.length || ''} NPCs by name or id`"
        aria-label="Search NPCs"
      />
      <TtButton v-if="npcs.length" size="sm" class="!min-w-0 shrink-0" @click="pickRandom">
        Random
      </TtButton>
    </div>
    <p v-if="failed" style="color: var(--osrs-red)">Couldn't load the NPC list.</p>
    <ul class="tt-1 flex max-h-72 flex-col overflow-y-auto">
      <li v-for="npc in results" :key="npc.id">
        <button
          type="button"
          class="npc-row w-full text-left"
          :class="{ 'npc-row-on': npc.id === selected }"
          @click="emit('pick', npc.id)"
        >
          {{ npc.name }}
          <span style="color: var(--text-muted)">
            <template v-if="npc.combat > 0">lvl {{ npc.combat }} · </template>#{{ npc.id }}
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.npc-row {
  padding: 2px 6px;
  color: var(--osrs-yellow);
}
.npc-row:hover {
  background: rgb(255 255 255 / 0.08);
}
.npc-row-on {
  color: var(--osrs-white);
  background: rgb(255 152 31 / 0.25);
}
</style>
