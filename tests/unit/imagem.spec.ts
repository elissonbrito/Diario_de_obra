import { expect, test } from '@playwright/test'
import { dimensoesReduzidas, ehZip, lerDataExif } from '../../src/lib/imagem'

test('reduz pelo lado maior mantendo a proporção', () => {
  expect(dimensoesReduzidas(4032, 3024, 1600)).toEqual({ largura: 1600, altura: 1200 })
  expect(dimensoesReduzidas(3024, 4032, 1600)).toEqual({ largura: 1200, altura: 1600 })
  expect(dimensoesReduzidas(3000, 3000, 320)).toEqual({ largura: 320, altura: 320 })
  const r = dimensoesReduzidas(4000, 1777, 1600)
  expect(r.largura).toBe(1600)
  expect(Math.abs(r.largura / r.altura - 4000 / 1777)).toBeLessThan(0.01)
})

test('não amplia imagem pequena', () => {
  expect(dimensoesReduzidas(800, 600, 1600)).toEqual({ largura: 800, altura: 600 })
})

/** Monta um JPEG mínimo só com o segmento EXIF (o suficiente para o leitor). */
function jpegComExif(opcoes: { le: boolean; original?: string; dataHora?: string }): ArrayBuffer {
  const { le } = opcoes
  const tiff: number[] = []
  const u16 = (n: number) => (le ? [n & 0xff, n >> 8] : [n >> 8, n & 0xff])
  const u32 = (n: number) => (le ? [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, n >>> 24] : [n >>> 24, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff])
  const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0)).concat(0)
  const entradas0 = (opcoes.dataHora ? 1 : 0) + (opcoes.original ? 1 : 0)
  const ifd0 = 8
  const fimIfd0 = ifd0 + 2 + entradas0 * 12 + 4
  let dados = fimIfd0
  const exifIfd = dados
  const fimExif = opcoes.original ? exifIfd + 2 + 12 + 4 : exifIfd
  dados = fimExif
  tiff.push(...(le ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(ifd0))
  tiff.push(...u16(entradas0))
  const extras: number[] = []
  let off = dados
  if (opcoes.dataHora) {
    tiff.push(...u16(0x0132), ...u16(2), ...u32(20), ...u32(off)); extras.push(...ascii(opcoes.dataHora)); off += 20
  }
  if (opcoes.original) tiff.push(...u16(0x8769), ...u16(4), ...u32(1), ...u32(exifIfd))
  tiff.push(...u32(0))
  if (opcoes.original) {
    tiff.push(...u16(1), ...u16(0x9003), ...u16(2), ...u32(20), ...u32(off), ...u32(0)); extras.push(...ascii(opcoes.original))
  }
  tiff.push(...extras)
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff]
  const bytes = [0xff, 0xd8, 0xff, 0xe1, (app1.length + 2) >> 8, (app1.length + 2) & 0xff, ...app1, 0xff, 0xda, 0, 2]
  return new Uint8Array(bytes).buffer
}

test('lê DateTimeOriginal do EXIF (little-endian, como no iPhone)', () => {
  expect(lerDataExif(jpegComExif({ le: true, original: '2026:11:05 14:37:09', dataHora: '2026:11:06 08:00:00' }))).toBe('2026-11-05 14:37')
})

test('usa DateTime quando não há DateTimeOriginal (big-endian)', () => {
  expect(lerDataExif(jpegComExif({ le: false, dataHora: '2025:01:31 07:05:00' }))).toBe('2025-01-31 07:05')
})

test('sem EXIF ou arquivo que não é JPEG devolve null', () => {
  expect(lerDataExif(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]).buffer)).toBeNull()
  expect(lerDataExif(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer)).toBeNull()
  expect(lerDataExif(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, 40]).buffer)).toBeNull() // truncado
  expect(lerDataExif(jpegComExif({ le: true, original: '0000:00:00 00:00:00' }))).toBeNull()
})

test('reconhece ZIP pela assinatura', () => {
  expect(ehZip(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1]))).toBe(true)
  expect(ehZip(new TextEncoder().encode('{"app":"x"}'))).toBe(false)
  expect(ehZip(new Uint8Array([0x50]))).toBe(false)
})
