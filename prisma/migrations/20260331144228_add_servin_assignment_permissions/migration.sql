-- AlterTable
ALTER TABLE `processos` ADD COLUMN `usuario_atribuido_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `usuarios` ADD COLUMN `servin_editar_proprios` BOOLEAN NULL,
    ADD COLUMN `servin_editar_todos` BOOLEAN NULL,
    ADD COLUMN `servin_excluir_todos` BOOLEAN NULL,
    ADD COLUMN `servin_visualizar_proprios` BOOLEAN NULL,
    ADD COLUMN `servin_visualizar_todos` BOOLEAN NULL;

-- AddForeignKey
ALTER TABLE `processos` ADD CONSTRAINT `processos_usuario_atribuido_id_fkey` FOREIGN KEY (`usuario_atribuido_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
