-- CreateTable
CREATE TABLE `coordenadorias_contexto` (
    `id` VARCHAR(191) NOT NULL,
    `coordenadoria` ENUM('EXPEDIENTE', 'SERVIN') NOT NULL,
    `contexto` VARCHAR(191) NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `coordenadorias_contexto_coordenadoria_key`(`coordenadoria`),
    INDEX `coordenadorias_contexto_coordenadoria_idx`(`coordenadoria`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
