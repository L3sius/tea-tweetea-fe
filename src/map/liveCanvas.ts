// Leaflet's canvas renderer draws the board (roads and nodes) once per move: when the move ends.
// During a drag, its glide or a flight it only slides (and scales) that picture, which covers the
// view plus a margin, so a long move runs off the picture's edge and shows bare map until the
// move ends. This renderer watches the view as it moves and draws again just before an edge would
// show, so the board is always there, while it still draws only now and then, not every frame.
import {
  Canvas,
  Util,
  latLngBounds,
  type Canvas as CanvasRenderer,
  type Map as LeafletMap,
  type Point,
  type RendererOptions,
} from 'leaflet'

// The parts of Leaflet's renderer this one uses. They are not in its published types, but they
// are the same calls Leaflet makes itself on `moveend` and `viewreset`.
type RendererInternals = {
  _map: (LeafletMap & { _animatingZoom?: boolean }) | null
  _bounds?: { min: Point; max: Point }
  _zoom: number
  _update(): void
  _reset(): void
  options: RendererOptions & { padding: number }
}
type LiveCanvas = RendererInternals & { _moveFrame: number | null }
type Options = RendererOptions & { padding: number }

const base = Canvas.prototype as unknown as {
  getEvents(): Record<string, unknown>
  onRemove(): void
}

const LiveCanvasClass = Canvas.extend({
  getEvents(this: LiveCanvas) {
    return { ...base.getEvents.call(this), move: onMove }
  },
  onRemove(this: LiveCanvas) {
    if (this._moveFrame !== null) Util.cancelAnimFrame(this._moveFrame)
    this._moveFrame = null
    base.onRemove.call(this)
  },
})

function onMove(this: LiveCanvas) {
  // Moves come many times a frame; one look per frame is enough.
  this._moveFrame ??= Util.requestAnimFrame(() => {
    this._moveFrame = null
    keepCovered(this)
  })
}

/**
 * Draws again if the view, plus half the margin, is no longer inside the drawn picture. Compared
 * in map coordinates, so it holds while zooming too: a flight that pans and zooms gets a fresh
 * picture at its current zoom instead of a stretched old one.
 */
function keepCovered(r: LiveCanvas) {
  const map = r._map
  // Leaflet's own zoom animation scales the picture and draws again when it ends.
  if (!map || map._animatingZoom || !r._bounds) return
  const drawn = latLngBounds(
    map.unproject(r._bounds.min, r._zoom),
    map.unproject(r._bounds.max, r._zoom),
  )
  const size = map.getSize()
  const margin = size.multiplyBy(r.options.padding / 2)
  const view = latLngBounds(
    map.containerPointToLatLng(margin.multiplyBy(-1)),
    map.containerPointToLatLng(size.add(margin)),
  )
  if (drawn.contains(view)) return
  // Same zoom: draw at the new place. New zoom: project the paths again first, as a view reset does.
  if (map.getZoom() === r._zoom) r._update()
  else r._reset()
}

/**
 * A canvas renderer that keeps the board drawn while the map moves. `padding` is the margin drawn
 * around the view on each side, as a share of the view; it draws again once half of it is used.
 */
export const liveCanvas = (options: Options) => {
  const Live = LiveCanvasClass as unknown as new (options: Options) => CanvasRenderer & LiveCanvas
  const renderer = new Live(options)
  renderer._moveFrame = null
  return renderer as CanvasRenderer
}
