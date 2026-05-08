-- AlterTable
ALTER TABLE `usuarios` MODIFY `coordenadoria` ENUM('EXPEDIENTE', 'SERVIN', 'GLOBAL') NULL;

-- AlterTable
ALTER TABLE `coordenadorias_contexto` MODIFY `coordenadoria` ENUM('EXPEDIENTE', 'SERVIN', 'GLOBAL') NOT NULL;

-- AlterTable
ALTER TABLE `coordenadorias_configuracao_tela` MODIFY `coordenadoria` ENUM('EXPEDIENTE', 'SERVIN', 'GLOBAL') NOT NULL;
