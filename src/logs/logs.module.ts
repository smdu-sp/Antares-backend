import { Module } from '@nestjs/common';
import { LogsService } from './logs.service';
import { LogsController } from './logs.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

/**
 * Módulo de Logs
 *
 * Responsável por gerenciar o sistema de auditoria e logs do sistema.
 * Registra todas as ações realizadas por usuários para fins de
 * rastreabilidade, auditoria e histórico de alterações.
 *
 * Funcionalidades:
 * - Registro automático de ações (CRUD de processos, andamentos, etc.)
 * - Consulta de logs por tipo, entidade, usuário ou período
 * - Histórico completo de alterações com dados anteriores e novos
 * - Sistema de auditoria para conformidade e segurança
 */
@Module({
  imports: [PrismaModule], // Importa PrismaModule para acesso ao banco
  controllers: [LogsController], // Controller para endpoints de consulta
  providers: [LogsService], // Service com a lógica de negócio
  exports: [LogsService], // Exporta para uso em outros módulos
})
export class LogsModule {}
