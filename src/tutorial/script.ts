// The tutorial's script: Earl Grey walks a new player through the board, which builds itself up
// piece by piece as he explains it. Edit the wording here; the engine (stores/tutorial.ts) plays it.
//
// A beat starts with its actions (each at a time after the beat starts) and shows its chatbox lines
// one at a time; a line can start actions of its own when it appears. Pointers name parts of the UI
// (see RevealName) rather than particular markup, so the script survives changes to the layout.

/** Parts of the page the tutorial hides until they are explained. */
export type RevealName =
  // On the map
  | 'terrain'
  | 'roads'
  | 'nodes'
  | 'gems'
  /** Shops and traps. */
  | 'landmarks'
  | 'teams'
  // Around it
  | 'header'
  | 'panel'
  | 'controls'

/** Map parts, drawn by BoardMap. */
export type BoardLayer = Extract<
  RevealName,
  'terrain' | 'roads' | 'nodes' | 'gems' | 'landmarks' | 'teams'
>

/** Earl Grey's gestures: OSRS animations every player-rigged NPC can play. */
export const GESTURE = {
  wave: 863,
  beckon: 864,
  think: 857,
  nod: 855,
  clap: 865,
  bow: 858,
  cheer: 862,
  laugh: 861,
} as const
export type Gesture = keyof typeof GESTURE

export type Action =
  /** Shows parts of the page; roads and nodes spread out from Earl Grey. */
  | { kind: 'reveal'; what: RevealName[] }
  /** Flies the camera to the whole map, or to Earl Grey at a zoom. */
  | { kind: 'camera'; to: 'all' | 'guide'; zoom?: number; ms: number }
  /** Walks Earl Grey this many steps along the roads; 7 or more and he runs. */
  | { kind: 'walk'; steps: number }
  | { kind: 'gesture'; gesture: Gesture }
  /** Flavour over his head, like overhead chat in the game; nothing the player must read. */
  | { kind: 'say'; text: string; ms?: number }

/** An action at a time (ms) after its beat or line starts. */
export type Cue = { at: number; action: Action }

export type Line = {
  text: string
  /** Played when the line appears. */
  gesture?: Gesture
  cues?: Cue[]
}

export type Beat = {
  id: string
  cues?: Cue[]
  lines: Line[]
}

const at = (ms: number, action: Action): Cue => ({ at: ms, action })

export const TUTORIAL: Beat[] = [
  {
    id: 'welcome',
    cues: [
      // Close on him, with the map fading in behind him.
      at(0, { kind: 'camera', to: 'guide', zoom: 1.5, ms: 0 }),
      at(0, { kind: 'reveal', what: ['terrain'] }),
      at(2500, { kind: 'say', text: '*sips tea*' }),
    ],
    lines: [
      {
        text: 'Ahoy there, young adventurer! I bid you a warm welcome to Tweetea and the Magic Gems.',
        gesture: 'wave',
      },
      {
        text: 'The aim of this adventure is to gather every one of the magic gems. But how do we get them?',
        gesture: 'think',
      },
    ],
  },
  {
    id: 'gems',
    cues: [
      // The gems fade in as the camera pulls out, before he mentions them.
      at(0, { kind: 'camera', to: 'all', ms: 3500 }),
      at(200, { kind: 'reveal', what: ['gems'] }),
      at(3200, { kind: 'say', text: 'Ooh, look at that.' }),
    ],
    lines: [
      { text: 'This is the map of Gielinor. Can you see the gems?', gesture: 'beckon' },
      { text: 'You must gather them all to reign victorious!', gesture: 'cheer' },
      {
        text: 'But how do we get there?',
        gesture: 'think',
        cues: [at(200, { kind: 'camera', to: 'guide', zoom: 0.5, ms: 3000 })],
      },
    ],
  },
  {
    id: 'roads',
    lines: [
      {
        text: 'These are the roads, and they are made up of nodes. Every node is a tile, and an adventurer who lands upon one must complete it.',
        gesture: 'beckon',
        cues: [at(300, { kind: 'reveal', what: ['roads', 'nodes'] })],
      },
      {
        text: 'A noble adventurer keeps to the path, lest he stray into the depths of darkness.',
        gesture: 'nod',
      },
      {
        text: 'A few tiles make for a short walk. Any soldier worth his salt covers such ground without haste.',
        cues: [
          at(200, { kind: 'walk', steps: 3 }),
          at(800, { kind: 'say', text: 'Mind the potholes.' }),
        ],
      },
      {
        text: 'But a brisk step favours the bold, and surely the bold shall earn true victory and pride!',
        cues: [at(200, { kind: 'walk', steps: 8 }), at(900, { kind: 'say', text: 'Wheee!' })],
      },
    ],
  },
]
