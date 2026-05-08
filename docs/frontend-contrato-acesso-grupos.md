# Contrato Unico Frontend - Acesso por Grupo e Politica de Colunas

Este documento consolida o estado final do backend apos a migracao para autorizacao por grupos.
Use este arquivo como referencia unica para ajustes do frontend.

## 1) O que foi feito no backend

1. Remocao definitiva do modelo legado de permissao por coordenadoria.
2. Autorizacao baseada em 3 camadas:

- permissao de sistema (`usuarios.permissao`)
- papel no grupo ativo (`usuarios_grupos.permissao_grupo`)
- capacidades combinaveis (`usuarios_grupos_permissoes`)

3. Processos passaram a seguir regra grupo-first + owner:

- vinculo principal do processo e com o grupo
- owner fica em `processos.usuario_atribuido_id`

4. Andamentos seguem o acesso do processo (cascata via processo).
5. Grupo `GLOBAL` foi definido como perfil master:

- acesso total a rotas, paginas, dados e capacidades.

6. Politica oficial de colunas por grupo foi implementada no backend.
7. Preferencias do usuario foram mantidas, mas para ordem de colunas apenas.

## 2) Regras finais de autorizacao

Ordem de decisao por request:

1. JWT valido e usuario ativo.
2. `RoleGuard` valida acesso por permissao de sistema/grupo.
3. `CapacidadeGuard` valida capacidades quando exigidas.
4. Service aplica regra de dominio nos recursos.

Regras especiais:

1. `DEV`: bypass geral.
2. `ADM` (sistema): bypass de capacidades.
3. `GLOBAL` ativo: master total (bypass completo em role/capacidade/visibilidade de dados).
4. `GABINETE`: manter comportamento especial atual (nao alterar).

## 3) Grupo ativo (contexto)

Persistencia:

1. tabela: `preferencias_usuario`
2. chave: `auth.grupo_ativo_id`

Resolucao:

1. header opcional `x-grupo-ativo-id`
2. preferencia persistida
3. fallback para primeiro vinculo ativo

Endpoints:

1. `GET /grupo-ativo`
2. `PATCH /grupo-ativo`

Payload `PATCH /grupo-ativo`:

```json
{ "grupoId": "uuid-do-grupo" }
```

## 4) Processos e owner

Regra oficial:

1. todo processo pertence a um grupo principal (vinculo em `processos_grupos`)
2. todo processo possui owner (`processos.usuario_atribuido_id`)
3. andamentos herdam acesso via processo

Implicacao de integracao:

1. frontend nao deve tratar processo como apenas vinculado a usuario
2. filtros e visibilidade devem considerar grupo ativo + capacidades

## 5) Politica oficial de colunas por grupo

Endpoint novo:

1. `GET /processos/colunas/politica`

Objetivo:

1. retornar as colunas oficiais do grupo ativo
2. retornar ordem padrao
3. aplicar ordem preferida do usuario sem permitir colunas fora da politica

Colunas fixas para todos:

1. `selecao`
2. `expansao`

### 5.1 Expediente

Colunas oficiais:

1. `numero_sei`
2. `assunto`
3. `origem`
4. `interessado`
5. `unidade_remetente`
6. `unidade_destino`
7. `data_recebimento`
8. `data_envio_unidade`
9. `prazo`
10. `prorrogacao`
11. `data_resposta_final`
12. `observacoes`

### 5.2 Servin

Colunas oficiais:

1. `numero_sei`
2. `assunto`
3. `origem`
4. `responsavel`
5. `prazo`
6. `observacoes`

### 5.3 Gabinete

Colunas oficiais atuais:

1. `numero_sei`
2. `assunto`
3. `origem`
4. `interessado`
5. `unidade_remetente`
6. `unidade_destino`
7. `responsavel`
8. `data_recebimento`
9. `data_envio_unidade`
10. `prazo`
11. `prorrogacao`
12. `data_resposta_final`
13. `observacoes`

### 5.4 Global

Colunas oficiais atuais:

1. usa o mesmo conjunto ampliado do Gabinete

