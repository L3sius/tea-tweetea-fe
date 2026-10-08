<script lang="ts">
import type { Gem } from '@/domain/vocabulary'

/** What a tile holds, for its scene; how it looks comes from its `TileTheme`. */
export type TileView = {
  regionName: string
  /** The gem of the tile's continent. */
  regionGem: Gem | null
  /** The map around the tile, the tile at its centre (land only; null without one). */
  terrain: string | null
  task: { name: string; description: string } | null
  /** A gem lying on this very tile. */
  gemHere: Gem | null
  blocker: { name: string; icon: string | null; text: string; web: boolean } | null
  /** Teams standing here, with how far they are through the tile's task. */
  teams: {
    name: string
    colour: string
    /** Task progress while the team works on it; null when it isn't working here. */
    done: number | null
    needed: number | null
    finished: boolean
  }[]
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import checkMark from '@/assets/tt/img/boxes/check_box.png'
import type { TileTheme } from '@/map/tileTheme'
import { GEM_NAMES } from '@/ui/tt'

const props = defineProps<{ theme: TileTheme; view: TileView }>()

/** Every team here has finished the task: the scene settles, its work done. */
const finished = computed(
  () => props.view.teams.length > 0 && props.view.teams.every((t) => t.finished),
)
const frame = computed(() => ({
  borderImageSource: `url(${props.theme.frame.url})`,
  borderImageSlice: props.theme.frame.slice,
  borderWidth: `${props.theme.frame.slice * 2}px`,
}))
</script>

<template>
  <div
    class="scene"
    :class="[`env-${theme.environment}`, { finished, blocked: view.blocker?.web }]"
    :style="{ '--region': theme.colour, '--kind': theme.kind.colour }"
  >
    <!-- 1. The environment: the real map around the tile, or open water. -->
    <div class="ground" aria-hidden="true">
      <div
        v-if="theme.environment === 'land' && view.terrain"
        class="terrain"
        :style="{ backgroundImage: `url(${view.terrain})` }"
      />
      <div class="shade" />
      <span v-if="view.gemHere" class="ground-gem tt-sprite" :class="`tt-gem-${view.gemHere}`" />
      <img
        v-if="view.blocker?.web && view.blocker.icon"
        class="web"
        :src="view.blocker.icon"
        alt=""
      />
    </div>
    <div class="frame" :style="frame" aria-hidden="true" />

    <div class="content">
      <!-- 2. Where it is, on one line: crests, region, the continent's gem. -->
      <header class="header" :class="`header-${theme.header}`">
        <div class="crests" aria-hidden="true">
          <span class="pole" />
          <img v-for="crest in theme.crests" :key="crest" :src="crest" alt="" />
        </div>
        <h3 class="place">{{ view.regionName }}</h3>
        <span
          v-if="view.regionGem"
          class="region-gem tt-sprite"
          :class="`tt-gem-${view.regionGem}`"
          :title="`${GEM_NAMES[view.regionGem]} lands`"
        />
      </header>

      <!-- 3. The task, on parchment. -->
      <section class="panel">
        <template v-if="view.task">
          <h4 class="task-name">{{ view.task.name }}</h4>
          <p class="task-text">{{ view.task.description }}</p>
        </template>
        <p v-if="theme.kind.note" class="note">{{ theme.kind.note }}</p>
        <p v-if="view.gemHere" class="fact fact-gem">
          <span class="tt-sprite" :class="`tt-gem-${view.gemHere}`" />
          The {{ GEM_NAMES[view.gemHere] }} lies here
        </p>
        <p v-if="view.blocker" class="fact fact-bad">
          <img v-if="view.blocker.icon" :src="view.blocker.icon" alt="" />
          <span>
            <b>{{ view.blocker.name }}</b> {{ view.blocker.text }}
          </span>
        </p>
      </section>

      <ul v-if="view.teams.length" class="teams">
        <li v-for="team in view.teams" :key="team.name" :style="{ '--team': team.colour }">
          <span class="team-name">{{ team.name }}</span>
          <img v-if="team.finished" class="check" :src="checkMark" alt="finished" />
          <span v-else-if="team.needed !== null" class="team-progress">
            {{ team.done }} / {{ team.needed }}
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
/* Every image here is pixel art: never smooth it. */
.scene,
.scene img {
  image-rendering: pixelated;
}

.scene {
  position: relative;
  width: 320px;
  color: var(--osrs-white);
  font-family: var(--font-small);
  font-size: var(--fs-1);
  line-height: 1.15;
  text-align: center;
  text-shadow: 1px 1px 0 #000;
  filter: drop-shadow(4px 4px 0 rgb(0 0 0 / 0.6));
}

/* --- Layer 1: the environment ------------------------------------------------------------ */

/* Inset under the frame's ragged edge, so the outside of the edge shows the map behind. */
.ground {
  position: absolute;
  inset: 8px;
  overflow: hidden;
  background: #2b3a1e;
}
.env-sea .ground {
  background: url('@/assets/tt/img/scene/water.png') 0 0 / 192px 96px;
  animation: drift 24s linear infinite;
}
@keyframes drift {
  to {
    background-position: 192px 0;
  }
}
/* The map around the tile, cut at 2 pixels per world tile and shown at 2x, the tile centred. */
.terrain {
  position: absolute;
  inset: 0;
  background: center / 324px 300px no-repeat;
}
/* Pushes the terrain back a little so the content reads. */
.shade {
  position: absolute;
  inset: 0;
  background: rgb(14 12 8 / 0.22);
}
.env-sea .shade {
  background: rgb(8 20 34 / 0.12);
}
.finished .ground {
  filter: saturate(0.45) brightness(0.85);
}
.ground-gem {
  position: absolute;
  right: 12px;
  bottom: 10px;
  width: 21px;
  height: 23px;
  filter: drop-shadow(1px 1px 0 #000);
  animation: glint 2.4s steps(2, end) infinite;
}
@keyframes glint {
  50% {
    filter: drop-shadow(1px 1px 0 #000) brightness(1.5);
  }
}
.web {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.35;
}
@media (prefers-reduced-motion: reduce) {
  .env-sea .ground,
  .ground-gem {
    animation: none;
  }
}

/* The frame: waves at sea, stone and earth on land. */
.frame {
  position: absolute;
  inset: 0;
  border-style: solid;
  border-image-repeat: round;
  pointer-events: none;
}

/* --- Content ------------------------------------------------------------------------------ */

.content {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  /* Room around the panel lets the scene show through on every side. */
  padding: 28px 24px 30px;
}

/* --- Layer 2: where it is, one line -------------------------------------------------------- */

.header {
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 30px;
  padding-right: 4px;
  text-align: left;
}
/* Over land the name sits on a frayed cloth of the region's colour, behind the crests. */
.header-cloth::before {
  content: '';
  position: absolute;
  z-index: -1;
  inset: 3px -2px -2px 12px;
  background: color-mix(in srgb, var(--region) 72%, #1a1209);
  box-shadow: inset 0 2px 0 rgb(255 255 255 / 0.12);
  mask:
    url('@/assets/tt/img/scene/cloth-edge.png') bottom / 32px 6px repeat-x,
    linear-gradient(#000, #000) top / 100% calc(100% - 5px) no-repeat;
}
/* The crests hang from a gold-capped pole, as tall as the line. */
.crests {
  position: relative;
  display: flex;
  flex: none;
  gap: 2px;
  align-self: flex-start;
  margin-top: -4px;
  padding: 0 4px;
}
.pole {
  position: absolute;
  top: -2px;
  left: 0;
  right: 0;
  height: 4px;
  background: #4a3424;
  box-shadow:
    inset 0 1px 0 #6e5038,
    0 0 0 1px #000;
}
.pole::before,
.pole::after {
  content: '';
  position: absolute;
  top: -1px;
  width: 4px;
  height: 6px;
  background: #c99a2e;
  box-shadow:
    inset 1px 1px 0 #f2d36b,
    0 0 0 1px #000;
}
.pole::before {
  left: -3px;
}
.pole::after {
  right: -3px;
}
.crests img {
  position: relative;
  width: 20px;
  height: 30px;
  filter: drop-shadow(1px 1px 0 #000);
}
/* At sea the crests fly faded, part of the scene rather than a label. */
.header-open .crests img {
  opacity: 0.85;
}
.place {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-family: var(--font-quill);
  font-size: 24px;
  font-weight: normal;
  line-height: 1;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: #ffd75e;
  text-shadow:
    2px 2px 0 #000,
    -1px -1px 0 #000;
}
.region-gem {
  flex: none;
  width: 21px;
  height: 23px;
  margin-left: auto;
  filter: drop-shadow(1px 1px 0 #000);
}

/* --- Layer 3: the task, on parchment the scene shows faintly through ------------------------ */

.panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  width: 100%;
  padding: 0 4px;
  border: 16px solid transparent;
  border-image: url('@/assets/tt/img/scene/parchment-panel.png') 10 fill / 16px round;
  filter: drop-shadow(3px 3px 0 rgb(0 0 0 / 0.5));
}
.task-name {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-family: var(--font-quill);
  font-size: 24px;
  font-weight: normal;
  line-height: 1.05;
  color: #ffd75e;
  text-shadow:
    2px 2px 0 #000,
    -1px -1px 0 #000;
}
/* Gold studs either side of the task name. */
.task-name::before,
.task-name::after {
  content: '';
  flex: none;
  width: 5px;
  height: 5px;
  background: #c99a2e;
  box-shadow:
    inset 1px 1px 0 #f2d36b,
    0 0 0 2px #000;
  transform: rotate(45deg);
}
.task-text {
  margin: 0;
  color: #f3ead2;
}
.note {
  margin: 0;
  color: var(--osrs-orange);
}
.fact {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  text-align: left;
}
.fact img,
.fact .tt-sprite {
  flex: none;
  width: 21px;
  height: 21px;
  object-fit: contain;
}
.fact-gem {
  color: var(--osrs-cyan);
}
.fact-bad {
  color: #ff7a6b;
}
.fact-bad b {
  font-weight: normal;
  color: var(--osrs-red);
}

/* --- Teams standing here: small ribbons in their colours ----------------------------------- */

.teams {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.teams li {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 1px 6px;
  border: 2px solid #000;
  background: color-mix(in srgb, var(--team) 55%, #120d08);
  box-shadow:
    inset 0 2px 0 rgb(255 255 255 / 0.18),
    2px 2px 0 #000;
}
.team-name {
  color: color-mix(in srgb, var(--team) 40%, #fff);
}
.check {
  width: 16px;
  height: 16px;
}
.finished .teams li {
  box-shadow:
    inset 0 2px 0 rgb(255 255 255 / 0.18),
    0 0 0 2px #c99a2e,
    2px 2px 0 #000;
}
</style>
