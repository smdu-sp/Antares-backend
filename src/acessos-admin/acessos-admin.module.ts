import { Module } from '@nestjs/common';
import { LogsModule } from 'src/logs/logs.module';
import { AcessosAdminController } from './acessos-admin.controller';
import { AcessosAdminService } from './acessos-admin.service';

@Module({
  imports: [LogsModule],
  controllers: [AcessosAdminController],
  providers: [AcessosAdminService],
  exports: [AcessosAdminService],
})
export class AcessosAdminModule {}
