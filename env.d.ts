/// <reference types="vite/client" />

// Vite's env typing works by merging into these interfaces, so `type` aliases cannot be used here.
/* eslint-disable @typescript-eslint/consistent-type-definitions */

interface ImportMetaEnv {
  /** Where the game API runs, e.g. http://localhost:8080. Only used in `http` mode. */
  readonly VITE_API_BASE_URL?: string
  /** `http` talks to a real server, `fixtures` serves recorded responses offline. */
  readonly VITE_API_MODE?: string
  /** Where the OSRS character assets are served from; https://api.tea-osrs.com/osrs/ when unset. */
  readonly VITE_OSRS_ASSETS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Where the board map's nodes are on screen, for end-to-end tests (see BoardMap.vue). */
interface MapProbe {
  /** The map is not panning or zooming, so a node's point stays put. */
  still(): boolean
  /** The node's point in the viewport, centring it first if something on the page covers it. */
  point(tile: number): { x: number; y: number } | null
  /** Where the next checkpoint of a walk can go: one step away, or further. */
  options(): { near: number[]; far: number[] } | null
  /** Tiles a tile-targeted item can go on. */
  targets(): number[] | null
}

interface Window {
  /** Set in development builds only. */
  __tweeteaMap?: MapProbe
}
