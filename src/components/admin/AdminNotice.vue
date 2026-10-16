<script setup lang="ts">
import { computed } from 'vue'

/** One line of admin feedback: a result, a warning, or a refusal. All look alike but for colour. */
const props = defineProps<{ tone: 'ok' | 'warn' | 'error' }>()

const COLOR = { ok: 'var(--osrs-green)', warn: 'var(--osrs-orange)', error: 'var(--osrs-red)' }
const color = computed(() => COLOR[props.tone])
</script>

<template>
  <p
    class="admin-notice tt-1"
    :role="tone === 'error' ? 'alert' : 'status'"
    :style="{ '--tone': color }"
  >
    <slot />
  </p>
</template>

<style scoped>
.admin-notice {
  margin: 0;
  padding: 6px 12px;
  border-left: 3px solid var(--tone);
  background: rgb(0 0 0 / 0.25);
  color: var(--tone);
  text-align: left;
  overflow-wrap: anywhere;
}
</style>
