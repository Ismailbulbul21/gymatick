import { describe, expect, it } from 'vitest'
import { isPrivilegedKey } from './supabase-keys'

function fakeJwt(payload: Record<string, unknown>): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`
}

describe('isPrivilegedKey', () => {
  it('accepts publishable keys', () => {
    expect(isPrivilegedKey('sb_publishable_abc123')).toBe(false)
  })

  it('rejects secret keys', () => {
    expect(isPrivilegedKey('sb_secret_abc123')).toBe(true)
  })

  it('accepts legacy anon JWTs', () => {
    expect(isPrivilegedKey(fakeJwt({ role: 'anon' }))).toBe(false)
  })

  it('rejects legacy service-role JWTs', () => {
    expect(isPrivilegedKey(fakeJwt({ role: 'service_role' }))).toBe(true)
  })

  it('does not throw on malformed input', () => {
    expect(isPrivilegedKey('not.a.jwt')).toBe(false)
    expect(isPrivilegedKey('')).toBe(false)
  })
})
