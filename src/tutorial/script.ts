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

/** Parts of the page the tutorial can outline (marked with `data-tutorial-spot`). */
export type SpotName = 'current-tile' | 'minigames'

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
  /**
   * Shows parts of the page; roads and nodes spread out from Earl Grey. With `dip`, the page dips
   * to black and back around it, for parts that move the layout (the side panel).
   */
  | { kind: 'reveal'; what: RevealName[]; dip?: boolean }
  /** Flies the camera to the whole map, or to Earl Grey at a zoom. */
  | { kind: 'camera'; to: 'all' | 'guide'; zoom?: number; ms: number }
  /**
   * Walks Earl Grey along `path`: tiles of the tutorial's own board (tutorial/world), starting where
   * he stands. 7 steps or more and he runs.
   */
  | { kind: 'walk'; path: number[] }
  /** Shows the task card of the tile he stands on, as hovering a node does, until the beat ends. */
  | { kind: 'inspect' }
  /** Outlines a part of the page, dimming the rest, until the line ends. */
  | { kind: 'spotlight'; target: SpotName }
  /** Spins the minigame slot machine; when it lands, Earl Grey's minigame opens in the side panel. */
  | { kind: 'spin' }
  /** Opens the shop panel of the shop he stands on, until the beat ends. */
  | { kind: 'shop' }
  | { kind: 'gesture'; gesture: Gesture }
  /** Flavour over his head, like overhead chat in the game; nothing the player must read. */
  | { kind: 'say'; text: string; ms?: number }

/**
 * An action at a time (ms) after its beat or line starts; with `after`, that long after Earl Grey
 * has finished walking, or the slot machine spinning, so it waits for him to arrive or it to land.
 */
export type Cue = { at: number; action: Action; after?: 'walk' | 'spin' }

export type Line = {
  text: string
  /** Played when the line appears. */
  gesture?: Gesture
  cues?: Cue[]
}

export type Beat = {
  id: string
  /** Its name in the tour's contents, which can jump to it. */
  title: string
  cues?: Cue[]
  lines: Line[]
}

/**
 * Where Earl Grey starts: a tile in Ardougne. His routes below were picked on the tutorial's board
 * so that each lands where his lines say (script.spec.ts checks them).
 */
export const TOUR_START = 130

const ROUTE = {
  stroll: [130, 131, 262, 77],
  run: [77, 40, 45, 493, 310, 284, 283, 466, 44],
  /** On to the red tile next door. */
  toMinigame: [44, 308],
  toShop: [308, 306, 307],
}

const at = (ms: number, action: Action): Cue => ({ at: ms, action })
const arrived = (ms: number, action: Action): Cue => ({ at: ms, action, after: 'walk' })
const spun = (ms: number, action: Action): Cue => ({ at: ms, action, after: 'spin' })

export const TUTORIAL: Beat[] = [
  {
    id: 'welcome',
    title: 'Welcome',
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
        text: 'The aim of this adventure is to gather all the magic gems. But how do we get them?',
        gesture: 'think',
      },
    ],
  },
  {
    id: 'gems',
    title: 'The gems',
    cues: [
      // The gems fade in as the camera pulls out, before he mentions them.
      at(0, { kind: 'camera', to: 'all', ms: 3500 }),
      at(200, { kind: 'reveal', what: ['gems'] }),
      at(3200, { kind: 'say', text: 'Ooh, pretty...' }),
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
    title: 'Roads and nodes',
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
          at(200, { kind: 'walk', path: ROUTE.stroll }),
          at(800, { kind: 'say', text: 'Mind the potholes.' }),
        ],
      },
      {
        text: 'But a brisk step favours the bold, and surely the bold shall earn true victory and pride!',
        cues: [
          at(200, { kind: 'walk', path: ROUTE.run }),
          at(900, { kind: 'say', text: 'Wheee!' }),
        ],
      },
    ],
  },
  {
    id: 'tile',
    title: 'Tiles and tasks',
    lines: [
      {
        text: 'Aha! It appears we have landed on a tile. Click or hover over a node, and we shall gaze upon the task at hand.',
        gesture: 'beckon',
        cues: [arrived(300, { kind: 'inspect' })],
      },
      {
        text: 'In this manner you may see the path that lies ahead. The tile you must currently conquer is shown in the sidebar of glory.',
        cues: [
          // He has landed by the time the panel shows, so it shows his tile.
          arrived(200, { kind: 'reveal', what: ['panel'], dip: true }),
          arrived(1600, { kind: 'spotlight', target: 'current-tile' }),
        ],
      },
      {
        text: 'The road ahead is a dangerous one, and only as a team can you expect to take the crown.',
        gesture: 'nod',
        cues: [at(300, { kind: 'reveal', what: ['teams'] })],
      },
      { text: "Every player's contribution adds to the progress of the tile." },
    ],
  },
  {
    id: 'minigame',
    title: 'Minigames',
    lines: [
      {
        text: 'Let us proceed forth onto the next tile.',
        gesture: 'beckon',
        cues: [at(200, { kind: 'walk', path: ROUTE.toMinigame })],
      },
      {
        text: 'Ha! What a gracious day this is! We appear to have landed on a minigame.',
        gesture: 'cheer',
        cues: [
          arrived(200, { kind: 'spin' }),
          arrived(600, { kind: 'say', text: 'Ooh, a red one!' }),
        ],
      },
      {
        text: 'Minigames can be started at any time, and any team can take part.',
        cues: [spun(200, { kind: 'spotlight', target: 'minigames' })],
      },
      {
        text: 'They are a sport worthy of a true champion, and reward the valiant with gold with which to purchase wares.',
        gesture: 'clap',
      },
    ],
  },
  {
    id: 'shop',
    title: 'Shops',
    lines: [
      {
        text: 'But dost thou ask where one can spend their hard-earned tender? Why, at the shop of course!',
        gesture: 'laugh',
        cues: [
          at(200, { kind: 'reveal', what: ['landmarks'] }),
          at(900, { kind: 'walk', path: ROUTE.toShop }),
          arrived(400, { kind: 'say', text: '*rattles coin purse*' }),
        ],
      },
      {
        text: 'Every shop sells different items, and you must travel the globe to acquire all you can to achieve your goal.',
        cues: [arrived(200, { kind: 'shop' })],
      },
    ],
  },
  {
    id: 'farewell',
    title: 'Farewell',
    lines: [
      {
        text: "That's all from me for now. I wish thee good fortune in thy adventure!",
        gesture: 'bow',
      },
    ],
  },
]
