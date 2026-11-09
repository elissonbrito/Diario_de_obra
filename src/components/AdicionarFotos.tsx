import { useRef, useState } from 'react'
import type { Servico, Trecho } from '../db/types'
import { obterPosicao, reduzirImagem, type ResultadoGPS } from '../lib/fotos'
import { dataBR } from '../lib/util'
import { adicionarFoto, deveUsarGPS } from '../repo/fotos'
import { useObra } from '../state/ObraContext'

/**
 * Dois botões: "Tirar foto" abre a câmera direto (capture) e "Galeria" deixa escolher várias.
 * No iPhone, com `capture` a câmera abre sem opção de galeria; por isso são dois inputs.
 */
export function AdicionarFotos({
  data, servicos = [], trechos = [], vinculo = true,
}: { data: string; servicos?: Servico[]; trechos?: Trecho[]; vinculo?: boolean }) {
  const obra = useObra()
  const camera = useRef<HTMLInputElement>(null)
  const galeria = useRef<HTMLInputElement>(null)
  const [servicoId, setServicoId] = useState('')
  const [trechoId, setTrechoId] = useState('')
  const [progresso, setProgresso] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro' | 'aviso'; texto: string }[]>([])

  async function processar(lista: FileList | null, input: HTMLInputElement | null) {
    const arquivos = Array.from(lista ?? [])
    if (input) input.value = '' // permite escolher o mesmo arquivo de novo
    if (arquivos.length === 0) return
    const avisos: typeof msg = []
    // GPS: uma vez por lote, em paralelo com o processamento das imagens.
    const gpsPromessa: Promise<ResultadoGPS | null> = deveUsarGPS(data) ? obterPosicao() : Promise.resolve(null)
    let salvas = 0
    let gps: ResultadoGPS | null | undefined
    for (let i = 0; i < arquivos.length; i++) {
      setProgresso(`Processando foto ${i + 1} de ${arquivos.length}…`)
      try {
        const reduzida = await reduzirImagem(arquivos[i])
        if (gps === undefined) {
          setProgresso(`Obtendo localização…`)
          gps = await gpsPromessa
        }
        await adicionarFoto(obra.id, data, reduzida, gps, { servicoId, trechoId })
        salvas++
      } catch (e) {
        const texto = (e as Error).name === 'QuotaExceededError'
          ? 'Sem espaço no aparelho para salvar mais fotos. Faça o backup completo e libere espaço.'
          : `“${arquivos[i].name}”: ${(e as Error).message}`
        avisos.push({ tipo: 'erro', texto })
      }
    }
    setProgresso(null)
    if (salvas > 0) avisos.unshift({ tipo: 'ok', texto: salvas === 1 ? '1 foto salva.' : `${salvas} fotos salvas.` })
    if (salvas > 0 && gps && !gps.ok) avisos.push({ tipo: 'aviso', texto: `Salvas sem GPS: ${gps.motivo}` })
    if (salvas > 0 && gps === null) {
      avisos.push({ tipo: 'aviso', texto: `Fotos de ${dataBR(data)} ficam sem GPS (a posição de agora não é a do local da foto).` })
    }
    setMsg(avisos)
  }

  const ocupado = progresso !== null

  return (
    <div className="adicionar-fotos">
      {vinculo && (servicos.length > 0 || trechos.length > 0) && (
        <div className="linha-campos">
          {servicos.length > 0 && (
            <label>
              Serviço (opcional)
              <select value={servicoId} onChange={(e) => setServicoId(e.target.value)}>
                <option value="">—</option>
                {servicos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </label>
          )}
          {trechos.length > 0 && (
            <label>
              Trecho (opcional)
              <select value={trechoId} onChange={(e) => setTrechoId(e.target.value)}>
                <option value="">—</option>
                {trechos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </label>
          )}
        </div>
      )}
      <div className="botoes-foto">
        <button type="button" className="btn btn-primario btn-foto" disabled={ocupado} onClick={() => camera.current?.click()}>
          📷 Tirar foto
        </button>
        <button type="button" className="btn btn-sec btn-foto" disabled={ocupado} onClick={() => galeria.current?.click()}>
          🖼️ Galeria
        </button>
      </div>
      <input
        ref={camera} type="file" accept="image/*" capture="environment" multiple hidden
        data-testid="input-camera" onChange={(e) => void processar(e.target.files, e.target)}
      />
      <input
        ref={galeria} type="file" accept="image/*" multiple hidden
        data-testid="input-galeria" onChange={(e) => void processar(e.target.files, e.target)}
      />
      {progresso && <p className="mudo pequeno" role="status">{progresso}</p>}
      {!progresso && msg.map((m, i) => (
        <p key={i} role="status" className={m.tipo === 'ok' ? 'ok-texto' : m.tipo === 'erro' ? 'erro' : 'mudo pequeno'}>{m.texto}</p>
      ))}
    </div>
  )
}
