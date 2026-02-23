import { Module } from '@nestjs/common';
import { PreferenciasController } from './preferencias.controller';
import { PreferenciasService } from './preferencias.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PreferenciasController],
  providers: [PreferenciasService],
  exports: [PreferenciasService],
})
export class PreferenciasModule {}
