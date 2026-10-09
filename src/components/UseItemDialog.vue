<script setup lang="ts">
import { computed } from 'vue'
import { itemName, useQuestion } from '@/domain/describe'
import { itemEntry } from '@/domain/items'
import { useGameStore } from '@/stores/game'
import type { PendingUse } from '@/stores/team'
import { TtText } from '@/ui/tt'
import ConfirmDialog from './ConfirmDialog.vue'
import ItemSlot from './ItemSlot.vue'

/** Asks the captain before an item is used, saying what it does in the catalogue's words. */
const props = defineProps<{ use: PendingUse }>()
const emit = defineEmits<{ confirm: []; cancel: [] }>()

const game = useGameStore()

const question = computed(() => {
  const target = props.use.target
  const rival = target?.kind === 'team' ? game.names.team(target.teamId) : null
  return useQuestion(props.use.item, rival)
})
</script>

<template>
  <ConfirmDialog
    title="Use item"
    :question="question"
    :note="itemEntry(use.item).description"
    @confirm="emit('confirm')"
    @cancel="emit('cancel')"
  >
    <div class="flex flex-col items-center gap-1">
      <ItemSlot :item="use.item" :size="76" />
      <TtText :size="2" color="orange">{{ itemName(use.item) }}</TtText>
    </div>
  </ConfirmDialog>
</template>
