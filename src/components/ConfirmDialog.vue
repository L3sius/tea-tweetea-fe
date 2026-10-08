<script setup lang="ts">
import { onMounted, onBeforeUnmount, useTemplateRef } from 'vue'
import { TtButton, TtPanel, TtText } from '@/ui/tt'

/**
 * An OSRS-style yes/no question over the whole page, like the game's "destroy this object?"
 * dialog. No has the focus, so Enter never confirms by accident; Escape and a click outside
 * answer no.
 */
withDefaults(
  defineProps<{
    title: string
    /** The question itself, in a sentence. */
    question: string
    /** A warning under the question, such as that it can't be undone. */
    note?: string
    confirmLabel?: string
    cancelLabel?: string
  }>(),
  { note: undefined, confirmLabel: 'Yes', cancelLabel: 'No' },
)
const emit = defineEmits<{ confirm: []; cancel: [] }>()

const no = useTemplateRef<InstanceType<typeof TtButton>>('no')
const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape') emit('cancel')
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  ;(no.value?.$el as HTMLElement | undefined)?.focus()
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div class="confirm-overlay" @click.self="emit('cancel')">
      <TtPanel
        variant="iron"
        :title="title"
        width="min(400px, calc(100vw - 32px))"
        :padding="15"
        :gap="12"
        role="alertdialog"
        aria-modal="true"
        :aria-label="title"
      >
        <!-- What is at stake, like the item shown in the game's dialog. -->
        <slot />
        <TtText :size="2" color="white" align="center">{{ question }}</TtText>
        <TtText v-if="note" :size="1" color="orange" align="center">{{ note }}</TtText>
        <div class="flex justify-center gap-3">
          <TtButton @click="emit('confirm')">{{ confirmLabel }}</TtButton>
          <TtButton ref="no" @click="emit('cancel')">{{ cancelLabel }}</TtButton>
        </div>
      </TtPanel>
    </div>
  </Teleport>
</template>

<style scoped>
.confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgb(0 0 0 / 0.55);
}
</style>
