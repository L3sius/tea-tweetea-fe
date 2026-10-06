import { describe, expect, it } from 'vitest'
import { readConfig } from './env'

describe('readConfig', () => {
  it('uses the given base URL in http mode', () => {
    expect(
      readConfig({ VITE_API_MODE: 'http', VITE_API_BASE_URL: 'http://localhost:8080' }),
    ).toEqual({ api: { mode: 'http', baseUrl: 'http://localhost:8080' } })
  })

  it('needs no base URL in fixture mode', () => {
    expect(readConfig({ VITE_API_MODE: 'fixtures' })).toEqual({ api: { mode: 'fixtures' } })
  })

  it('defaults to http mode, which needs a base URL', () => {
    expect(() => readConfig({})).toThrow(/VITE_API_BASE_URL/)
  })

  it('rejects an unknown mode', () => {
    expect(() => readConfig({ VITE_API_MODE: 'mock' })).toThrow(/VITE_API_MODE/)
  })
})
