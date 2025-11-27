-- AlterTable
ALTER TABLE `andamentos` ADD COLUMN `ativo` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `logs` ADD COLUMN `ativo` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `processos` ADD COLUMN `ativo` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `unidades` ADD COLUMN `ativo` BOOLEAN NOT NULL DEFAULT true;
