export interface MerchantRule {
  name: string
  emoji: string
  keywords: string[]
}

const RULES: MerchantRule[] = [
  // 电商
  { name: '京东',     emoji: '🛒', keywords: ['京东', 'JD.COM', 'JINGDONG'] },
  { name: '淘宝',     emoji: '🛍️', keywords: ['淘宝', 'TAOBAO'] },
  { name: '天猫',     emoji: '🐱', keywords: ['天猫', 'TMALL'] },
  { name: '拼多多',   emoji: '🛒', keywords: ['拼多多', 'PINDUODUO'] },
  { name: '抖音商城', emoji: '🎵', keywords: ['抖音', '字节跳动'] },
  { name: '小红书',   emoji: '📕', keywords: ['小红书'] },
  { name: '得物',     emoji: '👟', keywords: ['得物', 'POIZON'] },
  // 外卖餐饮
  { name: '美团',     emoji: '🛵', keywords: ['美团', 'MEITUAN'] },
  { name: '饿了么',   emoji: '🍱', keywords: ['饿了么', 'ELEME'] },
  { name: '麦当劳',   emoji: '🍔', keywords: ['麦当劳', 'MCDONALD'] },
  { name: '肯德基',   emoji: '🍗', keywords: ['肯德基', 'KFC'] },
  { name: '星巴克',   emoji: '☕', keywords: ['星巴克', 'STARBUCKS'] },
  { name: '瑞幸咖啡', emoji: '☕', keywords: ['瑞幸', 'LUCKIN'] },
  { name: '蜜雪冰城', emoji: '🧋', keywords: ['蜜雪'] },
  { name: '喜茶',     emoji: '🧋', keywords: ['喜茶', 'HEYTEA'] },
  { name: '海底捞',   emoji: '🍲', keywords: ['海底捞'] },
  // 出行
  { name: '滴滴出行', emoji: '🚗', keywords: ['滴滴', 'DIDI'] },
  { name: '高铁/火车', emoji: '🚄', keywords: ['铁路', '12306', '高铁', '火车', '动车'] },
  { name: '地铁/公交', emoji: '🚇', keywords: ['地铁', '公交', '轨道交通'] },
  { name: '航空',     emoji: '✈️', keywords: ['航空', '机票', '东方航空', '南方航空', '中国国航'] },
  { name: '携程',     emoji: '🏨', keywords: ['携程', 'CTRIP'] },
  { name: '哈啰出行', emoji: '🚲', keywords: ['哈啰', '哈罗'] },
  // 超市便利
  { name: '盒马',     emoji: '🦛', keywords: ['盒马', 'HEMA'] },
  { name: '山姆',     emoji: '🏪', keywords: ['山姆', "SAM'S"] },
  { name: '7-Eleven', emoji: '🏪', keywords: ['7-11', '7-ELEVEN'] },
  { name: '全家',     emoji: '🏪', keywords: ['全家', 'FAMILYMART'] },
  // 娱乐媒体
  { name: 'B站',      emoji: '📺', keywords: ['哔哩哔哩', 'BILIBILI'] },
  { name: '爱奇艺',   emoji: '🎬', keywords: ['爱奇艺', 'IQIYI'] },
  { name: '腾讯视频', emoji: '🎬', keywords: ['腾讯视频'] },
  { name: '网易云音乐', emoji: '🎵', keywords: ['网易云音乐', '网易云'] },
  { name: 'Apple',    emoji: '🍎', keywords: ['APP STORE', 'APPLE', 'ITUNES', 'ICLOUD'] },
  // 游戏
  { name: '腾讯游戏', emoji: '🎮', keywords: ['腾讯游戏', '王者荣耀', '和平精英', 'WEGAME'] },
  { name: 'Steam',    emoji: '🕹️', keywords: ['STEAM'] },
  // 快递
  { name: '顺丰快递', emoji: '📦', keywords: ['顺丰', 'SF EXPRESS'] },
  // 充值缴费
  { name: '话费充值', emoji: '📲', keywords: ['话费', '手机充值', '中国移动', '中国联通', '中国电信'] },
  { name: 'ETC/停车', emoji: '🅿️', keywords: ['ETC', '停车', '高速'] },
]

const upperCache = new Map<MerchantRule, string[]>()

export function detectMerchant(note: string): string | null {
  if (!note) return null
  const upper = note.toUpperCase()
  for (const rule of RULES) {
    let uppers = upperCache.get(rule)
    if (!uppers) {
      uppers = rule.keywords.map(k => k.toUpperCase())
      upperCache.set(rule, uppers)
    }
    for (const kw of uppers) {
      if (upper.includes(kw)) return rule.name
    }
  }
  return null
}

export function getMerchantEmoji(name: string): string {
  return RULES.find(r => r.name === name)?.emoji ?? '🏪'
}
