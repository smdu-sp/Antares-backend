-- AlterTable
ALTER TABLE `logs` MODIFY `descricao` VARCHAR(191) NOT NULL,
    MODIFY `dadosAntigos` VARCHAR(191) NULL,
    MODIFY `dadosNovos` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `processos` ADD COLUMN `data_recebimento` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `usuarios` MODIFY `avatar` VARCHAR(191) NULL;
