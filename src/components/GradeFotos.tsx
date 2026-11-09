import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Foto, Servico, Trecho } from '../db/types'
import { coordenadas, linkMapa } from '../lib/fotos'
import { dataBR } from '../lib/util'
import { atualizarFoto, excluirFoto } from '../repo/fotos'
import { FotoImagem } from './FotoImagem'
import { Modal } from './Modal'

async function confirmarExclusao(id: string): Promise<boolean> {
  if (!window.confirm('Excluir esta foto? Ela sai do diário e dos relatórios.')) return false
  await excluirFoto(id)
  return true
}

function CelulaFoto({ foto, legenda, onAbrir }: { foto: Foto; legenda?: string; onAbrir: () => void }) {
  const [indisponivel, setIndisponivel] = useState(false)
  // Botão "Remover" fica fora do botão da célula (botão dentro de botão não é permitido).
  return (
    <li>
      <button type="button" className="foto-celula" onClick={onAbrir} aria-label={`Abrir foto das ${foto.hora}`}>
        <FotoImagem foto={foto} qual="mini" alt={foto.legenda || `Foto das ${foto.hora}`}
          onEstado={(e) => setIndisponivel(e === 'indisponivel')} />
        <span className="foto-info">
          <b>{foto.hora}</b>
          {foto.latitude !== undefined && <span className="etq ok">GPS</span>}
        </span>
        {legenda && <span className="foto-legenda">{legenda}</span>}
      </button>
      {indisponivel && (
        <button type="button" className="btn btn-perigo btn-remover" onClick={() => void confirmarExclusao(foto.id)}>
          Remover
        </button>
      )}
    </li>
  )
}

export function GradeFotos({ fotos, servicos, trechos }: { fotos: Foto[]; servicos: Servico[]; trechos: Trecho[] }) {
  const [abertaId, setAbertaId] = useState<string | null>(null)
  const nomeServico = (id?: string) => servicos.find((s) => s.id === id)?.nome
  return (
    <>
      <ul className="grade-fotos">
        {fotos.map((f) => (
          <CelulaFoto key={f.id} foto={f} legenda={f.legenda || nomeServico(f.servicoId)} onAbrir={() => setAbertaId(f.id)} />
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
    if (await confirmarExclusao(id)) onClose()
  }

  return (
    <Modal titulo={`Foto de ${dataBR(foto.data)} · ${foto.hora}`} onClose={() => { void salvarLegenda(); onClose() }}>
      <div className="form">
        <FotoImagem foto={foto} qual="grande" lazy={false} className="foto-grande" alt={foto.legenda || 'Foto ampliada'}
          onRemover={() => void excluir()} />
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
