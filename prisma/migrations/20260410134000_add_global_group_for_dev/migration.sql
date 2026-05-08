-- AlterTable
ALTER TABLE `grupos` MODIFY `codigo` ENUM('EXPEDIENTE', 'SERVIN', 'GABINETE', 'GLOBAL') NOT NULL DEFAULT 'EXPEDIENTE';

-- Seed GLOBAL group for DEV context
INSERT INTO `grupos` (`id`, `codigo`, `nome`, `tipo`, `ativo`, `criadoEm`, `atualizadoEm`)
VALUES (UUID(), 'GLOBAL', 'Contexto Global (DEV)', 'DIVISAO', true, NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE
  `nome` = VALUES(`nome`),
  `ativo` = true,
  `atualizadoEm` = NOW(3);
