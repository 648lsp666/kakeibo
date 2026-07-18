import { describe, expect, it } from 'vitest'
import { isCleanupRequestAuthorized } from './cleanup-auth'

describe('expired bill cleanup authorization', () => {
  it('requires an exact non-trivial shared secret', () => {
    expect(isCleanupRequestAuthorized('a-long-cleanup-secret', 'a-long-cleanup-secret')).toBe(true)
    expect(isCleanupRequestAuthorized('wrong', 'a-long-cleanup-secret')).toBe(false)
    expect(isCleanupRequestAuthorized('', '')).toBe(false)
    expect(isCleanupRequestAuthorized('short', 'short')).toBe(false)
  })
})
