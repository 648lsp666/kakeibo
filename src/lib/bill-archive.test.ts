import { BlobWriter, TextReader, Uint8ArrayReader, ZipWriter } from '@zip.js/zip.js'
import { describe, expect, it } from 'vitest'
import { utils, write } from 'xlsx'
import { parseEncryptedBillArchive } from './bill-archive'

const wechat = `微信支付账单明细
交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号,商户单号,备注
2026-06-30 12:00:00,商户消费,美团外卖,外卖,支出,¥29.00,零钱,支付成功,wx_zip_001,m_001,/
`

async function encryptedArchive(files: Record<string, string>, password = '123456'): Promise<ArrayBuffer> {
  const writer = new ZipWriter(new BlobWriter('application/zip'))
  for (const [name, content] of Object.entries(files)) {
    await writer.add(name, new TextReader(content), { password, encryptionStrength: 3 })
  }
  return (await writer.close()).arrayBuffer()
}

async function encryptedXlsxArchive(password = '123456'): Promise<ArrayBuffer> {
  const workbook = utils.book_new()
  const sheet = utils.aoa_to_sheet([
    ['微信支付账单明细'],
    [],
    ['交易时间', '交易类型', '交易对方', '商品', '收/支', '金额(元)', '支付方式', '当前状态', '交易单号'],
    ['2026-06-30 12:00:00', '商户消费', '美团外卖', '外卖', '支出', '29.00', '零钱', '支付成功', 'wx_xlsx_001'],
  ])
  utils.book_append_sheet(workbook, sheet, 'Sheet1')
  const xlsx = new Uint8Array(write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer)
  const writer = new ZipWriter(new BlobWriter('application/zip'))
  await writer.add('微信支付账单.xlsx', new Uint8ArrayReader(xlsx), { password, encryptionStrength: 3 })
  return (await writer.close()).arrayBuffer()
}

describe('parseEncryptedBillArchive', () => {
  it('decrypts and parses one supported statement entirely in memory', async () => {
    const bytes = await encryptedArchive({ '微信支付账单.csv': wechat })
    const result = await parseEncryptedBillArchive(bytes, '123456')
    expect(result.source).toBe('wechat')
    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0].externalId).toBe('wx_zip_001')
  })

  it('decrypts and parses a WeChat XLSX statement entirely in memory', async () => {
    const bytes = await encryptedXlsxArchive()
    const result = await parseEncryptedBillArchive(bytes, '123456')
    expect(result.source).toBe('wechat')
    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0].externalId).toBe('wx_xlsx_001')
  })

  it('reports a reusable password error without persisting the password', async () => {
    const bytes = await encryptedArchive({ '账单.csv': wechat })
    await expect(parseEncryptedBillArchive(bytes, 'wrong'))
      .rejects.toThrow('密码错误或账单文件损坏')
  })

  it('rejects archives with multiple supported statement files', async () => {
    const bytes = await encryptedArchive({ '账单1.csv': wechat, '账单2.csv': wechat })
    await expect(parseEncryptedBillArchive(bytes, '123456'))
      .rejects.toThrow('压缩包中应只有一个 CSV、XLS 或 XLSX 账单文件')
  })

  it('rejects invalid Excel files after decryption', async () => {
    const bytes = await encryptedArchive({ '伪造账单.xlsx': 'not-an-office-document' })
    await expect(parseEncryptedBillArchive(bytes, '123456'))
      .rejects.toThrow('密码错误或账单文件损坏')
  })
})
