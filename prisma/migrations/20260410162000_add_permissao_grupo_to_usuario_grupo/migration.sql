-- AlterTable
ALTER TABLE `usuarios_grupos`
ADD COLUMN `permissao_grupo` ENUM('ADM', 'TEC', 'USR') NOT NULL DEFAULT 'USR';

-- Backfill best-effort from legacy usuario.permissaoCoordenadoria when available
UPDATE `usuarios_grupos` ug
INNER JOIN `usuarios` u ON u.`id` = ug.`usuario_id`
SET ug.`permissao_grupo` =
  CASE
    WHEN u.`permissaoCoordenadoria` = 'ADMINISTRADOR' THEN 'ADM'
    WHEN u.`permissaoCoordenadoria` = 'EDITOR' THEN 'TEC'
    ELSE ug.`permissao_grupo`
  END;
