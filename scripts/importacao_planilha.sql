-- ============================================================
-- Script de Importação de Planilha → Antares (MySQL / HeidiSQL)
-- Gerado em: 2026-05-18
--
-- INSTRUÇÕES:
--  1. Selecione o banco antares no HeidiSQL.
--  2. Execute o Passo 0 (cria a tabela importacao_planilha).
--  3. Importe o CSV: Tools > Import CSV file → selecione importacao_planilha.
--     Na aba Fields: desmarque a coluna `linha` (AUTO_INCREMENT).
--  4. Ajuste @unidade_gab_id e @usuario_importacao_id (Passo 2).
--  5. Execute os passos 3 a 6 em sequência.
--  6. Confira o resultado com a query do Passo 7.
--  7. Execute o Passo 8 para apagar a tabela de importação.
--
-- DATAS: As colunas de data ficam como VARCHAR para aceitar o formato
--        brasileiro dd/mm/aaaa ou dd-mm-aaaa da planilha.
--        A conversão para DATE é feita via STR_TO_DATE() nos INSERTs.
-- ============================================================

-- ============================================================
-- PASSO 0: Criar tabela de importação (aparece normalmente no banco)
-- Colunas de data como VARCHAR para aceitar formato dd/mm/aaaa
-- ============================================================
DROP TABLE IF EXISTS importacao_planilha;

