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
  })
})
