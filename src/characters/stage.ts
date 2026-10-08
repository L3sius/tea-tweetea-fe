// Draws OSRS characters into small canvases. One offscreen WebGL renderer, shared by every piece,
// renders a piece's model in its current pose and copies the picture into the piece's own 2D
// canvas, so any number of pieces costs a single WebGL context.
//
// Poses come from model.ts, which animates like the game client; a piece only re-poses and
// redraws when its frame or heading changes.
import {
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshLambertMaterial,
  OrthographicCamera,
  SRGBColorSpace,
  Scene,
  WebGLRenderer,
} from 'three'
import type { Performance } from './acting'
import { loadAnimation, loadFramemap, loadModelPart, loadNpcs, type NpcLook } from './assets'
import { hslToRgb } from './color'
import { frameAt, mergeParts, pose, type Animation, type Framemap, type Model } from './model'

/** How far the camera looks down on the piece, like the game's default camera pitch. */
const PITCH = (22 * Math.PI) / 180
/** The game runs on 20 ms client ticks; animation frame lengths are counted in them. */
const TICK_MS = 20
/** How fast a piece turns: an NPC's default 32 of 2048 steps of a full turn per client tick. */
const TURN_PER_MS = (32 / 2048) * ((2 * Math.PI) / TICK_MS)
/** A face alpha of 255 hides the face. */
const HIDDEN = 255

/** `from` turned by at most `step` towards `to`, the short way round. */
function turnTowards(from: number, to: number, step: number): number {
  const gap = Math.atan2(Math.sin(to - from), Math.cos(to - from))
  return Math.abs(gap) <= step ? to : from + Math.sign(gap) * step
}

/** The faces of one material, as a three.js mesh whose corners are rewritten for each pose. */
type Batch = { faces: number[]; positions: BufferAttribute; mesh: Mesh }

/** A look ready to draw: its merged model, and the meshes showing it. */
class Figure {
  readonly root = new Group()
  private readonly batches: Batch[]
  private readonly posed: Int32Array
  /** Feet to crown at rest, in game units. */
  readonly height: number
  /** The lowest point at rest (game space: y down, so the largest y). */
  private readonly ground: number
  /** How far each animation sinks below the resting feet, by animation. */
  private readonly sinks = new Map<Animation, number>()

  constructor(
    readonly model: Model,
    look: NpcLook,
  ) {
    this.posed = new Int32Array(model.positions.length)
    const opaque: number[] = []
    const seeThrough: number[] = []
    for (let f = 0; f < model.colors.length; f++) {
      const alpha = model.alphas[f] ?? 0
      if (alpha === HIDDEN) continue
      if (alpha === 0) opaque.push(f)
      else seeThrough.push(f)
    }
    this.batches = [this.batch(opaque, false), this.batch(seeThrough, true)].filter(
      (b): b is Batch => b !== null,
    )
    const [width, height] = (look.scale ?? [128, 128]).map((s) => s / 128) as [number, number]
    this.root.scale.set(width, height, width)

    let top = 0
    let bottom = 0
    for (let v = 1; v < model.positions.length; v += 3) {
      const y = model.positions[v] ?? 0
      top = Math.min(top, y)
      bottom = Math.max(bottom, y)
    }
    this.height = (bottom - top) * height
    this.ground = bottom
    this.show(model.positions)
  }

  private batch(faces: number[], transparent: boolean): Batch | null {
    if (faces.length === 0) return null
    const colors = new Float32Array(faces.length * 3 * 4)
    const color = new Color()
    faces.forEach((f, i) => {
      const [r, g, b] = hslToRgb(this.model.colors[f] ?? 0)
      color.setRGB(r, g, b, SRGBColorSpace)
      const alpha = 1 - (this.model.alphas[f] ?? 0) / 255
      for (let corner = 0; corner < 3; corner++)
        colors.set([color.r, color.g, color.b, alpha], (i * 3 + corner) * 4)
    })
    const geometry = new BufferGeometry()
    const positions = new BufferAttribute(new Float32Array(faces.length * 9), 3)
    geometry.setAttribute('position', positions)
    geometry.setAttribute('color', new BufferAttribute(colors, 4))
    const material = new MeshLambertMaterial({ vertexColors: true, flatShading: true, transparent })
    const mesh = new Mesh(geometry, material)
    this.root.add(mesh)
    return { faces, positions, mesh }
  }

  /**
   * Shows the model in a pose (game space: y down), turned into three.js space (y up) and raised
   * by `lift`.
   */
  show(vertices: Int32Array, lift = 0) {
    const faces = this.model.faces
    for (const { faces: list, positions, mesh } of this.batches) {
      const out = positions.array as Float32Array
      list.forEach((f, i) => {
        for (let corner = 0; corner < 3; corner++) {
          const v = (faces[f * 3 + corner] ?? 0) * 3
          const at = (i * 3 + corner) * 3
          out[at] = vertices[v] ?? 0
          out[at + 1] = lift - (vertices[v + 1] ?? 0)
          out[at + 2] = -(vertices[v + 2] ?? 0)
        }
      })
      positions.needsUpdate = true
      mesh.geometry.computeBoundingSphere()
    }
  }

