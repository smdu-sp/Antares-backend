-- AlterTable
ALTER TABLE `usuarios` ADD COLUMN `coordenadoria` ENUM('EXPEDIENTE', 'SERVIN') NULL,
    ADD COLUMN `permissaoCoordenadoria` ENUM('ADMINISTRADOR', 'EDITOR', 'LEITOR') NULL;
