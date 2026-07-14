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
