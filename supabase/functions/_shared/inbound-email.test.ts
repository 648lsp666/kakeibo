import { describe, expect, it } from 'vitest'
import {
  assertAttachmentSize,
  assertZipFileSignature,
  buildAttachmentStoragePath,
  deriveWechatBillFilename,
  extractRecipientAlias,
  extractWechatBillDownloadUrl,
  normalizeZipContentType,
  sanitizeFilename,
  selectSingleZipAttachment,
  sha256Hex,
} from './inbound-email'

describe('Resend inbound email validation', () => {
  it('extracts only a valid alias at the configured receiving domain', () => {
    expect(extractRecipientAlias(
      ['Bills <0123456789abcdefabcd@bills.example.com>'],
      'bills.example.com',
    )).toBe('0123456789abcdefabcd')
    expect(extractRecipientAlias(
      ['0123456789abcdefabcd@other.example.com'],
      'bills.example.com',
    )).toBeNull()
    expect(extractRecipientAlias(
      ['guessable@bills.example.com'],
      'bills.example.com',
    )).toBeNull()
  })

  it('accepts exactly one ZIP attachment', () => {
    const zip = { id: 'zip-1', filename: '微信账单.zip', content_type: 'application/zip' }
    const signature = { id: 'image-1', filename: 'logo.png', content_type: 'image/png' }
    expect(selectSingleZipAttachment([zip, signature])).toEqual(zip)
    expect(() => selectSingleZipAttachment([signature])).toThrow('未找到 ZIP 账单附件')
    expect(() => selectSingleZipAttachment([zip, { ...zip, id: 'zip-2' }])).toThrow('邮件包含多个 ZIP 附件')
  })

  it('extracts only the trusted one-time download link from a WeChat bill email', () => {
    const html = `<a href="https://tenpay.wechatpay.cn/userroll/userbilldownload/downloadfilefromemail?encrypted_file_data=abc123">点击下载</a>`
    expect(extractWechatBillDownloadUrl(html)).toBe(
      'https://tenpay.wechatpay.cn/userroll/userbilldownload/downloadfilefromemail?encrypted_file_data=abc123',
    )
    expect(deriveWechatBillFilename('微信支付账单流水文件(20260617-20260717)已生成')).toBe(
      '微信支付账单(20260617-20260717).zip',
    )
    expect(() => extractWechatBillDownloadUrl(
      '<a href="https://example.com/download?encrypted_file_data=abc">点击下载</a>',
    )).toThrow('微信账单下载链接不可信')
    expect(() => extractWechatBillDownloadUrl('<p>没有附件</p>')).toThrow('未找到微信账单下载链接')
  })

  it('sanitizes attachment filenames without losing the extension', () => {
    expect(sanitizeFilename('../../微 信/账单?.zip')).toBe('微_信_账单_.zip')
    expect(sanitizeFilename('')).toBe('bill.zip')
  })

  it('uses an ASCII-only object key for Storage while preserving display filenames separately', () => {
    expect(buildAttachmentStoragePath(
      '44dee35d-a4cb-4bdd-9c5b-dbcb5dfe04d3',
      '6c2edf43-4dd3-488b-9cf7-8dd6325851b3',
      '支付宝交易明细(20260617-20260717).zip',
    )).toBe('44dee35d-a4cb-4bdd-9c5b-dbcb5dfe04d3/6c2edf43-4dd3-488b-9cf7-8dd6325851b3/bill.zip')
  })

  it('enforces the 20 MiB attachment limit', () => {
    expect(() => assertAttachmentSize(20 * 1024 * 1024)).not.toThrow()
    expect(() => assertAttachmentSize(20 * 1024 * 1024 + 1)).toThrow('账单附件超过 20 MB')
    expect(() => assertAttachmentSize(0)).toThrow('账单附件为空')
  })

  it('rejects a downloaded page that is not a ZIP archive', () => {
    expect(() => assertZipFileSignature(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).not.toThrow()
    expect(() => assertZipFileSignature(new TextEncoder().encode('<html>error</html>')))
      .toThrow('下载内容不是 ZIP 账单文件')
  })

  it('normalizes arbitrary ZIP MIME values to the private bucket allow-list', () => {
    expect(normalizeZipContentType('application/x-zip-compressed')).toBe('application/x-zip-compressed')
    expect(normalizeZipContentType('application/octet-stream')).toBe('application/octet-stream')
    expect(normalizeZipContentType('application/x-zip')).toBe('application/zip')
  })

  it('returns a stable lowercase SHA-256 digest', async () => {
    expect(await sha256Hex(new TextEncoder().encode('kakeibo'))).toBe(
      'b7a544f9d94917740a43d003f89fcd6abcf9620828b2d87e3d35b7d345a851fa',
    )
  })
})
