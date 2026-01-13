import { Module } from '@nestjs/common';
import { InteressadosService } from './interessados.service';
import { InteressadosController } from './interessados.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InteressadosController],
  providers: [InteressadosService],
  exports: [InteressadosService],
})
export class InteressadosModule {}
