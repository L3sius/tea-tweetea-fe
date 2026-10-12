// The music that plays under the game: classic OSRS tracks from the OSRS Wiki, levelled to one
// loudness and served with the other OSRS assets (tools/characters/audio/, see docs/sounds.md).

/** The tour's own track, looping under it. */
export const NEWBIE_MELODY = 'newbie-melody.ogg'

/** The game's tracks, shuffled. */
export const GAME_TRACKS: readonly string[] = [
  'harmony.ogg',
  'autumn-voyage.ogg',
  'sea-shanty-2.ogg',
  'flute-salad.ogg',
  'scape-main.ogg',
  'adventure.ogg',
  'medieval.ogg',
  'expanse.ogg',
  'garden.ogg',
  'spirit.ogg',
  'arabian.ogg',
  'fanfare.ogg',
  'still-night.ogg',
  'wonder.ogg',
  'yesteryear.ogg',
  'dream.ogg',
  'book-of-spells.ogg',
  'long-way-home.ogg',
  'vision.ogg',
  'start.ogg',
  'attention.ogg',
]

/**
 * The tracks in a random order that doesn't start with `after`, the track that just played, so
 * that a reshuffle at the end of the list never plays a track twice in a row.
 */
export function shuffle(
  tracks: readonly string[],
  after?: string,
  random: () => number = Math.random,
): string[] {
  const left = [...tracks]
  const order: string[] = []
  while (left.length > 0) order.push(...left.splice(Math.floor(random() * left.length), 1))
  if (order.length > 1 && order[0] === after) order.push(...order.splice(0, 1))
  return order
}
