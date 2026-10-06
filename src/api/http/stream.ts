import type { StreamListener } from '../client'
import { decode, parseJson } from '../decode'
import { isApiError } from '../errors'
import { toJournalEntry } from '../mappers/events'
import { toHello } from '../mappers/server'
import { WirePublished } from '../wire/events'
import { WireHello } from '../wire/server'

/** The parts of `EventSource` the stream uses, so tests can pass a fake. */
export type EventSourceLike = {
  readonly readyState: number
  onopen: ((event: Event) => void) | null
  onerror: ((event: Event) => void) | null
  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void
  close(): void
}

export type EventSourceFactory = (url: string) => EventSourceLike

const CLOSED = 2

/**
 * Opens `GET /stream` and turns its server-sent events into stream messages. The browser
 * reconnects by itself and resumes through `Last-Event-ID`.
 */
export function openStream(
  url: string,
  listener: StreamListener,
  open: EventSourceFactory = (u) => new EventSource(u),
): () => void {
  const source = open(url)

  source.onopen = () => listener({ kind: 'connection', connection: 'live' })
  source.onerror = () =>
    listener({
      kind: 'connection',
      connection: source.readyState === CLOSED ? 'offline' : 'reconnecting',
    })

  // A message that breaks the contract is logged and treated as a lost place, so the state is
  // refetched through the validated endpoints, which then fail loudly if the API really changed.
  const handle = (type: string, onData: (data: unknown) => void) =>
    source.addEventListener(type, (event) => {
      try {
        onData(parseJson(event.data))
      } catch (error) {
        if (!isApiError(error)) throw error
        console.error(error)
        listener({ kind: 'resync' })
      }
    })

  handle('hello', (data) =>
    listener({ kind: 'hello', hello: decode('/stream hello', WireHello, toHello, data) }),
  )
  handle('entry', (data) =>
    listener({
      kind: 'entry',
      entry: decode('/stream entry', WirePublished, toJournalEntry, data),
    }),
  )
  handle('feed', () => listener({ kind: 'feed' }))
  handle('resync', () => listener({ kind: 'resync' }))

  return () => source.close()
}
