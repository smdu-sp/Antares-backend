import { Module } from '@nestjs/common';
import { AndamentosService } from './andamentos.service';
import { AndamentosController } from './andamentos.controller';
import { LogsModule } from 'src/logs/logs.module';

@Module({
  imports: [LogsModule], // Importa LogsModule para usar LogsService
  controllers: [AndamentosController],
  providers: [AndamentosService],
  exports: [AndamentosService],
})
export class AndamentosModule {}
