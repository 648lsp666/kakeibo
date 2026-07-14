import type { Category } from '../../types'

export const ICON_NAMES = [
  'ledger', 'chart', 'category', 'settings', 'plus', 'close', 'chevron-left',
  'chevron-right', 'download', 'upload', 'cloud', 'database', 'trash', 'warning',
  'check', 'info', 'calendar', 'target', 'wallet', 'food', 'cart', 'transit',
  'game', 'home', 'medical', 'book', 'briefcase', 'coins', 'gift', 'coffee',
  'tea', 'plane', 'beauty', 'pet', 'phone', 'fitness', 'music', 'camera', 'more',
] as const

export type IconName = (typeof ICON_NAMES)[number]

export const LEGACY_EMOJI_ICON_MAP: Record<string, IconName> = {
  '🍜': 'food', '🛒': 'cart', '🚌': 'transit', '🎮': 'game', '🏠': 'home',
  '💊': 'medical', '📚': 'book', '📦': 'category', '💼': 'briefcase',
  '💰': 'coins', '🎁': 'gift', '☕': 'coffee', '🍵': 'tea', '✈️': 'plane',
  '💄': 'beauty', '🐶': 'pet', '📱': 'phone', '🏋️': 'fitness', '🎵': 'music', '📷': 'camera',
}

const paths: Record<IconName, React.ReactNode> = {
  ledger: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 5.5v16M8 7h7M8 11h5"/></>,
  chart: <><path d="M5 19v-7M12 19V5M19 19v-4"/><path d="M3 19h18"/></>,
  category: <><path d="m20 13-7 7-9-9V4h7z"/><circle cx="8" cy="8" r="1"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2-.7-.7-1.7.9-1.9-2.4-2.4-1.9.9-1.7-.7-.7-2h-3l-.7 2-1.7.7-1.9-.9-2.4 2.4.9 1.9-.7 1.7-2 .7v3l2 .7.7 1.7-.9 1.9 2.4 2.4 1.9-.9 1.7.7.7 2h3l.7-2 1.7-.7 1.9.9 2.4-2.4-.9-1.9.7-1.7z"/></>,
  plus: <path d="M12 5v14M5 12h14"/>, close: <path d="m6 6 12 12M18 6 6 18"/>,
  'chevron-left': <path d="m15 18-6-6 6-6"/>, 'chevron-right': <path d="m9 18 6-6-6-6"/>,
  download: <><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 20h14"/></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 20h14"/></>,
  cloud: <path d="M7 18h11a4 4 0 0 0 .5-8A6 6 0 0 0 7 8.5 4.5 4.5 0 0 0 7 18z"/>,
  database: <><ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></>,
  trash: <><path d="M4 7h16M9 3h6l1 4M7 7l1 14h8l1-14M10 11v6M14 11v6"/></>,
  warning: <><path d="M12 3 2.5 20h19z"/><path d="M12 9v4M12 17h.01"/></>,
  check: <path d="m5 12 4 4L19 6"/>, info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></>,
  target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
  wallet: <><path d="M4 6h14a2 2 0 0 1 2 2v11H4a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h12"/><path d="M15 11h5v4h-5a2 2 0 0 1 0-4z"/></>,
  food: <><path d="M6 3v7M9 3v7M6 7h3M7.5 10v11M16 3c-2 3-2 7 0 9h2V3zM17 12v9"/></>,
  cart: <><path d="M3 4h2l2 11h10l3-7H6M9 20h.01M17 20h.01"/></>,
  transit: <><rect x="5" y="3" width="14" height="16" rx="3"/><path d="M5 10h14M8 15h.01M16 15h.01M8 19l-2 2M16 19l2 2"/></>,
  game: <><path d="M8 8h8a5 5 0 0 1 4.5 7.2L19 18h-3l-2-2h-4l-2 2H5l-1.5-2.8A5 5 0 0 1 8 8z"/><path d="M8 11v4M6 13h4M16 12h.01M18 14h.01"/></>,
  home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10M9 21v-6h6v6"/></>,
  medical: <><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></>,
  book: <><path d="M4 5a3 3 0 0 1 3-2h5v17H7a3 3 0 0 0-3 2zM20 5a3 3 0 0 0-3-2h-5v17h5a3 3 0 0 1 3 2z"/></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V4h6v3M3 12h18M10 12v2h4v-2"/></>,
  coins: <><ellipse cx="9" cy="7" rx="5" ry="3"/><path d="M4 7v4c0 1.7 2.2 3 5 3s5-1.3 5-3V7M6 14v3c0 1.7 2.2 3 5 3s5-1.3 5-3v-4"/><path d="M14 10c3 0 5 1.3 5 3s-2 3-5 3"/></>,
  gift: <><rect x="3" y="9" width="18" height="12" rx="2"/><path d="M12 9v12M3 13h18M7.5 9C5 9 5 5 7 5c2 0 5 4 5 4M16.5 9C19 9 19 5 17 5c-2 0-5 4-5 4"/></>,
  coffee: <><path d="M4 8h13v6a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6zM17 10h1a3 3 0 0 1 0 6h-2"/><path d="M7 4v2M11 3v3M15 4v2"/></>,
  tea: <><path d="M5 9h12v5a6 6 0 0 1-6 6 6 6 0 0 1-6-6zM17 11h1a3 3 0 0 1 0 6h-2"/><path d="M12 9c0-3 2-5 5-5-1 3-2 5-5 5z"/></>,
  plane: <><path d="M22 2 9 15M22 2l-7 19-4-8-8-4z"/></>, beauty: <><path d="M8 3h8v4H8zM7 7h10v14H7zM10 11h4"/></>,
  pet: <><circle cx="7" cy="8" r="2"/><circle cx="17" cy="8" r="2"/><circle cx="5" cy="13" r="2"/><circle cx="19" cy="13" r="2"/><path d="M12 11c-4 0-6 4-4 7 1.5 2 6.5 2 8 0 2-3 0-7-4-7z"/></>,
  phone: <><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/></>,
  fitness: <><path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12"/></>,
  music: <><path d="M9 18V5l10-2v13M9 8l10-2"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></>,
  camera: <><path d="M4 7h4l2-3h4l2 3h4v13H4z"/><circle cx="12" cy="13" r="4"/></>,
  more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
}

export function Icon({ name, size = 20, label, className }: {
  name: IconName; size?: number; label?: string; className?: string
}) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} role={label ? 'img' : undefined}
      aria-label={label} aria-hidden={label ? undefined : true}>
      {paths[name] ?? paths.category}
    </svg>
  )
}

export function categoryIconName(category?: Pick<Category, 'icon' | 'emoji'>): IconName {
  if (category?.icon && ICON_NAMES.includes(category.icon)) return category.icon
  if (category?.emoji && LEGACY_EMOJI_ICON_MAP[category.emoji]) return LEGACY_EMOJI_ICON_MAP[category.emoji]
  return 'category'
}