  /**
   * Shows a frame. Animations that sink the body below the feet, like swimming in the game's
   * water, are raised so the whole piece stays in view.
   */
  pose(framemap: Framemap, animation: Animation, frame: number) {
    const shown = animation.frames[frame]
    const lift = this.sinkOf(framemap, animation)
    this.show(shown ? pose(this.model, framemap, shown, this.posed) : this.model.positions, lift)
  }

  private sinkOf(framemap: Framemap, animation: Animation): number {
    let sink = this.sinks.get(animation)
    if (sink === undefined) {
      let lowest = this.ground
      for (const frame of animation.frames) {
        const posed = pose(this.model, framemap, frame, this.posed)
        for (let v = 1; v < posed.length; v += 3) lowest = Math.max(lowest, posed[v] ?? 0)
      }
      sink = lowest - this.ground
      this.sinks.set(animation, sink)
    }
    return sink
  }

  dispose() {
    for (const { mesh } of this.batches) {
      mesh.geometry.dispose()
      ;(mesh.material as MeshLambertMaterial).dispose()
    }
  }
}

async function loadFigure(npc: number): Promise<Figure> {
  const look = (await loadNpcs()).byId.get(npc)
  if (!look) throw new Error(`No exported NPC ${npc}`)
  const parts = await Promise.all(look.models.map((id) => loadModelPart(id)))
  return new Figure(mergeParts(parts, look.recolor), look)
}

let shared: { renderer: WebGLRenderer; scene: Scene; camera: OrthographicCamera } | null = null

function stage() {
  if (!shared) {
    const renderer = new WebGLRenderer({ alpha: true, antialias: false })
    renderer.setPixelRatio(1)
    const scene = new Scene()
    scene.add(new AmbientLight(0xffffff, 1.6))
    const sun = new DirectionalLight(0xffffff, 2.2)
    sun.position.set(-1, 2, 1.5)
    scene.add(sun)
    shared = { renderer, scene, camera: new OrthographicCamera() }
  }
  return shared
}

type Playing = { animation: Animation; framemap: Framemap }

/** One NPC drawn into `canvas`, filling its pixel size. */
export class CharacterPiece {
  private readonly context: CanvasRenderingContext2D | null
  private figure: Figure | null = null
  private readonly playing = new Map<number, Playing | 'loading'>()
  /** The heading drawn last, turning towards the one asked for. */
  private heading: number | null = null
  private lastDraw = 0
  private drawn = ''
  private disposed = false

  constructor(
    readonly npc: number,
    readonly canvas: HTMLCanvasElement,
  ) {
    this.context = canvas.getContext('2d')
    void loadFigure(npc).then((figure) => {
      if (this.disposed) figure.dispose()
      else this.figure = figure
    })
  }

  /** The animation and its skeleton, or null while they load. */
  private animation(id: number): Playing | null {
    const known = this.playing.get(id)
    if (known === 'loading') return null
    if (known) return known
    this.playing.set(id, 'loading')
    void loadAnimation(id).then(async (animation) => {
      this.playing.set(id, { animation, framemap: await loadFramemap(animation.framemap) })
    })
    return null
  }

  /**
   * Draws the piece in `performance` at `time` (ms), turning towards `heading` (see heading.ts) at
   * the game's turning speed. Until an animation loads, the piece stands at rest.
   */
  draw(performance: Performance, heading: number, time: number): void {
    const { figure, context } = this
    if (!figure || !context) return
    const turned = this.heading ?? heading
    this.heading = turnTowards(turned, heading, Math.max(0, time - this.lastDraw) * TURN_PER_MS)
    this.lastDraw = time

    const playing = this.animation(performance.anim)
    const ticks = ((time - performance.since) * performance.rate) / TICK_MS
    const frame = playing ? frameAt(playing.animation, Math.floor(ticks)) : -1
    const key = `${performance.anim}|${frame}|${this.heading.toFixed(3)}`
    if (key === this.drawn) return
    this.drawn = key

    if (playing) figure.pose(playing.framemap, playing.animation, frame)
    else figure.show(figure.model.positions)
    figure.root.rotation.y = this.heading
    this.render(figure, context)
  }

  private render(figure: Figure, context: CanvasRenderingContext2D) {
    const { renderer, scene, camera } = stage()
    const { width, height } = this.canvas
    renderer.setSize(width, height, false)

    // Fit the model's height, with room above for raised arms and below for the feet.
    const span = figure.height * 1.25
    const aspect = width / height
    camera.left = (-span * aspect) / 2
    camera.right = (span * aspect) / 2
    camera.top = span / 2
    camera.bottom = -span / 2
    camera.near = 1
    camera.far = figure.height * 20
    const middle = figure.height * 0.52
    const distance = figure.height * 5
    camera.position.set(0, middle + Math.sin(PITCH) * distance, Math.cos(PITCH) * distance)
    camera.lookAt(0, middle, 0)
    camera.updateProjectionMatrix()

    scene.add(figure.root)
    renderer.render(scene, camera)
    scene.remove(figure.root)
    context.clearRect(0, 0, width, height)
    context.drawImage(renderer.domElement, 0, 0)
  }

  dispose(): void {
    this.disposed = true
    this.figure?.dispose()
    this.figure = null
  }
}
