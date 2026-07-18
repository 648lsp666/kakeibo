import { describe, it, expect } from 'vitest'
import { parseWechatCSV } from './csv-wechat'

const SAMPLE = `微信支付账单明细,,,,,,,,,,
账号：[xxx@qq.com],,,,,,,,,,
起始时间：[2026-06-01 00:00:00] 终止时间：[2026-06-30 23:59:59],,,,,,,,,,
共2笔记录,,,,,,,,,,
收入：1笔 5000.00元 支出：1笔 29.00元 中性交易：0笔 0.00元,,,,,,,,,,
注：充值/提现/理财通购买/零钱通存取为中性交易,,,,,,,,,,
交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号,商户单号,备注
2026-06-30 12:00:00,商户消费,美团外卖,外卖,支出,¥29.00,零钱,支付成功,wx_001,m_001,/
2026-06-01 09:00:00,转账,某某公司,工资,收入,¥5000.00,零钱通,支付成功,wx_002,/,工资
`

const SAMPLE_WITH_NEUTRAL = SAMPLE + '2026-06-29 10:00:00,/,零钱通,零钱通存入,不计收支,¥100.00,零钱通,已存入零钱通,wx_003,/,/\n'
const SAMPLE_WITH_SLASH_NEUTRAL = SAMPLE + '2026-06-28 10:00:00,零钱提现,工商银行(7387),/,/,1165.79,工商银行储蓄卡(7387),提现已到账,wx_004,/,/\n'

describe('parseWechatCSV', () => {
  it('parses 2 transactions', () => {
    expect(parseWechatCSV(SAMPLE)).toHaveLength(2)
  })

  it('correctly parses an expense', () => {
    const txs = parseWechatCSV(SAMPLE)
    const expense = txs.find(t => t.externalId === 'wx_001')!
    expect(expense.amount).toBe(29)
    expect(expense.type).toBe('expense')
    expect(expense.date).toBe('2026-06-30')
  })

  it('correctly parses income', () => {
    const txs = parseWechatCSV(SAMPLE)
    const income = txs.find(t => t.externalId === 'wx_002')!
    expect(income.type).toBe('income')
    expect(income.amount).toBe(5000)
    expect(income.categoryId).toBe('sys-salary')
  })

  it('skips 不计收支 rows', () => {
    expect(parseWechatCSV(SAMPLE_WITH_NEUTRAL)).toHaveLength(2)
  })

  it('skips current WeChat XLSX neutral rows marked with a slash', () => {
    expect(parseWechatCSV(SAMPLE_WITH_SLASH_NEUTRAL)).toHaveLength(2)
  })
})