## 6) Preferencias do usuario (somente ordem)

Regra:

1. frontend pode persistir apenas ordem de colunas
2. backend ignora itens fora de `colunasDisponiveis`
3. backend monta `ordemEfetiva = ordemUsuario + faltantes da ordemPadrao`

Chaves recomendadas por grupo:

1. `grid.processos.colunas.ordem.expediente`
2. `grid.processos.colunas.ordem.servin`
3. `grid.processos.colunas.ordem.gabinete`
4. `grid.processos.colunas.ordem.global`

Fallback legado ainda lido:

1. `grid.processos.colunas.ordem`

Observacao:

1. continue usando endpoints de preferencias (`/preferencias`) para salvar/ler ordem personalizada

## 7) Contrato de resposta do endpoint de colunas

`GET /processos/colunas/politica` retorna:

```json
{
  "grupoAtivo": {
    "id": "uuid",
    "codigo": "EXPEDIENTE",
    "nome": "Coordenadoria Expediente"
  },
  "chavePreferenciaOrdem": "grid.processos.colunas.ordem.expediente",
  "colunasFixas": ["selecao", "expansao"],
  "colunasDisponiveis": [
    "numero_sei",
    "assunto",
    "origem",
    "interessado",
    "unidade_remetente",
    "unidade_destino",
    "data_recebimento",
    "data_envio_unidade",
    "prazo",
    "prorrogacao",
    "data_resposta_final",
    "observacoes"
  ],
  "ordemPadrao": [
    "numero_sei",
    "assunto",
    "origem",
    "interessado",
    "unidade_remetente",
    "unidade_destino",
    "data_recebimento",
    "data_envio_unidade",
    "prazo",
    "prorrogacao",
    "data_resposta_final",
    "observacoes"
  ],
  "ordemUsuario": ["assunto", "numero_sei"],
  "ordemEfetiva": [
    "assunto",
    "numero_sei",
    "origem",
    "interessado",
    "unidade_remetente",
    "unidade_destino",
    "data_recebimento",
    "data_envio_unidade",
    "prazo",
    "prorrogacao",
    "data_resposta_final",
    "observacoes"
  ]
}
```

## 8) O que o frontend precisa alterar

1. Sessao e contexto

- usar `GET /usuario-atual` + `GET /grupo-ativo` no bootstrap
- trocar contexto com `PATCH /grupo-ativo`

2. Regras de acesso

- nao codificar regra de autorizacao no frontend
- usar retornos da API para decidir permissao efetiva

3. Grid de processos

- carregar politica via `GET /processos/colunas/politica`
- renderizar somente `colunasFixas + ordemEfetiva`
- tratar `colunasDisponiveis` como whitelist oficial por grupo

4. Persistencia de ordem

- ao remanejar colunas, salvar so a ordem via `/preferencias`
- usar `chavePreferenciaOrdem` retornada pela politica
- nao salvar visibilidade/colunas proibidas por grupo

5. Fluxo de processos e andamentos

- considerar processo como recurso de grupo com owner
- manter telas de andamentos condicionadas ao acesso do processo

6. Tela DEV de administracao

- manter uso dos endpoints:
  - `GET /acessos-admin/dev/grupos`
  - `PATCH /acessos-admin/dev/usuarios/:usuarioId/grupos/:grupoId`
  - `PATCH /acessos-admin/dev/usuarios/:usuarioId/grupos/:grupoId/permissoes`
  - `GET /acessos-admin/dev/matriz-permissoes`

## 9) Checklist de validacao frontend

1. Usuario GLOBAL acessa todas as paginas e dados.
2. Usuario EXPEDIENTE enxerga apenas dados do grupo (respeitando capacidades).
3. Usuario SERVIN enxerga apenas dados do grupo (respeitando capacidades).
4. Comutacao de grupo ativo altera dataset e politica de colunas.
5. Reordenacao de colunas persiste por usuario e por grupo.
6. Colunas fora da politica oficial nao aparecem mesmo se existirem na preferencia antiga.
