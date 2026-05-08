import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GrupoCodigo } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/is-public.decorator';

@Injectable()
export class RoleGuard implements CanActivate {
  private readonly CHAVE_GRUPO_ATIVO = 'auth.grupo_ativo_id';

  constructor(
    private reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const permissoes = this.reflector.getAllAndOverride<string[]>(
      'permissoes',
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest();
    const id = request?.user?.id;

    if (!id) {
      return false;
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: { permissao: true, status: true },
    });

    if (!usuario || !usuario.status) {
      return false;
    }

    // Sem metadata de @Permissoes: delega para outros guards (ex.: capacidades).
    if (!permissoes || permissoes.length === 0) {
      return true;
    }

    if (usuario.permissao === 'DEV') {
      return true;
    }

    const usuarioEhMasterGlobal = await this.prisma.usuarioGrupo.findFirst({
      where: {
        usuario_id: id,
        ativo: true,
        grupo: {
          ativo: true,
          codigo: GrupoCodigo.GLOBAL,
        },
      },
      select: { id: true },
    });

    if (usuarioEhMasterGlobal) {
      return true;
    }

    const permissoesSistema = permissoes.filter((item) =>
      ['DEV', 'ADM'].includes(item),
    );

    const permissoesGrupo = permissoes.filter((item) =>
      ['ADM', 'TEC', 'USR'].includes(item),
    );

    // Quando a rota pede apenas papel de sistema, valida no usuário.
    if (permissoesGrupo.length === 0) {
      return permissoesSistema.includes(usuario.permissao);
    }

    // Para rotas de negócio, usa papel no grupo ativo.
    const preferencia = await this.prisma.preferenciasUsuario.findUnique({
      where: {
        usuario_id_chave: {
          usuario_id: id,
          chave: this.CHAVE_GRUPO_ATIVO,
        },
      },
      select: { valor: true, ativo: true },
    });

    const grupoAtivoPreferido =
      preferencia?.ativo && preferencia.valor ? preferencia.valor : null;

    const vinculoAtivo =
      (grupoAtivoPreferido
        ? await this.prisma.usuarioGrupo.findFirst({
            where: {
              usuario_id: id,
              grupo_id: grupoAtivoPreferido,
              ativo: true,
              grupo: { ativo: true },
            },
            select: { permissao_grupo: true, grupo_id: true },
          })
        : null) ||
      (await this.prisma.usuarioGrupo.findFirst({
        where: {
          usuario_id: id,
          ativo: true,
          grupo: { ativo: true },
        },
        orderBy: [{ criadoEm: 'asc' }],
        select: { permissao_grupo: true, grupo_id: true },
      }));

    if (!vinculoAtivo) {
      return false;
    }

    if (!grupoAtivoPreferido || grupoAtivoPreferido !== vinculoAtivo.grupo_id) {
      await this.prisma.preferenciasUsuario.upsert({
        where: {
          usuario_id_chave: {
            usuario_id: id,
            chave: this.CHAVE_GRUPO_ATIVO,
          },
        },
        create: {
          usuario_id: id,
          chave: this.CHAVE_GRUPO_ATIVO,
          valor: vinculoAtivo.grupo_id,
          ativo: true,
        },
        update: {
          valor: vinculoAtivo.grupo_id,
          ativo: true,
          atualizadoEm: new Date(),
        },
      });
    }

    return permissoesGrupo.includes(vinculoAtivo.permissao_grupo);
  }
}
