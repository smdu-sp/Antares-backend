import { Module } from '@nestjs/common';
import { ProcessosService } from './processos.service';
import { ProcessosController } from './processos.controller';

/**
 * Module - Organização e Injeção de Dependências
 * 
 * O Module é responsável por:
 * 1. Organizar os componentes relacionados (Controller, Service)
 * 2. Configurar injeção de dependências
 * 3. Exportar serviços para uso em outros módulos
 * 4. Importar dependências necessárias (outros módulos)
 * 
 * O NestJS usa módulos para organizar a aplicação em funcionalidades.
 * Cada módulo encapsula uma funcionalidade específica.
 */
@Module({
  controllers: [ProcessosController], // Controllers deste módulo
  providers: [ProcessosService],      // Services deste módulo
  exports: [ProcessosService],        // Exporta o service para uso em outros módulos
})
export class ProcessosModule {}

