// Tratamento de fotos no navegador: reduzir antes de salvar (para não estourar o IndexedDB) e pegar o GPS.
import { dimensoesReduzidas, lerDataExif } from './imagem'

export const LADO_MAXIMO = 1600
export const LADO_MINIATURA = 320

export interface FotoReduzida {
  arquivo: Blob
  miniatura: Blob
  largura: number
  altura: number
  capturadaEm: string | null
}

type Fonte = { img: CanvasImageSource; largura: number; altura: number; liberar: () => void }

/** Decodifica já com a orientação do EXIF aplicada (foto "deitada" do iPhone sai em pé). */
async function decodificar(arquivo: Blob): Promise<Fonte> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
      return { img: bmp, largura: bmp.width, altura: bmp.height, liberar: () => bmp.close() }
    } catch { /* Safari antigo ou formato não suportado: tenta pelo <img> */ }
  }
  const url = URL.createObjectURL(arquivo)
  const img = new Image()
  img.decoding = 'async'
  img.src = url
  try {
    await img.decode()
  } catch {
    URL.revokeObjectURL(url)
    throw new Error('Não foi possível ler esta imagem. Tente outra foto (formatos comuns: JPEG, PNG, HEIC).')
  }
  return { img, largura: img.naturalWidth, altura: img.naturalHeight, liberar: () => URL.revokeObjectURL(url) }
}

function exportar(fonte: Fonte, max: number, qualidade: number): Promise<{ blob: Blob; largura: number; altura: number }> {
  const { largura, altura } = dimensoesReduzidas(fonte.largura, fonte.altura, max)
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('O aparelho não liberou memória para processar a foto.'))
  ctx.fillStyle = '#fff' // PNG com transparência não fica preto no JPEG
  ctx.fillRect(0, 0, largura, altura)
  ctx.drawImage(fonte.img, 0, 0, largura, altura)
  return new Promise((ok, falha) => {
    canvas.toBlob((blob) => {
      canvas.width = 0 // libera a memória do canvas logo (importante no iPhone)
      canvas.height = 0
      if (blob) ok({ blob, largura, altura })
      else falha(new Error('Falha ao gerar o JPEG da foto.'))
    }, 'image/jpeg', qualidade)
  })
}

export async function reduzirImagem(arquivo: Blob): Promise<FotoReduzida> {
  const capturadaEm = lerDataExif(await arquivo.slice(0, 128 * 1024).arrayBuffer())
  const fonte = await decodificar(arquivo)
  try {
    const grande = await exportar(fonte, LADO_MAXIMO, 0.8)
    const mini = await exportar(fonte, LADO_MINIATURA, 0.7)
    return { arquivo: grande.blob, miniatura: mini.blob, largura: grande.largura, altura: grande.altura, capturadaEm }
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
