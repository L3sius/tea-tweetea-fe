// How each continent looks in the tile tooltip: the OSRS Leagues area badge of every region it
// covers, and the badge's main colour for the header. Badges are from the OSRS Wiki.
import asgarnia from '@/assets/tt/img/regions/asgarnia.png'
import desert from '@/assets/tt/img/regions/desert.png'
import fremennik from '@/assets/tt/img/regions/fremennik.png'
import kandarin from '@/assets/tt/img/regions/kandarin.png'
import karamja from '@/assets/tt/img/regions/karamja.png'
import kourend from '@/assets/tt/img/regions/kourend.png'
import misthalin from '@/assets/tt/img/regions/misthalin.png'
import morytania from '@/assets/tt/img/regions/morytania.png'
import tirannwn from '@/assets/tt/img/regions/tirannwn.png'
import varlamore from '@/assets/tt/img/regions/varlamore.png'
import wilderness from '@/assets/tt/img/regions/wilderness.png'

/** Land frame styles; regions without one keep the plain stone, earth and grass. */
export type FrameStyle =
  'volcanic' | 'bloody' | 'sandy' | 'terracotta' | 'jungle' | 'marble' | 'crystal'

type Badge = { badge: string; colour: string; frame?: FrameStyle }

/**
 * Keyed by a word of the continent's name as the board gives it ("Kandarin & Elven Lands"), so a
 * continent covering two regions shows both badges. "Fremenik" is how the board spells it.
 */
const BADGES: [string, Badge][] = [
  ['misthalin', { badge: misthalin, colour: '#0c58ca' }],
  ['asgarnia', { badge: asgarnia, colour: '#0c58ca' }],
  ['wilderness', { badge: wilderness, colour: '#4a4a4a', frame: 'volcanic' }],
  ['fremen', { badge: fremennik, colour: '#664c38' }],
  ['morytania', { badge: morytania, colour: '#005784', frame: 'bloody' }],
  ['desert', { badge: desert, colour: '#be2633', frame: 'sandy' }],
  ['kourend', { badge: kourend, colour: '#178c51', frame: 'marble' }],
  ['varlamore', { badge: varlamore, colour: '#d9434d', frame: 'terracotta' }],
  ['karamja', { badge: karamja, colour: '#178c51', frame: 'jungle' }],
  ['kandarin', { badge: kandarin, colour: '#be2633', frame: 'crystal' }],
  ['elven', { badge: tirannwn, colour: '#178c51' }],
]

export type RegionLook = {
  /** One badge per region the continent covers, in the order its name lists them. */
  badges: string[]
  /** The first region's colour, for the header band. */
  colour: string
  /** The first region's land frame, if it has its own. */
  frame: FrameStyle | null
}

const FALLBACK_COLOUR = '#5c4f3d'

export function regionLook(continentName: string): RegionLook {
  const name = continentName.toLowerCase()
  const found = BADGES.filter(([word]) => name.includes(word))
    .map(([word, look]) => ({ at: name.indexOf(word), look }))
    .sort((a, b) => a.at - b.at)
    .map((f) => f.look)
  return {
    badges: found.map((f) => f.badge),
    colour: found[0]?.colour ?? FALLBACK_COLOUR,
    frame: found[0]?.frame ?? null,
  }
}
