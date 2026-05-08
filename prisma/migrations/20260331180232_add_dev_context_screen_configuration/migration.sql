-- CreateTable
CREATE TABLE `coordenadorias_configuracao_tela` (
    `id` VARCHAR(191) NOT NULL,
    `coordenadoria` ENUM('EXPEDIENTE', 'SERVIN') NOT NULL,
    `tela` ENUM('PROCESSOS', 'ANDAMENTOS') NOT NULL,
    `colunas` JSON NOT NULL,
    `filtros` JSON NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `coordenadorias_configuracao_tela_coordenadoria_idx`(`coordenadoria`),
    INDEX `coordenadorias_configuracao_tela_tela_idx`(`tela`),
    UNIQUE INDEX `coordenadorias_configuracao_tela_coordenadoria_tela_key`(`coordenadoria`, `tela`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
