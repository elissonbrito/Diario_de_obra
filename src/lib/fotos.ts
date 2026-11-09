// Tratamento de fotos no navegador: reduzir antes de salvar (para não estourar o IndexedDB) e pegar o GPS.
import { dimensoesReduzidas, lerDataExif } from './imagem'

export const LADO_MAXIMO = 1600
export const LADO_REDUZIDO = 1280 // segunda tentativa, se o aparelho não conseguir gerar a de 1600
export const LADO_MINIATURA = 320

export interface Bytes { tipo: string; dados: ArrayBuffer }

export interface FotoReduzida {
  grande: Bytes
  mini: Bytes | null
  largura?: number
  altura?: number
  capturadaEm: string | null
  aviso?: string // ex.: salva no tamanho original
}

type Fonte = { img: CanvasImageSource; largura: number; altura: number; liberar: () => void }

const ehHeic = (a: Blob & { name?: string }) => /hei[cf]/i.test(a.type) || /\.hei[cf]$/i.test(a.name ?? '')

/** Decodifica já com a orientação do EXIF aplicada (foto "deitada" do iPhone sai em pé). */
async function decodificar(arquivo: Blob): Promise<Fonte> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
      if (bmp.width > 0 && bmp.height > 0) return { img: bmp, largura: bmp.width, altura: bmp.height, liberar: () => bmp.close() }
      bmp.close()
    } catch { /* Safari antigo ou formato não suportado: tenta pelo <img> */ }
  }
  const url = URL.createObjectURL(arquivo)
  const img = new Image()
  img.decoding = 'async'
  img.src = url
  try {
    await img.decode()
    if (!img.naturalWidth) throw new Error('vazia')
  } catch {
    URL.revokeObjectURL(url)
    throw new Error(ehHeic(arquivo)
      ? 'Não foi possível abrir esta foto HEIC. No iPhone, em Ajustes → Câmera → Formatos, escolha “Mais compatível” e tire a foto de novo.'
      : 'Não foi possível abrir esta imagem. Tente outra foto (JPEG ou PNG).')
  }
  return { img, largura: img.naturalWidth, altura: img.naturalHeight, liberar: () => URL.revokeObjectURL(url) }
}

/** Desenha no canvas e gera JPEG. Devolve null se o aparelho não gerar a imagem (falta de memória no iPhone). */
async function exportar(fonte: Fonte, max: number, qualidade: number): Promise<{ bytes: Bytes; largura: number; altura: number } | null> {
  const { largura, altura } = dimensoesReduzidas(fonte.largura, fonte.altura, max)
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  try {
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#fff' // PNG com transparência não fica preto no JPEG
    ctx.fillRect(0, 0, largura, altura)
    ctx.drawImage(fonte.img, 0, 0, largura, altura)
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', qualidade))
    if (!blob || blob.size === 0) return null
    const dados = await blob.arrayBuffer()
    if (dados.byteLength === 0) return null
    return { bytes: { tipo: 'image/jpeg', dados }, largura, altura }
  } catch {
    return null
  } finally {
    canvas.width = 0 // libera a memória do canvas logo (importante no iPhone)
    canvas.height = 0
  }
}

/**
 * Reduz a foto para guardar: 1600 px; se falhar, 1280 px; se ainda falhar, guarda o arquivo original.
 * Lança erro (em português) se a imagem não abre ou ficaria vazia — nunca devolve foto quebrada.
 */
export async function reduzirImagem(arquivo: Blob): Promise<FotoReduzida> {
  if (arquivo.size === 0) throw new Error('O arquivo da foto está vazio. Tire a foto de novo.')
  const capturadaEm = lerDataExif(await arquivo.slice(0, 128 * 1024).arrayBuffer())
  const fonte = await decodificar(arquivo)
  try {
    const grande = (await exportar(fonte, LADO_MAXIMO, 0.8)) ?? (await exportar(fonte, LADO_REDUZIDO, 0.8))
    const mini = await exportar(fonte, LADO_MINIATURA, 0.7)
    if (grande) {
      return { grande: grande.bytes, mini: mini?.bytes ?? null, largura: grande.largura, altura: grande.altura, capturadaEm }
    }
    const dados = await arquivo.arrayBuffer()
    if (dados.byteLength === 0) throw new Error('Não foi possível ler a foto. Tente de novo.')
    return {
      grande: { tipo: arquivo.type || 'image/jpeg', dados },
      mini: mini?.bytes ?? null,
      largura: fonte.largura,
      altura: fonte.altura,
      capturadaEm,
      aviso: 'O aparelho não conseguiu reduzir a foto; ela foi salva no tamanho original.',
    }
  } finally {
    fonte.liberar()
  }
}

export type ResultadoGPS =
  | { ok: true; latitude: number; longitude: number; precisaoM: number }
  | { ok: false; motivo: string }

/** Pede a posição uma vez. Nunca rejeita: em caso de erro devolve o motivo (a foto é salva sem GPS). */
export function obterPosicao(timeoutMs = 8000): Promise<ResultadoGPS> {
  if (!window.isSecureContext) return Promise.resolve({ ok: false, motivo: 'GPS só funciona em endereço https.' })
  if (!('geolocation' in navigator)) return Promise.resolve({ ok: false, motivo: 'Este aparelho não informa a localização.' })
  return new Promise((ok) => {
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ ok: true, latitude: p.coords.latitude, longitude: p.coords.longitude, precisaoM: Math.round(p.coords.accuracy) }),
      (e) => ok({
        ok: false,
        motivo: e.code === e.PERMISSION_DENIED
          ? 'localização não permitida (Ajustes do iPhone → Privacidade → Serviços de Localização).'
          : e.code === e.TIMEOUT ? 'o GPS demorou para responder.' : 'localização indisponível no momento.',
      }),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    )
  })
}

export const linkMapa = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`

export const coordenadas = (lat: number, lng: number) => `${lat.toFixed(6)}, ${lng.toFixed(6)}`

export function bytesParaDataURL(b: Bytes): Promise<string> {
  return blobParaDataURL(new Blob([b.dados], { type: b.tipo }))
}

export function blobParaDataURL(blob: Blob): Promise<string> {
  return new Promise((ok, falha) => {
    const r = new FileReader()
    r.onload = () => ok(String(r.result))
    r.onerror = () => falha(r.error ?? new Error('Falha ao ler o arquivo.'))
    r.readAsDataURL(blob)
  })
}

/** Reduz uma imagem pequena (logo) e devolve como data URL JPEG/PNG para guardar em db.meta. */
export async function reduzirLogo(arquivo: Blob): Promise<string> {
  const fonte = await decodificar(arquivo)
  try {
    const { largura, altura } = dimensoesReduzidas(fonte.largura, fonte.altura, 600)
    const canvas = document.createElement('canvas')
    canvas.width = largura
    canvas.height = altura
    canvas.getContext('2d')?.drawImage(fonte.img, 0, 0, largura, altura)
    return canvas.toDataURL('image/png') // PNG mantém o fundo transparente do logo
  } finally {
    fonte.liberar()
  }
}
