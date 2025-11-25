/*
  Warnings:

  - You are about to drop the column `conclusao` on the `andamentos` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `andamentos` DROP COLUMN `conclusao`,
    ADD COLUMN `resposta` DATETIME(3) NULL;
