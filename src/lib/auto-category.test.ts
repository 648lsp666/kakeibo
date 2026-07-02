import { describe, it, expect } from 'vitest'
import { guessCategory } from './auto-category'

describe('guessCategory', () => {
  it('matches 美团 to sys-food', () => expect(guessCategory('美团外卖')).toBe('sys-food'))
  it('matches 滴滴 to sys-transit', () => expect(guessCategory('滴滴出行')).toBe('sys-transit'))
  it('matches 淘宝 to sys-shop', () => expect(guessCategory('淘宝网')).toBe('sys-shop'))
  it('matches Steam to sys-fun', () => expect(guessCategory('Steam游戏')).toBe('sys-fun'))
  it('returns sys-other-ex for unknown', () => expect(guessCategory('无名商店')).toBe('sys-other-ex'))
})
