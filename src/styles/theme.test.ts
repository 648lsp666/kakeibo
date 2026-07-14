import { expect, it } from 'vitest'
// @ts-ignore -- Node types are not part of the browser build's type surface.
import { readFileSync } from 'node:fs'

// @ts-ignore -- Vitest supplies process while the application targets browsers.
const themeCss = readFileSync(`${process.cwd()}/src/styles/theme.css`, 'utf8')

const channel = (hex: string, offset: number) => {
  const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

const luminance = (hex: string) => (
  0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5)
)

const contrast = (first: string, second: string) => {
  const lighter = Math.max(luminance(first), luminance(second))
  const darker = Math.min(luminance(first), luminance(second))
  return (lighter + 0.05) / (darker + 0.05)
}

const token = (theme: string, name: string) => {
  const value = theme.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1]
  expect(value, `missing --${name}`).toBeDefined()
  return value as string
}

const baseTheme = themeCss.match(/:root\s*\{([^}]*)\}/)?.[1] ?? ''

const resolvedToken = (theme: string, name: string): string => {
  const pattern = new RegExp(`--${name}:\\s*([^;]+);`, 'i')
  const value = (theme.match(pattern) ?? baseTheme.match(pattern))?.[1].trim()
  expect(value, `missing --${name}`).toBeDefined()
  const reference = value?.match(/^var\(--([^)]+)\)$/)?.[1]
  return reference ? resolvedToken(theme, reference) : value as string
}

it('keeps the small-text token at 4.5:1 against Task 4 surfaces in both themes', () => {
  const themes = [...themeCss.matchAll(/:root\s*\{([^}]*)\}/g)].map((match) => match[1])
  expect(themes).toHaveLength(2)

  for (const theme of themes) {
    const smallText = token(theme, 'color-text-small')
    for (const surface of ['color-bg-secondary', 'color-bg-card', 'color-bg-elevated', 'color-primary-soft']) {
      expect(contrast(smallText, token(theme, surface)), `${surface} contrast`).toBeGreaterThanOrEqual(4.5)
    }
  }
})

it('keeps semantic accent text tokens at 4.5:1 against Task 5 surfaces in both themes', () => {
  const themes = [...themeCss.matchAll(/:root\s*\{([^}]*)\}/g)].map((match) => match[1])
  expect(themes).toHaveLength(2)

  const textTokens = [
    'color-primary-text',
    'color-expense-text',
    'color-warning-text',
    'color-income-text',
  ]
  const surfaces = [
    'color-bg-card',
    'color-bg-secondary',
    'color-danger-soft',
    'color-bg-elevated',
    'color-primary-soft',
  ]

  for (const theme of themes) {
    for (const textToken of textTokens) {
      for (const surface of surfaces) {
        expect(
          contrast(token(theme, textToken), token(theme, surface)),
          `${textToken} on ${surface}`,
        ).toBeGreaterThanOrEqual(4.5)
      }
    }
  }
})

it('keeps the selected budget period semantic pair at 4.5:1 in both themes', () => {
  const themes = [...themeCss.matchAll(/:root\s*\{([^}]*)\}/g)].map((match) => match[1])
  expect(themes).toHaveLength(2)

  for (const theme of themes) {
    expect(
      contrast(token(theme, 'color-on-primary'), token(theme, 'color-primary')),
      'color-on-primary on color-primary',
    ).toBeGreaterThanOrEqual(4.5)
  }
})

it('keeps imported-source badge text at 4.5:1 in both themes', () => {
  const themes = [...themeCss.matchAll(/:root\s*\{([^}]*)\}/g)].map((match) => match[1])
  expect(themes).toHaveLength(2)

  for (const theme of themes) {
    for (const source of ['wechat', 'alipay', 'bank']) {
      expect(
        contrast(
          resolvedToken(theme, `color-source-${source}`),
          resolvedToken(theme, `color-source-${source}-soft`),
        ),
        `${source} source badge contrast`,
      ).toBeGreaterThanOrEqual(4.5)
    }
  }
})

it('keeps Task 8 foreground aliases safe on their actual surfaces in both themes', () => {
  const themes = [...themeCss.matchAll(/:root\s*\{([^}]*)\}/g)].map((match) => match[1])
  expect(themes).toHaveLength(2)

  const actualPairs = [
    ['color-text-small', 'color-bg-card'],
    ['color-text-small', 'color-bg-secondary'],
    ['color-income-text', 'color-bg-card'],
    ['color-income-text', 'color-bg-secondary'],
    ['color-income-text', 'color-bg'],
    ['color-expense-text', 'color-bg-card'],
    ['color-expense-text', 'color-bg'],
  ] as const

  for (const theme of themes) {
    for (const [foreground, surface] of actualPairs) {
      expect(
        contrast(token(theme, foreground), token(theme, surface)),
        `${foreground} on ${surface}`,
      ).toBeGreaterThanOrEqual(4.5)
    }
  }
})
