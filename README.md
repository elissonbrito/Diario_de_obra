# Diário de Obra – EliTech

App web instalável (PWA) para acompanhamento diário de obra: cadastro de obra, serviços, trechos e equipe,
chamada diária (presente / atraso / falta, entrada, saída, trecho, observação) e backup.
Funciona **sem internet** depois da primeira abertura. Todos os dados ficam **só no aparelho** (IndexedDB).

> Versão 0.1 — etapas 1 e 2. Próximas: fotos com GPS, medição diária, diário de obra, relatório em PDF.

## Rodar no computador

Precisa do Node 20 ou superior.

```bash
npm install
npm run dev        # abre em http://localhost:5173
```

Para testar no iPhone na mesma rede Wi-Fi: `npm run dev` mostra o endereço "Network"
(ex.: `http://192.168.0.10:5173`). Abra no Safari. Nesse modo (sem HTTPS) o app funciona,
mas **não** instala para uso offline. Para isso, publique (abaixo).

## Publicar de graça (necessário para instalar no iPhone)

O iPhone só instala e usa offline um PWA servido por **HTTPS**. Duas opções gratuitas:

### GitHub Pages (já configurado)
1. Crie um repositório no GitHub e envie este projeto (`git init`, `git add .`, `git commit`, `git push`).
2. No repositório: **Settings → Pages → Source: GitHub Actions**.
3. A cada `push` na branch `main`, o app é construído e publicado. O endereço aparece em Settings → Pages.

No plano grátis do GitHub, o Pages exige repositório **público**. Isso não expõe dados: o repositório só tem
o código, e os dados da obra ficam no celular.

### Cloudflare Pages (alternativa)
Conecte o repositório, com build `npm run build` e pasta de saída `dist`. Costuma aceitar repositório privado.

## Instalar no iPhone

1. Abra o endereço publicado **no Safari** (não no Chrome).
2. Toque em **Compartilhar → Adicionar à Tela de Início**.
3. Abra o app pelo ícone novo. Na primeira vez, use com internet para ele carregar tudo; depois funciona offline.

Instalado na Tela de Início, o iPhone não apaga os dados do app por inatividade, o que não é garantido
quando se usa só o Safari.

## Dados da obra e backup

- **Ajustes → Exportar backup** gera um arquivo `.json` (no iPhone abre a folha de compartilhamento:
  salve em Arquivos, no Drive ou mande no WhatsApp para você mesmo). Faça isso com frequência.
- **Ajustes → Importar arquivo** restaura um backup (substitui os dados atuais).
- Para carregar a obra já preparada (serviços e quantidades), importe o arquivo `obra-bw.json`
  que acompanha a entrega. Ele não faz parte do repositório, para não publicar dados de cliente.

## Estrutura

```
src/
  db/        esquema do banco (Dexie/IndexedDB) e tipos — já inclui as tabelas das próximas etapas
  repo/      repositórios: única camada que fala com o banco (trocar por um servidor no futuro
             só exige mexer aqui)
  pages/     telas: Hoje, Chamada, Equipe, Obra, Ajustes
  state/     obra ativa
  lib/       utilitários (datas, números, ids)
```

Todo registro tem `id` único (UUID), `createdAt`, `updatedAt` e `deletedAt`, o que prepara o terreno
para sincronizar com um servidor depois, sem refazer o banco.

## Limites conhecidos

- Se o aparelho for perdido ou o app for removido, os dados vão junto: **o backup é a sua proteção**.
- O Safari pode pedir de novo a permissão de localização (quando o módulo de fotos chegar).
- Um aparelho por obra: não há sincronização entre celulares nesta versão.


## Novidades da v0.2 (controle sem mexer em código)

- **Equipe**: adicionar, editar, desativar e excluir funcionários e funções.
- **Medição**: lance por dia a produção de cada serviço (e trecho).
- **Análises**: *Semana* (produção e produtividade), *Previsão* (ritmo dos últimos dias úteis → término da obra, comparação com o prazo e ritmo necessário), *Faltas* (por funcionário/período), *Materiais* (gasto estimado, saldo, quando pedir, quanto pedir).
- **Obra**: início, prazo final, dia de fechamento da medição e preço unitário por serviço (estimativa de medição antes do fechamento).

### Premissas dos cálculos
- Dias úteis = segunda a sexta, sem feriados; serviços avançam em paralelo.
- Ritmo = média por dia útil nos últimos N dias úteis (dias sem produção contam como zero).
- Consumo de material = produção × consumo por unidade × (1 + perda%). Concreto: espessura em metros (8 cm → 0,08 m³/m²).
- "Pedir até" = data em que o estoque acaba − antecedência de entrega do fornecedor.
- Os valores são estimativas para apoio à decisão, não substituem a medição oficial.
# Diario_de_obra
