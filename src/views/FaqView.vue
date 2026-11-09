<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useDinkStore } from '@/stores/dink'
import { useGameStore } from '@/stores/game'
import { TtPanel, TtText } from '@/ui/tt'

// How Tweetea works and the questions players ask; the Dink setup has its own dialog. Every number comes from the
// server's rules and board, as everywhere on the site.

const game = useGameStore()
const dink = useDinkStore()

const gems = computed(() => game.board?.continents.length ?? 8)
const hours = (h: number) => (h === 1 ? '1 hour' : `${h} hours`)
/** "1 time in 5" reads better than "20%", when the chance is one. */
const chance = (p: number) => {
  const n = Math.round(1 / p)
  return Math.abs(n * p - 1) < 1e-9 ? `1 time in ${n}` : `${Math.round(p * 100)}% of the time`
}
const rules = computed(() => {
  const r = game.rules
  return r
    ? {
        inventory: r.inventoryLimit,
        eventChance: r.randomEventChance > 0 ? chance(r.randomEventChance) : null,
        minigameChance: r.minigameChance > 0 ? chance(r.minigameChance) : null,
        initiatorGold: r.initiatorMultiplier === 2 ? 'double' : `${r.initiatorMultiplier} times the`,
        blockerRange: r.blockerRange,
        blockersPerTeam: r.blockersPerTeam,
        blockerLife: hours(r.blockerLifetimeHours),
        shield: hours(r.shieldHours),
      }
    : null
})
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div class="mx-auto flex max-w-[960px] flex-col gap-1.5">
      <TtPanel variant="iron" :padding="6" :gap="3">
        <TtText as="h2" :size="3" font="quill" color="orange" glow>FAQ</TtText>
        <TtText :size="1" color="white">
          How Tweetea works, and answers to common questions. For a guided tour of the board, press
          <b>Tutorial</b> at the top; to set up the Dink plugin, press <b>Dink</b>.
        </TtText>
      </TtPanel>

      <TtPanel title="The goal" :padding="12" :gap="6">
        <TtText :size="1" color="white" align="left">
          Gielinor has {{ gems }} continents, and each one hides a magic gem. The first team to
          collect all {{ gems }} gems wins. If time runs out first, the team with the most gems
          wins; gold, then completed tiles, settle a tie.
        </TtText>
      </TtPanel>

      <TtPanel title="A turn" :padding="12" :gap="6">
        <ol class="faq-list">
          <li>
            <TtText :size="1" color="white" align="left">
              <b>Complete your tile.</b> Every tile on the road is an OSRS task. Everyone on your
              team adds to it, through Dink. Hover a tile on the board to read its task.
            </TtText>
          </li>
          <li>
            <TtText :size="1" color="white" align="left">
              <b>Use a power-up</b> if you want: one item per tile, after you complete it and before
              you draw.
            </TtText>
          </li>
          <li>
            <TtText :size="1" color="white" align="left">
              <b>Draw a card.</b> It says how many tiles you walk: its number, with J, Q and K as
              11, 12 and 13, and an Ace as 14. A 7 or an Ace also gives a free item. A Joker moves
              you 1 tile and brings bad luck: you may lose a gem, half your gold, or be teleported.
            </TtText>
          </li>
          <li>
            <TtText :size="1" color="white" align="left">
              <b>Walk.</b> Pick a path of exactly that many tiles; you can't step straight back.
              Walking onto a gem picks it up, and passing a shop lets you stop to buy. Where you
              land is your next tile.
            </TtText>
          </li>
        </ol>
      </TtPanel>

      <TtPanel title="The board" :padding="12" :gap="6">
        <TtText :size="1" color="white" align="left">
          <b>Minigames</b> open when a team lands on a <b>red tile</b><template
            v-if="rules?.minigameChance"
            >, and {{ rules.minigameChance }} when it lands on an ordinary one</template
          >. Every team can take part while one runs, and they pay out gold. The team that opened it
          earns {{ rules?.initiatorGold ?? 'extra' }} gold.
        </TtText>
        <TtText :size="1" color="white" align="left">
          <b>Shops</b> each sell a few items, and every shop sells the mystery box. Prices and what
          each item does are on the <RouterLink to="/items" class="tt-link">Items</RouterLink> page.
        </TtText>
        <TtText v-if="rules?.eventChance" :size="1" color="white" align="left">
          <b>Random events</b> can happen when you land on an ordinary tile ({{ rules.eventChance }}):
          some help, some don't.
        </TtText>
      </TtPanel>

      <TtPanel title="Items, blockers and spells" :padding="12" :gap="6">
        <TtText v-if="rules" :size="1" color="white" align="left">
          A team holds at most {{ rules.inventory }} items; a free item that doesn't fit is lost.
          Your items are secret from the other teams.
        </TtText>
        <TtText v-if="rules" :size="1" color="white" align="left">
          <b>Blockers</b> (Banana, Harpie bug swarm, Snake charmer, Wilderness web) go on a free
          tile up to {{ rules.blockerRange }} tiles away and stay for {{ rules.blockerLife }}. Every
          team that walks onto one stops there and is stuck for a while, the team that placed it
          too. A team can have {{ rules.blockersPerTeam }} out at once.
        </TtText>
        <TtText v-if="rules" :size="1" color="white" align="left">
          <b>Spells and attacks</b> (Ice Barrage, Entangle, the Handegg, Morrigan's throwing axe)
          hit a rival. The team hit can't be targeted again for {{ rules.shield }}.
        </TtText>
        <TtText :size="1" color="white" align="left">
          While <b>stuck</b>, a team can't draw or use items. A held
          <b>Protect from Magic</b> cancels the next hold, but a blocker still ends your walk.
        </TtText>
      </TtPanel>

      <TtPanel title="Questions" :padding="12" :gap="9">
        <div class="faq-qa">
          <TtText :size="1" color="orange" align="left">My drops don't show up.</TtText>
          <TtText :size="1" color="white" align="left">
            Check the
            <button type="button" class="tt-link" @click="dink.show()">Dink setup</button>, and that
            your account is on your team's roster on the
            <RouterLink to="/teams" class="tt-link">Teams</RouterLink> page. Alts count too, once
            they are added. If yours is missing, ask an organiser.
          </TtText>
        </div>
        <div class="faq-qa">
          <TtText :size="1" color="orange" align="left">
            My combat achievement doesn't count.
          </TtText>
          <TtText :size="1" color="white" align="left">
            Dink only sees a combat achievement the game announces, and the game doesn't announce
            one you already have. If you completed that task before, turn on
            <b>Combat Achievement Tasks</b> and allow <b>repeat completion</b> in the OSRS settings,
            as in the last step of the
            <button type="button" class="tt-link" @click="dink.show()">Dink setup</button>. A task
            you don't have yet counts without it.
          </TtText>
        </div>
        <div class="faq-qa">
          <TtText :size="1" color="orange" align="left">
            How do I find the spot for a clue location task?
          </TtText>
          <TtText :size="1" color="white" align="left">
            Turn on the <b>World Location</b> RuneLite plugin with its <b>Region Lines</b> setting.
            It divides the world map into regions, which helps you pinpoint the spot a task names.
          </TtText>
        </div>
        <div class="faq-qa">
          <TtText :size="1" color="orange" align="left">Is pre-stacking allowed?</TtText>
          <TtText :size="1" color="white" align="left">
            Yes. You may save up rewards before the start and open them during the event: clue
            caskets, Soul Wars crates, Tempoross, Wintertodt, Vale Totems, Guardians of the Rift and
            the like. What you get when you open them counts.
          </TtText>
        </div>
        <div class="faq-qa">
          <TtText :size="1" color="orange" align="left">Who moves our team?</TtText>
          <TtText :size="1" color="white" align="left">
            Anyone with your team's code. Log in with it on the board to draw, walk, shop and use
            items.
          </TtText>
        </div>
        <div class="faq-qa">
          <TtText :size="1" color="orange" align="left">A task can't be seen by Dink.</TtText>
          <TtText :size="1" color="white" align="left">
            Some can't, like a pet Dink can't name. Tell an organiser: they can complete the tile
            for your team.
          </TtText>
        </div>
        <div class="faq-qa">
          <TtText :size="1" color="orange" align="left">The drop just won't come.</TtText>
          <TtText :size="1" color="white" align="left">
            Some drop tiles have a way out: the tile also completes after enough kills, even without
            the drop. The task says how many, as in "… or kill Zulrah 525 times".
          </TtText>
        </div>
        <div class="faq-qa">
          <TtText :size="1" color="orange" align="left">Our minigame didn't count.</TtText>
          <TtText :size="1" color="white" align="left">
            Some minigames count only on one game world, and the task ends by naming it, as in "Play
            on world 519". Games played on other worlds don't count.
          </TtText>
        </div>
      </TtPanel>
    </div>
  </div>
</template>

<style scoped>
.faq-list {
  margin: 0;
  text-align: left;
  padding-left: 1.6em;
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  list-style: decimal;
  color: var(--osrs-orange);
  font-family: var(--font-bold);
}
b {
  color: var(--osrs-yellow);
  font-weight: normal;
}
.faq-qa {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
}
</style>
