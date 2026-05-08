-- Remove coordenadoria-based permission legacy structures
-- Safe order: drop dependent tables first, then user columns.

DROP TABLE IF EXISTS `coordenadorias_configuracao_tela`;
DROP TABLE IF EXISTS `coordenadorias_contexto`;

ALTER TABLE `usuarios`
  DROP COLUMN `coordenadoria`,
  DROP COLUMN `permissaoCoordenadoria`,
  DROP COLUMN `servin_visualizar_todos`,
  DROP COLUMN `servin_visualizar_proprios`,
  DROP COLUMN `servin_editar_todos`,
  DROP COLUMN `servin_editar_proprios`,
  DROP COLUMN `servin_excluir_todos`;
