<script setup lang="ts">
import type { Team } from '@/domain/game'
import { teamColor } from '@/ui/colors'
import { TtText } from '@/ui/tt'

// One team on the map's team strip, or in its folded list: the name in the team's colour, and
// the followed team outlined in it.
defineProps<{ team: Team; selected: boolean }>()
defineEmits<{ click: [] }>()
</script>

<template>
  <button
    type="button"
    class="tt-sprite-display tt-press relative px-2 whitespace-nowrap hover:brightness-[1.18]"
    :class="{ 'tt-pressed': selected }"
    :aria-pressed="selected"
    :title="`Follow ${team.name}`"
    @click="$emit('click')"
  >
    <TtText :size="1" font="bold" :color="teamColor(team)">{{ team.name }}</TtText>
    <span
      v-if="selected"
      class="tt-select-ring"
      :style="{ '--ring-color': teamColor(team) }"
      aria-hidden="true"
    />
  </button>
</template>
