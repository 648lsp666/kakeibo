const RULES: { patterns: string[]; categoryId: string }[] = [
  { patterns: ['美团', '饿了么', '麦当劳', '肯德基', '星巴克', '瑞幸', '必胜客', '海底捞', '外卖'], categoryId: 'sys-food' },
  { patterns: ['滴滴', '高铁', '地铁', '公交', '加油', '中石油', '中石化', '打车', '出行', '铁路'], categoryId: 'sys-transit' },
  { patterns: ['淘宝', '京东', '拼多多', '天猫', '唯品会', '苏宁', '购物'], categoryId: 'sys-shop' },
  { patterns: ['Steam', '游戏', 'bilibili', 'B站', '网易', '腾讯游戏', '王者', '原神'], categoryId: 'sys-fun' },
  { patterns: ['水电', '燃气', '物业', '房租', '超市', '家居'], categoryId: 'sys-home' },
  { patterns: ['医院', '药店', '诊所', '健康', '医疗'], categoryId: 'sys-medical' },
  { patterns: ['书', '课程', '培训', '学习', '教育'], categoryId: 'sys-edu' },
]

export function guessCategory(merchant: string): string {
  const lower = merchant.toLowerCase()
  for (const rule of RULES) {
    if (rule.patterns.some(p => lower.includes(p.toLowerCase()))) {
      return rule.categoryId
    }
  }
  return 'sys-other-ex'
}
