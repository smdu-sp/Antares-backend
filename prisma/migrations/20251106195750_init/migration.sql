-- CreateTable
CREATE TABLE `usuarios` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `nomeSocial` VARCHAR(191) NULL,
    `login` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `permissao` ENUM('DEV', 'ADM', 'TEC', 'USR') NOT NULL DEFAULT 'USR',
    `status` BOOLEAN NOT NULL DEFAULT true,
    `avatar` TEXT NULL,
    `ultimoLogin` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `usuarios_login_key`(`login`),
    UNIQUE INDEX `usuarios_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `processos` (
    `id` VARCHAR(191) NOT NULL,
    `numero_sei` VARCHAR(191) NOT NULL,
    `assunto` VARCHAR(191) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `processos_numero_sei_key`(`numero_sei`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `andamentos` (
    `id` VARCHAR(191) NOT NULL,
    `origem` VARCHAR(191) NOT NULL,
    `destino` VARCHAR(191) NOT NULL,
    `prazo` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `prorrogacao` DATETIME(3) NULL,
    `conclusao` DATETIME(3) NULL,
    `status` ENUM('EM_ANDAMENTO', 'CONCLUIDO', 'PRORROGADO') NOT NULL DEFAULT 'EM_ANDAMENTO',
    `observacao` VARCHAR(191) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processo_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `andamentos` ADD CONSTRAINT `andamentos_processo_id_fkey` FOREIGN KEY (`processo_id`) REFERENCES `processos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
