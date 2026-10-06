import { describe, expect, it, vi } from 'vitest'
import type { StreamMessage } from '../client'
import { openStream, type EventSourceLike } from './stream'

class FakeEventSource implements EventSourceLike {
  readyState = 0
  onopen: ((event: Event) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  closed = false
  private listeners = new Map<string, (event: MessageEvent<string>) => void>()

  constructor(readonly url: string) {}

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void) {
    this.listeners.set(type, listener)
  }

  close() {
    this.closed = true
  }

  emit(type: string, data: unknown) {
    this.listeners.get(type)?.(new MessageEvent(type, { data: JSON.stringify(data) }))
  }
}

function open() {
  let source: FakeEventSource | undefined
  const messages: StreamMessage[] = []
  const close = openStream(
    'http://api.test/stream?after=5',
    (m) => messages.push(m),
    (url) => {
      source = new FakeEventSource(url)
      return source
    },
  )
  if (!source) throw new Error('No EventSource opened')
  return { source, messages, close }
}

describe('openStream', () => {
  it('decodes journal entries into domain events', () => {
    const { source, messages } = open()

    source.emit('entry', {
      seq: 6,
      at: '2026-10-05T14:02:36Z',
      events: [{ type: 'tile_completed', team: 1, tile: 42 }],
    })

    expect(messages).toEqual([
      {
        kind: 'entry',
        entry: {
          seq: 6,
          at: new Date('2026-10-05T14:02:36Z'),
          events: [{ kind: 'tile_completed', teamId: 1, tileId: 42 }],
        },
      },
    ])
  })

  it('reports the connection and closes on request', () => {
    const { source, messages, close } = open()

    source.onopen?.(new Event('open'))
    source.onerror?.(new Event('error'))
    source.readyState = 2
    source.onerror?.(new Event('error'))
    close()

    expect(messages.map((m) => m.kind === 'connection' && m.connection)).toEqual([
      'live',
      'reconnecting',
      'offline',
    ])
    expect(source.closed).toBe(true)
  })

  it('asks for a resync when a message breaks the contract', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { source, messages } = open()

    source.emit('entry', { seq: 'not a number' })

    expect(messages).toEqual([{ kind: 'resync' }])
  })
})
