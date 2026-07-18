import { describe, expect, it } from 'vitest'
import { parseBillFile } from './bill-file'

const wechat = `微信支付账单明细
交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号,商户单号,备注
2026-06-30 12:00:00,商户消费,美团外卖,外卖,支出,¥29.00,零钱,支付成功,wx_mail_001,m_001,/
`

const alipay = `支付宝交易记录明细查询
交易时间,交易分类,交易对方,对方账号,商品说明,收/支,金额,收/付款方式,交易状态,交易订单号,商家订单号,备注
2026-06-01 09:00:00,转账,某公司,xxx@alipay.com,工资,收入,5000.00,余额,交易成功,ali_mail_001,/,
`

describe('parseBillFile', () => {
  it('detects and parses a WeChat CSV', async () => {
    const result = await parseBillFile('微信账单.csv', new TextEncoder().encode(wechat))
    expect(result.source).toBe('wechat')
    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0].externalId).toBe('wx_mail_001')
  })

  it('detects and parses an Alipay CSV', async () => {
    const result = await parseBillFile('支付宝账单.csv', new TextEncoder().encode(alipay))
    expect(result.source).toBe('alipay')
    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0].externalId).toBe('ali_mail_001')
  })

  it('rejects unsupported statement files', async () => {
    await expect(parseBillFile('notes.txt', new TextEncoder().encode('hello')))
      .rejects.toThrow('仅支持微信或支付宝 CSV/XLS/XLSX 账单')
  })
})
