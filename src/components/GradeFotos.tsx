import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Foto, Servico, Trecho } from '../db/types'
import { useObjectUrl } from '../hooks/useObjectUrl'
import { coordenadas, linkMapa } from '../lib/fotos'
import { dataBR } from '../lib/util'
import { atualizarFoto, excluirFoto } from '../repo/fotos'
import { Modal } from './Modal'

export function Miniatura({ foto, alt }: { foto: Foto; alt: string }) {
  const url = useObjectUrl(foto.miniatura ?? foto.arquivo)
  return url ? <img src={url} alt={alt} loading="lazy" decoding="async" /> : <span className="foto-vazia" />
}

export function GradeFotos({ fotos, servicos, trechos }: { fotos: Foto[]; servicos: Servico[]; trechos: Trecho[] }) {
  const [abertaId, setAbertaId] = useState<string | null>(null)
  const nomeServico = (id?: string) => servicos.find((s) => s.id === id)?.nome
  return (
    <>
      <ul className="grade-fotos">
        {fotos.map((f) => (
          <li key={f.id}>
            <button type="button" className="foto-celula" onClick={() => setAbertaId(f.id)} aria-label={`Abrir foto das ${f.hora}`}>
              <Miniatura foto={f} alt={f.legenda || `Foto das ${f.hora}`} />
              <span className="foto-info">
                <b>{f.hora}</b>
                {f.latitude !== undefined && <span className="etq ok">GPS</span>}
              </span>
              {(f.legenda || nomeServico(f.servicoId)) && (
                <span className="foto-legenda">{f.legenda || nomeServico(f.servicoId)}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {abertaId && (
        <VisualizarFoto id={abertaId} servicos={servicos} trechos={trechos} onClose={() => setAbertaId(null)} />
      )}
    </>
  )
}

function VisualizarFoto({ id, servicos, trechos, onClose }: { id: string; servicos: Servico[]; trechos: Trecho[]; onClose: () => void }) {
  // Lê do banco (não da lista da tela), para mostrar sempre a versão atual.
  // undefined = carregando · null = não existe mais
  const foto = useLiveQuery(async () => (await db.fotos.get(id)) ?? null, [id])
  const url = useObjectUrl(foto?.arquivo)
  const [legenda, setLegenda] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)
  const sumiu = foto === null || Boolean(foto?.deletedAt)
  useEffect(() => { if (sumiu) onClose() }, [sumiu, onClose])

  if (!foto || sumiu) return null

  const textoLegenda = legenda ?? foto.legenda ?? ''

  async function salvarLegenda() {
    if (legenda === null) return
    await atualizarFoto(id, { legenda: legenda.trim() || undefined })
    setLegenda(null)
    setSalvo(true)
  }

  async function excluir() {
    if (!window.confirm('Excluir esta foto? Ela sai do diário e dos relatórios.')) return
    await excluirFoto(id)
    onClose()
  }

  return (
    <Modal titulo={`Foto de ${dataBR(foto.data)} · ${foto.hora}`} onClose={() => { void salvarLegenda(); onClose() }}>
      <div className="form">
        {url && <img className="foto-grande" src={url} alt={foto.legenda || 'Foto ampliada'} />}
        <label>
          Legenda
          <input
            value={textoLegenda}
            onChange={(e) => { setLegenda(e.target.value); setSalvo(false) }}
            onBlur={() => void salvarLegenda()}
            placeholder="ex.: Escavação da vala, estaca 12"
            autoComplete="off"
          />
        </label>
        {salvo && <p className="ok-texto pequeno" role="status">Legenda salva ✓</p>}
        <div className="linha-campos">
          <label>
            Serviço
            <select value={foto.servicoId ?? ''} onChange={(e) => void atualizarFoto(id, { servicoId: e.target.value || undefined })}>
              <option value="">—</option>
              {servicos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </label>
          <label>
            Trecho
            <select value={foto.trechoId ?? ''} onChange={(e) => void atualizarFoto(id, { trechoId: e.target.value || undefined })}>
              <option value="">—</option>
              {trechos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </label>
        </div>
        <dl className="dados">
          {foto.capturadaEm && (<><dt>Capturada em</dt><dd>{dataBR(foto.capturadaEm.slice(0, 10))} {foto.capturadaEm.slice(11)}</dd></>)}
          <dt>Localização</dt>
          <dd>
            {foto.latitude !== undefined && foto.longitude !== undefined ? (
              <a href={linkMapa(foto.latitude, foto.longitude)} target="_blank" rel="noreferrer">Ver no mapa</a>
            ) : 'sem GPS'}
          </dd>
          {foto.latitude !== undefined && foto.longitude !== undefined && (
            <><dt>Coordenadas</dt><dd>{coordenadas(foto.latitude, foto.longitude)}{foto.precisaoM !== undefined && ` (±${foto.precisaoM} m)`}</dd></>
          )}
        </dl>
        <div className="form-acoes">
          <button type="button" className="btn btn-perigo" onClick={() => void excluir()}>Excluir foto</button>
          <button type="button" className="btn btn-primario" onClick={() => { void salvarLegenda(); onClose() }}>Concluir</button>
        </div>
      </div>
    </Modal>
  )
}
