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
  | 'landmarks'
  | 'teams'
  // Around it
  | 'header'
  | 'panel'
  | 'controls'

/** Map parts, drawn by BoardMap. */
export type BoardLayer = Extract<RevealName, 'terrain' | 'roads' | 'nodes' | 'landmarks' | 'teams'>

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
        text: "Ah, a new arrival! Welcome to Tweetea and the Magic Gems. I'm Earl Grey, and I'll show you the ropes.",
        gesture: 'wave',
      },
      {
        text: 'Your clan splits into teams. Teams race across a board by finishing Old School tasks, and collect magic gems on the way.',
        gesture: 'nod',
      },
      { text: "Let's begin with where it all happens.", gesture: 'beckon' },
    ],
  },
  {
    id: 'map',
    cues: [
      at(1800, { kind: 'camera', to: 'all', ms: 3500 }),
      at(3200, { kind: 'say', text: 'Ooh, look at that.' }),
      at(7000, { kind: 'camera', to: 'guide', zoom: 0.5, ms: 3000 }),
    ],
    lines: [
      { text: 'This is the board: the whole of Gielinor, laid out as a map.', gesture: 'think' },
      {
        text: 'Every team plays on this same map, and the whole clan can watch the race unfold here.',
      },
    ],
  },
  {
    id: 'roads',
    cues: [at(300, { kind: 'reveal', what: ['roads', 'nodes'] })],
    lines: [
      {
        text: 'Each dot is a tile, and roads join the tiles together. Teams only ever move along the roads.',
        gesture: 'beckon',
      },
      {
        text: 'A short move is a gentle stroll...',
        cues: [
          at(200, { kind: 'walk', steps: 3 }),
          at(800, { kind: 'say', text: 'Mind the potholes.' }),
        ],
      },
      {
        text: '...and a long one is a proper run!',
        cues: [at(200, { kind: 'walk', steps: 8 }), at(900, { kind: 'say', text: 'Wheee!' })],
      },
    ],
  },
  {
    id: 'later',
    cues: [at(0, { kind: 'camera', to: 'all', ms: 2500 })],
    lines: [
      {
        text: "That's all of the tour for now. There's more on the way. Good luck out there!",
        gesture: 'bow',
      },
    ],
  },
]
