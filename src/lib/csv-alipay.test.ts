import { describe, it, expect } from 'vitest'
import { parseAlipayCSV } from './csv-alipay'

const SAMPLE = `支付宝交易记录明细查询
账号:[xxx@163.com]
起始日期:[2026-06-01] 终止日期:[2026-06-30]
---------------------------------交易记录明细列表------------------------------------
交易时间,交易分类,交易对方,对方账号,商品说明,收/支,金额,收/付款方式,交易状态,交易订单号,商家订单号,备注
2026-06-30 12:00:00,餐饮,美团,xxx@alipay.com,外卖,支出,29.00,余额宝,交易成功,ali_001,m_001,
2026-06-01 09:00:00,转账,某公司,xxx@alipay.com,工资,收入,5000.00,余额,交易成功,ali_002,/,
2026-06-20 10:00:00,其他,某商家,xxx,退款,支出,10.00,余额,交易关闭,ali_003,/,
`

const SPLIT_AMOUNT_SAMPLE = `支付宝交易记录明细查询
交易时间,交易分类,交易对方,对方账号,商品说明,收/付款方式,收入金额（+元）,支出金额（-元）,交易状态,交易订单号,商家订单号,备注
2026-07-16 12:00:00,餐饮,便利店,store@example.com,早餐,余额,,12.50,交易成功,ali_split_001,m_001,
2026-07-17 09:00:00,转账,朋友,friend@example.com,还款,余额,88.00,,交易成功,ali_split_002,m_002,
2026-07-17 10:00:00,餐饮,关闭商家,closed@example.com,关闭订单,余额,,6.00,交易关闭,ali_split_003,m_003,
`

// Matches the current Alipay export format supplied by the user: it has no
// “交易对方” column and includes rows marked as “不计收支”.
const CURRENT_ALIPAY_EXPORT_SAMPLE = `支付宝交易明细
交易时间,交易分类,对方账号,商品说明,收/支,金额,收/付款方式,交易状态,交易订单号,商家订单号,备注,
2026-07-17 00:07:36,医疗健康,service@example.com,SPACESHIP.COM,支出,11.38,余额宝,交易成功,ali_current_001,merchant_001,,
2026-07-16 06:07:48,投资理财,/,余额宝-收益发放,不计收支,0.02,余额宝,交易成功,ali_current_002,,,
2026-07-10 09:00:00,转账,friend@example.com,还款,收入,20.00,余额,交易成功,ali_current_003,,,
`

describe('parseAlipayCSV', () => {
  it('parses 2 valid transactions (skips closed)', () => {
    expect(parseAlipayCSV(SAMPLE)).toHaveLength(2)
  })

  it('parses expense correctly', () => {
    const txs = parseAlipayCSV(SAMPLE)
    const e = txs.find(t => t.externalId === 'ali_001')!
    expect(e.amount).toBe(29)
    expect(e.type).toBe('expense')
    expect(e.date).toBe('2026-06-30')
  })

  it('parses income correctly', () => {
    const txs = parseAlipayCSV(SAMPLE)
    const i = txs.find(t => t.externalId === 'ali_002')!
    expect(i.type).toBe('income')
    expect(i.amount).toBe(5000)
    expect(i.categoryId).toBe('sys-salary')
  })

  it('parses Alipay exports that split income and expense amount columns', () => {
    const txs = parseAlipayCSV(SPLIT_AMOUNT_SAMPLE)
    expect(txs).toHaveLength(2)
    expect(txs.find(t => t.externalId === 'ali_split_001')).toMatchObject({
      amount: 12.5,
      type: 'expense',
      date: '2026-07-16',
    })
    expect(txs.find(t => t.externalId === 'ali_split_002')).toMatchObject({
      amount: 88,
      type: 'income',
      categoryId: 'sys-transfer-in',
      date: '2026-07-17',
    })
  })

  it('parses the current Alipay export layout without a transaction-counterparty column', () => {
    const txs = parseAlipayCSV(CURRENT_ALIPAY_EXPORT_SAMPLE)
    expect(txs).toHaveLength(2)
    expect(txs.find(t => t.externalId === 'ali_current_001')).toMatchObject({
      amount: 11.38,
      type: 'expense',
      note: 'SPACESHIP.COM',
    })
    expect(txs.find(t => t.externalId === 'ali_current_003')).toMatchObject({
      amount: 20,
      type: 'income',
      note: '还款',
    })
  })
})