CREATE TABLE importacao_planilha (
  -- Collation explícita para evitar "Illegal mix of collations" ao comparar com outras tabelas
  linha                INT           AUTO_INCREMENT PRIMARY KEY,
  num_sei              VARCHAR(100)  COMMENT 'nº SEI',
  interessado          VARCHAR(768)  COMMENT 'Interessado',
  assunto              TEXT          COMMENT 'Assunto',
  tipo_documento       VARCHAR(200)  COMMENT 'Tipo de documento (não importado)',
  unidade_remetente    VARCHAR(200)  COMMENT 'Unidade Remetente',
  data_chegada_gab     VARCHAR(20)   COMMENT 'Data de chegada (tramitado para GAB) — formato dd/mm/aaaa',
  unidade_emissora     VARCHAR(200)  COMMENT 'Unidade Emissora',
  unidade_destinataria VARCHAR(200)  COMMENT 'Unidade Destinatária',
  data_envio_unidade   VARCHAR(20)   COMMENT 'Data de envio para unidade — formato dd/mm/aaaa',
  prazo                VARCHAR(20)   COMMENT 'Prazo (geral do processo) — formato dd/mm/aaaa',
  data_resposta_gab    VARCHAR(20)   COMMENT 'Data de resposta para GAB — formato dd/mm/aaaa',
  tramitado_smul       VARCHAR(200)  COMMENT 'Tramitado para SMUL/ATAJ (não importado)',
  prazo_fatal2         VARCHAR(20)   COMMENT 'Prazo FATAL2 (prazo do andamento) — formato dd/mm/aaaa',
  prorrogacao_prazo    VARCHAR(20)   COMMENT 'Prorrogação de prazo FINAL — formato dd/mm/aaaa',
  data_resposta_final  VARCHAR(20)   COMMENT 'Data de resposta FINAL (ao solicitante) — formato dd/mm/aaaa',
  coluna2              VARCHAR(500)  COMMENT 'Coluna2 (não importado)',
  cobranca2            VARCHAR(500)  COMMENT 'Cobrança 2 (não importado)',
  cobranca3            VARCHAR(500)  COMMENT 'Cobrança 3 (não importado)',
  observacoes          TEXT          COMMENT 'Observações'
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================
-- Após criar a tabela acima, importe o CSV:
--   Tools > Import CSV file
--   → Selecione o banco: antares
--   → Selecione a tabela: importacao_planilha
--   → Na aba Fields: desmarque a coluna `linha` (AUTO_INCREMENT)
--   → Importe
-- Depois continue executando a partir do Passo 1.
-- ============================================================

-- ============================================================
-- PASSO 1: Índice em num_sei para acelerar os passos seguintes
-- Execute logo após importar o CSV
-- ============================================================
ALTER TABLE importacao_planilha ADD INDEX idx_num_sei (num_sei(100));

-- Macro de conversão de data (dd/mm/aaaa ou dd-mm-aaaa → DATE)
-- Usada nos passos abaixo via STR_TO_DATE(coluna, '%d/%m/%Y')
-- Se as datas usarem hífen (dd-mm-aaaa), troque '%d/%m/%Y' por '%d-%m-%Y'

-- ============================================================
-- PASSO 2: Variáveis de configuração — ajuste antes de executar
-- ============================================================

-- UUIDs fixos — não dependem de sessão e não se perdem ao trocar de aba
SET @unidade_gab_id       = '2d9975cf-56a8-4242-bbab-a88ea37186ad';
SET @usuario_importacao_id = (SELECT id FROM usuarios WHERE login = 'd854440' LIMIT 1);

SELECT
  CASE WHEN @unidade_gab_id        IS NULL THEN 'ERRO: Unidade GAB não encontrada.'  ELSE 'OK: Unidade GAB encontrada.'   END AS status_gab,
  CASE WHEN @usuario_importacao_id  IS NULL THEN 'ERRO: Usuário não encontrado.'      ELSE 'OK: Usuário encontrado.'        END AS status_usuario;

-- ============================================================
-- PASSO 3: Inserir Interessados (apenas os que ainda não existem)
-- ============================================================
-- Diagnóstico: interessados que serão truncados (mais de 191 caracteres)
-- Execute esta query antes para revisar — corrija na planilha se necessário
SELECT
  linha,
  num_sei,
  interessado,
  LENGTH(interessado) AS tamanho,
  LEFT(interessado, 191) AS valor_que_sera_gravado
FROM importacao_planilha
WHERE LENGTH(interessado) > 191
ORDER BY LENGTH(interessado) DESC;

INSERT IGNORE INTO interessados (id, valor, ativo, criadoEm)
SELECT UUID(), t.interessado, TRUE, NOW()
FROM (SELECT DISTINCT interessado FROM importacao_planilha WHERE interessado IS NOT NULL AND interessado != '') t
WHERE NOT EXISTS (
  SELECT 1 FROM interessados i WHERE i.valor = t.interessado
);

-- ============================================================
-- PASSO 4a: Pré-agregar dados por SEI numa tabela auxiliar
-- (roda rápido com o índice criado no Passo 1)
-- ============================================================
DROP TABLE IF EXISTS tmp_sei_agg;

CREATE TABLE tmp_sei_agg AS
SELECT
  num_sei,
  MIN(linha) AS primeira_linha,
  -- Última prorrogação não-nula (linha mais alta)
  SUBSTRING_INDEX(
    GROUP_CONCAT(CASE WHEN prorrogacao_prazo IS NOT NULL AND prorrogacao_prazo != '' THEN prorrogacao_prazo END
                 ORDER BY linha DESC SEPARATOR '§'), '§', 1
  ) AS prorrogacao_final,
  -- Última data_resposta_final não-nula (linha mais alta)
  SUBSTRING_INDEX(
    GROUP_CONCAT(CASE WHEN data_resposta_final IS NOT NULL AND data_resposta_final != '' THEN data_resposta_final END
                 ORDER BY linha DESC SEPARATOR '§'), '§', 1
  ) AS resposta_final
FROM importacao_planilha
WHERE num_sei IS NOT NULL AND num_sei != ''
GROUP BY num_sei;

ALTER TABLE tmp_sei_agg ADD INDEX idx_primeira_linha (primeira_linha);
ALTER TABLE tmp_sei_agg ADD INDEX idx_num_sei (num_sei(100));

-- ============================================================
-- PASSO 4b: Inserir Processos usando JOINs (muito mais rápido)
-- ============================================================
INSERT INTO processos (
  id,
  numero_sei,
  assunto,
  origem,
  interessado_id,
  unidade_remetente_id,
  unidade_destino_id,
  prazo,
  prorrogacao,
  data_recebimento,
  data_envio_unidade,
  data_resposta_final,
  ativo,
  unidade_id,
  criadoEm,
  atualizadoEm
)
SELECT
  UUID(),
  t.num_sei,
  t.assunto,
  COALESCE(NULLIF(t.unidade_emissora, ''), 'EXPEDIENTE'),
  i.id,
  ur.id,
  NULL,
  STR_TO_DATE(NULLIF(t.prazo, ''), '%d/%m/%Y'),
  STR_TO_DATE(NULLIF(agg.prorrogacao_final, ''), '%d/%m/%Y'),
  -- NULLIF após STR_TO_DATE descarta datas inválidas que MySQL aceita mas Prisma rejeita (ex: mês/dia zero)
  COALESCE(NULLIF(STR_TO_DATE(NULLIF(t.data_chegada_gab, ''), '%d/%m/%Y'), '0000-00-00'), CURDATE()),
  STR_TO_DATE(NULLIF(t.data_envio_unidade, ''), '%d/%m/%Y'),
  STR_TO_DATE(NULLIF(agg.resposta_final, ''), '%d/%m/%Y'),
  TRUE,
  @unidade_gab_id,
  NOW(),
  NOW()
FROM importacao_planilha t
INNER JOIN tmp_sei_agg agg ON t.linha = agg.primeira_linha
LEFT JOIN interessados i ON i.valor = t.interessado
LEFT JOIN unidades ur ON (ur.sigla = t.unidade_remetente OR ur.nome = t.unidade_remetente) AND ur.ativo = TRUE
WHERE t.num_sei IS NOT NULL AND t.num_sei != ''
  AND NOT EXISTS (SELECT 1 FROM processos p WHERE p.numero_sei = t.num_sei);

-- ============================================================
-- PASSO 5: Inserir Andamentos — UM por linha da planilha
-- (inclusive as linhas com SEI repetido = múltiplos andamentos)
-- ============================================================
INSERT INTO andamentos (
  id,
  origem,
  destino,
  data_envio,
  prazo,
  prorrogacao,
  resposta,
  status,
  observacao,
  ativo,
  processo_id,
  usuario_id,
  criadoEm,
  atualizadoEm
)
SELECT
  UUID(),
  COALESCE(NULLIF(t.unidade_emissora, ''), COALESCE(NULLIF(t.unidade_remetente, ''), 'EXPEDIENTE')),
  COALESCE(NULLIF(t.unidade_destinataria, ''), 'NAO INFORMADO'),
  STR_TO_DATE(NULLIF(t.data_envio_unidade, ''), '%d/%m/%Y'),
  STR_TO_DATE(NULLIF(t.prazo_fatal2, ''), '%d/%m/%Y'),
  STR_TO_DATE(NULLIF(t.prorrogacao_prazo, ''), '%d/%m/%Y'),
  STR_TO_DATE(NULLIF(t.data_resposta_gab, ''), '%d/%m/%Y'),
  CASE
    WHEN t.data_resposta_gab  IS NOT NULL AND t.data_resposta_gab  != '' THEN 'CONCLUIDO'
    WHEN t.prorrogacao_prazo  IS NOT NULL AND t.prorrogacao_prazo  != '' THEN 'PRORROGADO'
    ELSE 'EM_ANDAMENTO'
  END,
  t.observacoes,
  TRUE,
  p.id,
  @usuario_importacao_id,
  NOW(),
  NOW()
FROM importacao_planilha t
INNER JOIN processos p ON p.numero_sei = t.num_sei
WHERE t.num_sei IS NOT NULL AND t.num_sei != '';

-- Limpeza da tabela auxiliar
DROP TABLE IF EXISTS tmp_sei_agg;

-- ============================================================
-- PASSO 6: Checar datas que não converteram (retornam NULL inesperado)
-- Se aparecer alguma linha aqui, a data está num formato diferente na planilha.
-- ============================================================
SELECT
  linha,
  num_sei,
  data_chegada_gab,    STR_TO_DATE(NULLIF(data_chegada_gab,   ''), '%d/%m/%Y') AS chegada_convertida,
  data_envio_unidade,  STR_TO_DATE(NULLIF(data_envio_unidade, ''), '%d/%m/%Y') AS envio_convertido,
  prazo,               STR_TO_DATE(NULLIF(prazo,              ''), '%d/%m/%Y') AS prazo_convertido,
  data_resposta_gab,   STR_TO_DATE(NULLIF(data_resposta_gab,  ''), '%d/%m/%Y') AS resposta_gab_convertida,
  prazo_fatal2,        STR_TO_DATE(NULLIF(prazo_fatal2,        ''), '%d/%m/%Y') AS fatal2_convertido,
  prorrogacao_prazo,   STR_TO_DATE(NULLIF(prorrogacao_prazo,  ''), '%d/%m/%Y') AS prorrogacao_convertida,
  data_resposta_final, STR_TO_DATE(NULLIF(data_resposta_final,''), '%d/%m/%Y') AS resposta_final_convertida
FROM importacao_planilha
WHERE NULLIF(data_chegada_gab,   '') IS NOT NULL AND STR_TO_DATE(NULLIF(data_chegada_gab,   ''), '%d/%m/%Y') IS NULL
   OR NULLIF(data_envio_unidade, '') IS NOT NULL AND STR_TO_DATE(NULLIF(data_envio_unidade, ''), '%d/%m/%Y') IS NULL
   OR NULLIF(prazo,              '') IS NOT NULL AND STR_TO_DATE(NULLIF(prazo,              ''), '%d/%m/%Y') IS NULL
   OR NULLIF(prazo_fatal2,        '') IS NOT NULL AND STR_TO_DATE(NULLIF(prazo_fatal2,        ''), '%d/%m/%Y') IS NULL
   OR NULLIF(prorrogacao_prazo,  '') IS NOT NULL AND STR_TO_DATE(NULLIF(prorrogacao_prazo,  ''), '%d/%m/%Y') IS NULL
   OR NULLIF(data_resposta_final,'') IS NOT NULL AND STR_TO_DATE(NULLIF(data_resposta_final,''), '%d/%m/%Y') IS NULL;

-- ============================================================
-- PASSO 7: Verificação — confira os registros importados
-- ============================================================
SELECT
  p.numero_sei                                    AS 'nº SEI',
  i.valor                                         AS 'Interessado',
  LEFT(p.assunto, 50)                             AS 'Assunto',
  ur.sigla                                        AS 'Unid. Remetente',
  DATE_FORMAT(p.data_recebimento, '%d/%m/%Y')     AS 'Data chegada GAB',
  p.origem                                        AS 'Unid. Emissora',
  a.destino                                       AS 'Unid. Destinatária',
  DATE_FORMAT(a.data_envio, '%d/%m/%Y')           AS 'Data envio unidade',
  DATE_FORMAT(p.prazo, '%d/%m/%Y')                AS 'Prazo processo',
  DATE_FORMAT(a.resposta, '%d/%m/%Y')             AS 'Data resposta GAB',
  DATE_FORMAT(a.prazo, '%d/%m/%Y')                AS 'Prazo FATAL2',
  DATE_FORMAT(p.prorrogacao, '%d/%m/%Y')          AS 'Prorrogação',
  DATE_FORMAT(p.data_resposta_final, '%d/%m/%Y')  AS 'Data resposta FINAL',
  a.observacao                                    AS 'Observações',
  a.status                                        AS 'Status andamento'
FROM processos p
LEFT JOIN interessados i ON i.id  = p.interessado_id
LEFT JOIN unidades ur    ON ur.id = p.unidade_remetente_id
LEFT JOIN andamentos a   ON a.processo_id = p.id
ORDER BY p.numero_sei, a.criadoEm
LIMIT 500;

-- ============================================================
-- PASSO 8: Apagar a tabela de importação após conferir os dados
-- ============================================================
-- DROP TABLE IF EXISTS importacao_planilha;
