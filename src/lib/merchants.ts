export interface MerchantRule {
  name: string
  emoji: string
  keywords: string[]
}

// Order matters: more specific rules first
const RULES: MerchantRule[] = [
  // ── 电商平台 ──────────────────────────────────────
  { name: '京东', emoji: '🛒', keywords: ['京东', 'JD.COM', 'JINGDONG', '京东商城', '京东物流', '京东健康', '京东超市', 'JD COM'] },
  { name: '淘宝', emoji: '🛍️', keywords: ['淘宝', 'TAOBAO', 'TAO BAO', '淘宝网'] },
  { name: '天猫', emoji: '🐱', keywords: ['天猫', 'TMALL', 'T-MALL', '天猫超市', '天猫国际'] },
  { name: '拼多多', emoji: '🛒', keywords: ['拼多多', 'PINDUODUO', 'PDD'] },
  { name: '抖音商城', emoji: '🎵', keywords: ['抖音', 'DOUYIN', '抖音商城', '抖音小店', '字节'] },
  { name: '快手商城', emoji: '✋', keywords: ['快手小店', '快手商城', '快手'] },
  { name: '小红书', emoji: '📕', keywords: ['小红书', 'XIAOHONGSHU', 'REDBOOK'] },
  { name: '得物', emoji: '👟', keywords: ['得物', 'DEWU', 'POIZON'] },
  { name: '唯品会', emoji: '🏷️', keywords: ['唯品会', 'VIPSHOP', 'VIP.COM'] },
  { name: '苏宁易购', emoji: '🖥️', keywords: ['苏宁', 'SUNING'] },
  { name: '当当', emoji: '📚', keywords: ['当当', 'DANGDANG'] },
  { name: '网易严选', emoji: '✅', keywords: ['网易严选', '严选', 'YANXUAN'] },
  { name: '亚马逊', emoji: '📦', keywords: ['亚马逊', 'AMAZON'] },
  { name: '闲鱼', emoji: '🐟', keywords: ['闲鱼', 'XIANYU'] },
  { name: '转转', emoji: '🔄', keywords: ['转转', 'ZHUANZHUAN'] },

  // ── 餐饮外卖 ──────────────────────────────────────
  { name: '美团', emoji: '🛵', keywords: ['美团', 'MEITUAN', '美团外卖', '美团单车', '美团买菜', '美团闪购', '美团优选'] },
  { name: '饿了么', emoji: '🍱', keywords: ['饿了么', 'ELEME', 'ELEMERD', '饿了么外卖', 'ELE.ME'] },
  { name: '麦当劳', emoji: '🍔', keywords: ['麦当劳', 'MCDONALD', "MCDONALD'S", 'MCDONALDS'] },
  { name: '肯德基', emoji: '🍗', keywords: ['肯德基', 'KFC', 'YUM', 'YUMCHINA'] },
  { name: '必胜客', emoji: '🍕', keywords: ['必胜客', 'PIZZA HUT', 'PIZZAHUT'] },
  { name: '汉堡王', emoji: '🍔', keywords: ['汉堡王', 'BURGER KING', 'BURGERKING'] },
  { name: '华莱士', emoji: '🍟', keywords: ['华莱士'] },
  { name: '塔斯汀', emoji: '🌯', keywords: ['塔斯汀'] },
  { name: '德克士', emoji: '🍗', keywords: ['德克士', 'DICOS'] },
  { name: '星巴克', emoji: '☕', keywords: ['星巴克', 'STARBUCKS'] },
  { name: '瑞幸咖啡', emoji: '☕', keywords: ['瑞幸', 'LUCKIN', 'LUCKINCOFFEE'] },
  { name: '蜜雪冰城', emoji: '🧋', keywords: ['蜜雪', '蜜雪冰城'] },
  { name: '喜茶', emoji: '🧋', keywords: ['喜茶', 'HEYTEA'] },
  { name: '奈雪', emoji: '🧋', keywords: ['奈雪', 'NAYUKI'] },
  { name: '古茗', emoji: '🧋', keywords: ['古茗', 'GUMINGCHA'] },
  { name: '茶百道', emoji: '🧋', keywords: ['茶百道', 'CHABAIDAO'] },
  { name: '沪上阿姨', emoji: '🧋', keywords: ['沪上阿姨'] },
  { name: '海底捞', emoji: '🍲', keywords: ['海底捞', 'HAIDILAO'] },
  { name: '西贝', emoji: '🥟', keywords: ['西贝', 'XIBEI'] },
  { name: '太二酸菜鱼', emoji: '🐟', keywords: ['太二', '太二酸菜'] },
  { name: '呷哺呷哺', emoji: '🍲', keywords: ['呷哺'] },
  { name: '真功夫', emoji: '🥢', keywords: ['真功夫', 'KUNGFU'] },
  { name: '老乡鸡', emoji: '🐔', keywords: ['老乡鸡'] },

  // ── 出行交通 ──────────────────────────────────────
  { name: '滴滴出行', emoji: '🚗', keywords: ['滴滴', 'DIDI', '滴滴出行', '滴滴打车'] },
  { name: '高德打车', emoji: '🚕', keywords: ['高德', '高德打车', '高德出行', 'AMAP'] },
  { name: '曹操出行', emoji: '🚙', keywords: ['曹操出行', '曹操'] },
  { name: 'T3出行', emoji: '🚙', keywords: ['T3出行', 'T3'] },
  { name: '享道出行', emoji: '🚙', keywords: ['享道'] },
  { name: '如祺出行', emoji: '🚙', keywords: ['如祺'] },
  { name: '神州专车', emoji: '🚙', keywords: ['神州专车', '神州', 'UCAR'] },
  { name: '哈啰出行', emoji: '🚲', keywords: ['哈啰', '哈罗', 'HELLOBIKE', 'HELLO'] },
  { name: '青桔单车', emoji: '🚲', keywords: ['青桔'] },
  { name: '摩拜单车', emoji: '🚲', keywords: ['摩拜', 'MOBIKE'] },
  { name: '高铁/火车', emoji: '🚄', keywords: ['铁路', '12306', '高铁', '动车', '火车', '中国铁路', 'CHINA RAILWAY'] },
  { name: '地铁/公交', emoji: '🚇', keywords: ['地铁', '公交', '城铁', '轨道交通', '地铁互联互通', '交通卡'] },
  { name: '航空', emoji: '✈️', keywords: ['航空', '机票', '东方航空', '南方航空', '中国国航', '厦门航空', '海南航空', '深圳航空', '吉祥航空', '春秋航空', '西部航空', 'MU', 'CZ', 'CA', 'XM'] },

  // ── 旅行住宿 ──────────────────────────────────────
  { name: '携程', emoji: '🏨', keywords: ['携程', 'CTRIP', 'TRIP.COM'] },
  { name: '飞猪旅行', emoji: '🐷', keywords: ['飞猪', 'FLIGGY', 'ALITRIP'] },
  { name: '去哪儿', emoji: '✈️', keywords: ['去哪儿', 'QUNAR'] },
  { name: '同程旅行', emoji: '🚌', keywords: ['同程', 'TONGCHENG'] },
  { name: '马蜂窝', emoji: '🐝', keywords: ['马蜂窝', 'MAFENGWO'] },
  { name: '如家酒店', emoji: '🏩', keywords: ['如家', 'HOME INN'] },
  { name: '汉庭酒店', emoji: '🏩', keywords: ['汉庭', 'HANTING'] },
  { name: '华住酒店', emoji: '🏨', keywords: ['华住', 'H WORLD', 'HUAZHU'] },
  { name: '锦江酒店', emoji: '🏨', keywords: ['锦江', 'JINJIANG'] },
  { name: 'Airbnb', emoji: '🏠', keywords: ['AIRBNB', 'Airbnb'] },

  // ── 超市便利店 ──────────────────────────────────────
  { name: '盒马', emoji: '🦛', keywords: ['盒马', 'HEMA', 'FRESHIPPO'] },
  { name: '叮咚买菜', emoji: '🥦', keywords: ['叮咚买菜', '叮咚'] },
  { name: '朴朴超市', emoji: '🛒', keywords: ['朴朴'] },
  { name: '山姆', emoji: '🏪', keywords: ['山姆', "SAM'S", 'SAMS CLUB'] },
  { name: '沃尔玛', emoji: '🏪', keywords: ['沃尔玛', 'WALMART', 'WAL-MART'] },
  { name: '家乐福', emoji: '🏪', keywords: ['家乐福', 'CARREFOUR'] },
  { name: '大润发', emoji: '🏪', keywords: ['大润发', 'RT-MART', 'RTMART'] },
  { name: '永辉超市', emoji: '🏪', keywords: ['永辉'] },
  { name: '华润万家', emoji: '🏪', keywords: ['华润万家', '华润', '万家'] },
  { name: '7-Eleven', emoji: '🏪', keywords: ['7-11', '7-ELEVEN', 'SEVEN ELEVEN', 'SEVENELEVEN'] },
  { name: '全家', emoji: '🏪', keywords: ['全家', 'FAMILY MART', 'FAMILYMART'] },
  { name: '罗森', emoji: '🏪', keywords: ['罗森', 'LAWSON'] },
  { name: '便利蜂', emoji: '🐝', keywords: ['便利蜂', 'BIANLIFENG'] },
  { name: '多多买菜', emoji: '🥦', keywords: ['多多买菜'] },
  { name: '美团买菜', emoji: '🥦', keywords: ['美团买菜', '小象超市'] },

  // ── 娱乐媒体 ──────────────────────────────────────
  { name: '爱奇艺', emoji: '🎬', keywords: ['爱奇艺', 'IQIYI', 'IQIYI.COM'] },
  { name: '腾讯视频', emoji: '🎬', keywords: ['腾讯视频', '腾讯影视', 'TENCENT VIDEO'] },
  { name: '优酷', emoji: '🎬', keywords: ['优酷', 'YOUKU'] },
  { name: 'B站', emoji: '📺', keywords: ['哔哩哔哩', 'BILIBILI', 'B站'] },
  { name: '芒果TV', emoji: '🥭', keywords: ['芒果', 'MANGO', 'HUNANTV'] },
  { name: '西瓜视频', emoji: '🍉', keywords: ['西瓜视频', 'XIGUA'] },
  { name: 'Netflix', emoji: '🎬', keywords: ['NETFLIX'] },
  { name: 'Spotify', emoji: '🎵', keywords: ['SPOTIFY'] },
  { name: '网易云音乐', emoji: '🎵', keywords: ['网易云音乐', '网易云', 'NETEASE MUSIC'] },
  { name: 'QQ音乐', emoji: '🎵', keywords: ['QQ音乐', 'QQ MUSIC', 'QQMUSIC'] },
  { name: 'Apple', emoji: '🍎', keywords: ['APP STORE', 'APPLE', 'ITUNES', 'ICLOUD', 'APPLE.COM'] },

  // ── 游戏 ──────────────────────────────────────────
  { name: '腾讯游戏', emoji: '🎮', keywords: ['腾讯游戏', '王者荣耀', '和平精英', '英雄联盟', 'TENCENT GAMES', 'WEGAME'] },
  { name: '网易游戏', emoji: '🎮', keywords: ['网易游戏', '梦幻西游', '阴阳师', '蛋仔派对', 'NETEASE GAMES'] },
  { name: 'Steam', emoji: '🕹️', keywords: ['STEAM', 'VALVE'] },
  { name: 'PlayStation', emoji: '🎮', keywords: ['PLAYSTATION', 'PSN', 'SONY INTERACTIVE'] },
  { name: 'Xbox', emoji: '🎮', keywords: ['XBOX', 'MICROSOFT STORE'] },
  { name: 'App Store', emoji: '📱', keywords: ['APP STORE'] },

  // ── 教育学习 ──────────────────────────────────────
  { name: '知乎', emoji: '🤔', keywords: ['知乎', 'ZHIHU'] },
  { name: '得到', emoji: '📖', keywords: ['得到APP', '得到', 'DEDAO'] },
  { name: '樊登读书', emoji: '📚', keywords: ['樊登', 'FANDENG'] },
  { name: '极客时间', emoji: '⏱️', keywords: ['极客时间', 'GEEKBANG'] },
  { name: '腾讯课堂', emoji: '🎓', keywords: ['腾讯课堂', 'KE.QQ'] },
  { name: '网易公开课', emoji: '🎓', keywords: ['网易公开课', '中国大学MOOC'] },
  { name: 'Coursera', emoji: '🎓', keywords: ['COURSERA'] },
  { name: '多邻国', emoji: '🦜', keywords: ['多邻国', 'DUOLINGO'] },

  // ── 医疗健康 ──────────────────────────────────────
  { name: '京东健康', emoji: '💊', keywords: ['京东健康', 'JD HEALTH'] },
  { name: '阿里健康', emoji: '💊', keywords: ['阿里健康', '医鹿'] },
  { name: '好大夫', emoji: '👨‍⚕️', keywords: ['好大夫', 'HAODF'] },
  { name: '丁香医生', emoji: '🌿', keywords: ['丁香', 'DINGXIANG'] },
  { name: '健康160', emoji: '💉', keywords: ['健康160'] },
  { name: '健身房', emoji: '💪', keywords: ['健身', 'GYM', '超级猩猩', '乐刻', '威尔士', 'KEEPLAND'] },
  { name: 'Keep', emoji: '🏃', keywords: ['KEEP', 'KEEPAPP'] },

  // ── 快递物流 ──────────────────────────────────────
  { name: '顺丰快递', emoji: '📦', keywords: ['顺丰', 'SF EXPRESS', 'SFEXPRESS', 'SF-EXPRESS'] },
  { name: '中通快递', emoji: '📦', keywords: ['中通', 'ZTO'] },
  { name: '圆通快递', emoji: '📦', keywords: ['圆通', 'YTO'] },
  { name: '韵达快递', emoji: '📦', keywords: ['韵达', 'YUNDA'] },
  { name: '申通快递', emoji: '📦', keywords: ['申通', 'STO'] },
  { name: '菜鸟驿站', emoji: '🐦', keywords: ['菜鸟', 'CAINIAO'] },
  { name: 'DHL', emoji: '📦', keywords: ['DHL'] },
  { name: 'UPS', emoji: '📦', keywords: ['UPS'] },
  { name: 'FedEx', emoji: '📦', keywords: ['FEDEX'] },

  // ── 数码科技 ──────────────────────────────────────
  { name: '华为', emoji: '📱', keywords: ['华为', 'HUAWEI', 'VMALL'] },
  { name: '小米', emoji: '📱', keywords: ['小米', 'XIAOMI', 'MI STORE'] },
  { name: 'OPPO', emoji: '📱', keywords: ['OPPO', 'OPLUS'] },
  { name: 'vivo', emoji: '📱', keywords: ['VIVO'] },
  { name: '一加', emoji: '📱', keywords: ['一加', 'ONEPLUS'] },
  { name: '微软', emoji: '💻', keywords: ['微软', 'MICROSOFT'] },
  { name: '联想', emoji: '💻', keywords: ['联想', 'LENOVO'] },

  // ── 生活服务 ──────────────────────────────────────
  { name: '大众点评', emoji: '⭐', keywords: ['大众点评', '点评'] },
  { name: '58同城', emoji: '🏠', keywords: ['58同城', '58'] },
  { name: '贝壳找房', emoji: '🏠', keywords: ['贝壳', 'KE.COM', '链家', 'LIANJIA'] },
  { name: '自如', emoji: '🏠', keywords: ['自如', 'ZIROOM'] },
  { name: '蛋壳公寓', emoji: '🏠', keywords: ['蛋壳'] },
  { name: '洗衣服务', emoji: '👕', keywords: ['洗衣', '干洗', '洗护'] },
  { name: '理发', emoji: '💈', keywords: ['理发', '发型', '美发', '剪发'] },

  // ── 金融保险 ──────────────────────────────────────
  { name: '支付宝理财', emoji: '💰', keywords: ['余额宝', '花呗', '借呗', '蚂蚁财富', '蚂蚁理财'] },
  { name: '微信理财', emoji: '💰', keywords: ['理财通', '零钱通'] },
  { name: '平安保险', emoji: '🛡️', keywords: ['平安保险', '平安人寿', '平安产险', '平安健康'] },
  { name: '众安保险', emoji: '🛡️', keywords: ['众安', 'ZHONGAN'] },
  { name: '蚂蚁保险', emoji: '🛡️', keywords: ['蚂蚁保', '蚂蚁保险', '相互宝'] },

  // ── 充值缴费 ──────────────────────────────────────
  { name: '话费充值', emoji: '📲', keywords: ['话费', '手机充值', '流量', '中国移动', '中国联通', '中国电信', 'CHINA MOBILE', 'CHINA UNICOM', 'CHINA TELECOM'] },
  { name: '电费/水费', emoji: '💡', keywords: ['国家电网', '南方电网', '供电', '水费', '燃气', '天然气', '物业'] },
  { name: 'ETC/停车', emoji: '🚗', keywords: ['ETC', '停车', '高速', '路桥', '路费'] },
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
