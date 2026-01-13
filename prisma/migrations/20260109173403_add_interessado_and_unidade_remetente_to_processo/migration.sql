-- AlterTable
ALTER TABLE `processos` ADD COLUMN `interessado_id` VARCHAR(191) NULL,
    ADD COLUMN `unidade_remetente_id` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `interessados` (
    `id` VARCHAR(191) NOT NULL,
    `valor` VARCHAR(191) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `interessados_valor_key`(`valor`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `processos` ADD CONSTRAINT `processos_interessado_id_fkey` FOREIGN KEY (`interessado_id`) REFERENCES `interessados`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `processos` ADD CONSTRAINT `processos_unidade_remetente_id_fkey` FOREIGN KEY (`unidade_remetente_id`) REFERENCES `unidades`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
