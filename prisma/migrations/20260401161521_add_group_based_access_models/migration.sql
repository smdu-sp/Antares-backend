-- AlterTable
ALTER TABLE `logs` MODIFY `tipoAcao` ENUM('PROCESSO_CRIADO', 'PROCESSO_ATUALIZADO', 'PROCESSO_REMOVIDO', 'ANDAMENTO_CRIADO', 'ANDAMENTO_ATUALIZADO', 'ANDAMENTO_PRORROGADO', 'ANDAMENTO_CONCLUIDO', 'ANDAMENTO_REMOVIDO', 'USUARIO_PERMISSAO_ATUALIZADA', 'GRUPO_ATUALIZADO', 'PROCESSO_GRUPO_ATUALIZADO') NOT NULL;

-- CreateTable
CREATE TABLE `grupos` (
    `id` VARCHAR(191) NOT NULL,
    `codigo` ENUM('EXPEDIENTE', 'SERVIN', 'GABINETE') NOT NULL DEFAULT 'EXPEDIENTE',
    `nome` VARCHAR(191) NOT NULL,
    `tipo` ENUM('COORDENADORIA', 'DIVISAO') NOT NULL DEFAULT 'COORDENADORIA',
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `grupos_codigo_idx`(`codigo`),
    INDEX `grupos_tipo_idx`(`tipo`),
    UNIQUE INDEX `grupos_codigo_tipo_key`(`codigo`, `tipo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usuarios_grupos` (
    `id` VARCHAR(191) NOT NULL,
    `usuario_id` VARCHAR(191) NOT NULL,
    `grupo_id` VARCHAR(191) NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `usuarios_grupos_usuario_id_idx`(`usuario_id`),
    INDEX `usuarios_grupos_grupo_id_idx`(`grupo_id`),
    UNIQUE INDEX `usuarios_grupos_usuario_id_grupo_id_key`(`usuario_id`, `grupo_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usuarios_grupos_permissoes` (
    `id` VARCHAR(191) NOT NULL,
    `usuario_grupo_id` VARCHAR(191) NOT NULL,
    `visualizar_proprios` BOOLEAN NOT NULL DEFAULT false,
    `visualizar_grupo` BOOLEAN NOT NULL DEFAULT false,
    `modificar_proprios` BOOLEAN NOT NULL DEFAULT false,
    `modificar_grupo` BOOLEAN NOT NULL DEFAULT false,
    `excluir` BOOLEAN NOT NULL DEFAULT false,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `usuarios_grupos_permissoes_usuario_grupo_id_key`(`usuario_grupo_id`),
    INDEX `usuarios_grupos_permissoes_usuario_grupo_id_idx`(`usuario_grupo_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `processos_grupos` (
    `id` VARCHAR(191) NOT NULL,
    `processo_id` VARCHAR(191) NOT NULL,
    `grupo_id` VARCHAR(191) NOT NULL,
    `nivelVisao` ENUM('TOTAL', 'PARCIAL') NOT NULL DEFAULT 'TOTAL',
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `processos_grupos_processo_id_idx`(`processo_id`),
    INDEX `processos_grupos_grupo_id_idx`(`grupo_id`),
    UNIQUE INDEX `processos_grupos_processo_id_grupo_id_key`(`processo_id`, `grupo_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `usuarios_grupos` ADD CONSTRAINT `usuarios_grupos_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuarios_grupos` ADD CONSTRAINT `usuarios_grupos_grupo_id_fkey` FOREIGN KEY (`grupo_id`) REFERENCES `grupos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuarios_grupos_permissoes` ADD CONSTRAINT `usuarios_grupos_permissoes_usuario_grupo_id_fkey` FOREIGN KEY (`usuario_grupo_id`) REFERENCES `usuarios_grupos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `processos_grupos` ADD CONSTRAINT `processos_grupos_processo_id_fkey` FOREIGN KEY (`processo_id`) REFERENCES `processos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `processos_grupos` ADD CONSTRAINT `processos_grupos_grupo_id_fkey` FOREIGN KEY (`grupo_id`) REFERENCES `grupos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
