<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import { loadNpcs, type NpcLook } from '@/characters/assets'
import { ROSTER } from '@/characters/roster'

// Finds an NPC among every one rigged like a player, by name or id.

defineProps<{ selected: number }>()
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

const results = computed(() => {
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
</script>

<template>
  <div class="flex min-h-0 flex-col gap-1.5">
    <input
      v-model="query"
      type="search"
      class="tt-input w-full"
      :placeholder="`Search ${npcs.length || ''} NPCs by name or id`"
      aria-label="Search NPCs"
    />
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
