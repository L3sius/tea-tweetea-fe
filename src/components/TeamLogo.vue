<script setup lang="ts">
import { computed } from 'vue'
import type { Team } from '@/domain/game'
import { teamLogo } from '@/ui/teamLogos'

// A team's logo. Teams send images of any size and shape, so every logo fits the same square box,
// no wider than its panel. Nothing shows for a team without one.

const props = defineProps<{ team: Pick<Team, 'name'> }>()

const src = computed(() => teamLogo(props.team))
</script>

<template>
  <img v-if="src" :src="src" :alt="`${team.name} logo`" class="team-logo" />
</template>

<style scoped>
.team-logo {
  display: block;
  width: 240px;
  max-width: 100%;
  aspect-ratio: 1;
  object-fit: contain;
  border: 2px solid #000;
  box-shadow: 2px 2px 0 #000;
}
</style>
