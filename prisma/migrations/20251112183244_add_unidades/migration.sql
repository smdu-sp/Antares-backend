-- CreateTable
CREATE TABLE `unidades` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `sigla` VARCHAR(191) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `unidades_nome_key`(`nome`),
    UNIQUE INDEX `unidades_sigla_key`(`sigla`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Criar unidade padrão para dados existentes
INSERT INTO `unidades` (`id`, `nome`, `sigla`, `criadoEm`, `atualizadoEm`)
VALUES (UUID(), 'Unidade Padrão', 'PADRAO', NOW(), NOW());

-- Adicionar coluna unidade_id como nullable primeiro
ALTER TABLE `usuarios` ADD COLUMN `unidade_id` VARCHAR(191) NULL;
ALTER TABLE `processos` ADD COLUMN `unidade_id` VARCHAR(191) NULL;

-- Atualizar registros existentes para usar a unidade padrão
UPDATE `usuarios` SET `unidade_id` = (SELECT `id` FROM `unidades` WHERE `sigla` = 'PADRAO' LIMIT 1) WHERE `unidade_id` IS NULL;
UPDATE `processos` SET `unidade_id` = (SELECT `id` FROM `unidades` WHERE `sigla` = 'PADRAO' LIMIT 1) WHERE `unidade_id` IS NULL;

-- Tornar as colunas NOT NULL
ALTER TABLE `usuarios` MODIFY COLUMN `unidade_id` VARCHAR(191) NOT NULL;
ALTER TABLE `processos` MODIFY COLUMN `unidade_id` VARCHAR(191) NOT NULL;

-- AddForeignKey
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_unidade_id_fkey` FOREIGN KEY (`unidade_id`) REFERENCES `unidades`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `processos` ADD CONSTRAINT `processos_unidade_id_fkey` FOREIGN KEY (`unidade_id`) REFERENCES `unidades`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
