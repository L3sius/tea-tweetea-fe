<script setup lang="ts">
import { computed } from 'vue'
import ItemSlot from '@/components/ItemSlot.vue'
import { ITEM_GROUP, ITEM_GROUPS, itemEntry, mysteryBoxEntry, type ItemGroup } from '@/domain/items'
import { ITEMS, type Item } from '@/domain/vocabulary'
import { useGameStore } from '@/stores/game'
import { TtPanel, TtSlot, TtText } from '@/ui/tt'

const game = useGameStore()

/** How many shops stock each item; every shop sells the mystery box on top. */
const shopCount = computed(() => {
  const counts = new Map<Item, number>()
  for (const stock of game.state?.shops.values() ?? [])
    for (const item of stock) counts.set(item, (counts.get(item) ?? 0) + 1)
  return counts
})

const where = (item: Item) => {
  const n = shopCount.value.get(item) ?? 0
  if (n === 0) return 'Not sold in any shop'
  return `Sold in ${n} ${n === 1 ? 'shop' : 'shops'}`
}

/** Every item, by what it acts on, in the order the power-up menu uses. */
const groups = computed(() =>
  (Object.keys(ITEM_GROUPS) as ItemGroup[]).flatMap((group) => {
    const items = ITEMS.filter((item) => ITEM_GROUP[item] === group).map((item) => ({
      item,
      ...itemEntry(item),
      where: where(item),
    }))
    return items.length ? [{ group, ...ITEM_GROUPS[group], items }] : []
  }),
)

const box = computed(() => mysteryBoxEntry())
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div class="mx-auto flex max-w-[1440px] flex-col gap-1.5">
      <TtPanel variant="iron" :padding="6" :gap="3">
        <TtText as="h2" :size="3" font="quill" color="orange" glow>Items</TtText>
        <TtText :size="1" color="white">
          Shops sell items, and drawing a 7 or an Ace gives one free. A team may use one item on
          each tile, after it completes the tile and before it draws.
        </TtText>
      </TtPanel>

      <TtText v-if="!game.board" :size="1" color="muted">Loading items…</TtText>
      <template v-else>
        <TtPanel :padding="12" :gap="9" title="Mystery box">
          <div class="item-row">
            <TtSlot
              :size="64"
              :icon="box.icon ? undefined : 'mystery-box'"
              :title="box.name"
              :aria-label="box.name"
            >
              <img v-if="box.icon" :src="box.icon" alt="" class="box-picture" />
            </TtSlot>
            <div class="flex min-w-0 flex-col gap-0.5">
              <TtText :size="1" align="left">
                {{ box.name }} · <span style="color: var(--osrs-yellow)">{{ box.price }} gold</span>
              </TtText>
              <TtText :size="1" color="white" align="left">{{ box.description }}</TtText>
            </div>
          </div>
        </TtPanel>

        <div class="grid gap-1.5 md:grid-cols-2">
          <TtPanel v-for="g in groups" :key="g.group" :padding="12" :gap="9" :title="g.label">
            <TtText :size="1" color="muted">{{ g.hint }}</TtText>
            <ul class="flex w-full flex-col gap-2">
              <li v-for="it in g.items" :key="it.item" class="item-row">
                <ItemSlot :item="it.item" :size="64" :hint="it.description" />
                <div class="flex min-w-0 flex-col gap-0.5">
                  <TtText :size="1" align="left">
                    {{ it.name }} ·
                    <span style="color: var(--osrs-yellow)">{{ it.price }} gold</span>
                  </TtText>
                  <TtText :size="1" color="white" align="left">{{ it.description }}</TtText>
                  <TtText :size="1" color="muted" align="left">{{ it.where }}</TtText>
                </div>
              </li>
            </ul>
          </TtPanel>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.item-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}
.box-picture {
  width: 40px;
  height: 40px;
  object-fit: contain;
  filter: drop-shadow(3px 3px 0 #000);
  pointer-events: none;
}
</style>
