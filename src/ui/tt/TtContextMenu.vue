<script setup lang="ts">
import { ref, type PropType } from 'vue'
import { px } from './util'

export type MenuOption = {
  verb: string
  target?: string
  targetColor?: string
  /** Shown greyed out with this reason as its tooltip; it can't be picked. */
  disabled?: string | null
}

defineProps({
  title: { type: String, default: 'Choose Option' },
  options: { type: Array as PropType<readonly MenuOption[]>, default: () => [] },
  width: { type: [Number, String], default: undefined },
})
const emit = defineEmits<{ select: [option: MenuOption, index: number] }>()
const hi = ref(-1)
</script>

<template>
  <div
    role="menu"
    :style="{
      width: px(width),
      minWidth: '180px',
      display: 'inline-flex',
      flexDirection: 'column',
      background: 'var(--tooltip-bg)',
      border: '3px solid #000',
      boxShadow: '6px 6px 0 #000',
    }"
  >
    <div
      style="
        background: #000;
        padding: 3px 6px;
        font-family: var(--font-bold);
        font-size: var(--fs-1);
        line-height: 1.125;
        color: var(--tooltip-bg);
        text-align: left;
      "
    >
      {{ title }}
    </div>
    <button
      v-for="(o, i) in options"
      :key="i"
      type="button"
      role="menuitem"
      :aria-disabled="!!o.disabled"
      :title="o.disabled ?? undefined"
      style="
        padding: 3px 6px;
        font-family: var(--font-bold);
        font-size: var(--fs-1);
        line-height: 1.125;
        text-shadow: 1px 1px 0 #000;
        text-align: left;
        white-space: nowrap;
      "
      :style="{ cursor: o.disabled ? 'default' : 'pointer', opacity: o.disabled ? 0.55 : 1 }"
      @mouseenter="hi = i"
      @mouseleave="hi = -1"
      @focus="hi = i"
      @blur="hi = -1"
      @click="!o.disabled && emit('select', o, i)"
    >
      <span
        :style="{ color: hi === i && !o.disabled ? 'var(--osrs-yellow)' : 'var(--osrs-white)' }"
        >{{ o.verb }}</span
      >
      <span v-if="o.target" :style="{ color: o.targetColor || 'var(--osrs-orange)' }">{{
        ` ${o.target}`
      }}</span>
    </button>
  </div>
</template>
