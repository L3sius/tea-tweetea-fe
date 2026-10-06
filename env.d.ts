/// <reference types="vite/client" />

// Vite's env typing works by merging into these interfaces, so `type` aliases cannot be used here.
/* eslint-disable @typescript-eslint/consistent-type-definitions */

interface ImportMetaEnv {
  /** Where the game API runs, e.g. http://localhost:8080. Only used in `http` mode. */
  readonly VITE_API_BASE_URL?: string
  /** `http` talks to a real server, `fixtures` serves recorded responses offline. */
  readonly VITE_API_MODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
