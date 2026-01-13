import { Global, Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { ProcessosModule } from './processos/processos.module';
import { AndamentosModule } from './andamentos/andamentos.module';
import { LogsModule } from './logs/logs.module';
import { UnidadesModule } from './unidades/unidades.module';
import { InteressadosModule } from './interessados/interessados.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RoleGuard } from './auth/guards/role.guard';

@Global()
@Module({
  exports: [AppService],
  imports: [
    PrismaModule,
    AuthModule,
    UsuariosModule,
    ProcessosModule,
    AndamentosModule,
    LogsModule,
    UnidadesModule,
    InteressadosModule,
  ],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RoleGuard,
    },
  ],
})
export class AppModule {}
