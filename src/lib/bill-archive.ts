import type { Entry, FileEntry } from '@zip.js/zip.js'
import { parseBillFile, type ParsedBillFile } from './bill-file'

const MAX_EXTRACTED_BILL_BYTES = 50 * 1024 * 1024

function isSupportedStatement(filename: string): boolean {
  return /\.(csv|xlsx|xls)$/i.test(filename) && !filename.startsWith('__MACOSX/')
}

function isSupportedFileEntry(entry: Entry): entry is FileEntry {
  return !entry.directory && isSupportedStatement(entry.filename)
}

export async function parseEncryptedBillArchive(
  input: ArrayBuffer | Uint8Array,
  password: string,
): Promise<ParsedBillFile> {
  if (!password) throw new Error('请输入解压密码')
  const { Uint8ArrayReader, Uint8ArrayWriter, ZipReader } = await import('@zip.js/zip.js')
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  const reader = new ZipReader(new Uint8ArrayReader(bytes))
  try {
    const entries = (await reader.getEntries()).filter(isSupportedFileEntry)
    if (entries.length !== 1) throw new Error('压缩包中应只有一个 CSV、XLS 或 XLSX 账单文件')

    const entry = entries[0]
    if (!entry.encrypted) throw new Error('账单压缩包未加密')
    if (entry.uncompressedSize > MAX_EXTRACTED_BILL_BYTES) {
      throw new Error('解压后的账单文件超过 50 MB')
    }

    try {
      const extracted = await entry.getData(new Uint8ArrayWriter(), { password })
      return await parseBillFile(entry.filename, extracted)
    } catch (error) {
      if (error instanceof Error
        && (error.message === '账单压缩包未加密'
          || error.message === '解压后的账单文件超过 50 MB'
          || error.message.startsWith('仅支持'))
      ) throw error
      throw new Error('密码错误或账单文件损坏')
    }
  } finally {
    await reader.close()
  }
}
