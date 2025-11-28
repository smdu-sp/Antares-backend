-- AlterTable
ALTER TABLE `processos` ADD COLUMN `data_resposta_final` DATETIME(3) NULL,
    ADD COLUMN `resposta_final` VARCHAR(191) NULL,
    ADD COLUMN `unidade_respondida_id` VARCHAR(191) NULL;
