import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GrupoCodigo } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CapacidadeGuard implements CanActivate {
  private readonly CHAVE_GRUPO_ATIVO = 'auth.grupo_ativo_id';

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const capacidades = this.reflector.getAllAndOverride<string[]>(
      'capacidades',
      [context.getHandler(), context.getClass()],
    );

    if (!capacidades || capacidades.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const usuarioId = request?.user?.id;

    if (!usuarioId) {
      return false;
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        permissao: true,
        status: true,
      },
    });

    if (!usuario || !usuario.status) {
      return false;
    }

    if (usuario.permissao === 'DEV' || usuario.permissao === 'ADM') {
      return true;
    }

    const vinculoGlobalMaster = await this.prisma.usuarioGrupo.findFirst({
      where: {
        usuario_id: usuarioId,
        ativo: true,
        grupo: {
          ativo: true,
          codigo: GrupoCodigo.GLOBAL,
        },
      },
      select: { id: true },
    });

    if (vinculoGlobalMaster) {
      return true;
    }

    const vinculos = await this.prisma.usuarioGrupo.findMany({
      where: {
        usuario_id: usuarioId,
        ativo: true,
        grupo: {
          ativo: true,
        },
      },
      include: {
        grupo: {
          select: {
            id: true,
            codigo: true,
            nome: true,
          },
        },
        permissao: {
          select: {
            visualizar_proprios: true,
            visualizar_grupo: true,
            modificar_proprios: true,
            modificar_grupo: true,
            excluir: true,
            ativo: true,
          },
        },
      },
      orderBy: [{ grupo: { codigo: 'asc' } }, { criadoEm: 'asc' }],
    });

    if (vinculos.length === 0) {
      return false;
    }

    const headerGrupoAtivo = this.extrairHeaderGrupoAtivo(request);
    const preferenciaGrupoAtivo =
      await this.prisma.preferenciasUsuario.findUnique({
        where: {
          usuario_id_chave: {
            usuario_id: usuarioId,
            chave: this.CHAVE_GRUPO_ATIVO,
          },
        },
        select: {
          valor: true,
          ativo: true,
        },
      });

    const idPreferido =
      preferenciaGrupoAtivo?.ativo && preferenciaGrupoAtivo.valor
        ? preferenciaGrupoAtivo.valor
        : null;

    const vinculoAtivo =
      (headerGrupoAtivo
        ? vinculos.find((item) => item.grupo_id === headerGrupoAtivo)
        : null) ||
      (idPreferido
        ? vinculos.find((item) => item.grupo_id === idPreferido)
        : null) ||
      vinculos[0];

    if (!vinculoAtivo?.permissao || !vinculoAtivo.permissao.ativo) {
      return false;
    }

    if (idPreferido !== vinculoAtivo.grupo.id) {
      await this.prisma.preferenciasUsuario.upsert({
        where: {
          usuario_id_chave: {
            usuario_id: usuarioId,
            chave: this.CHAVE_GRUPO_ATIVO,
          },
        },
        create: {
          usuario_id: usuarioId,
          chave: this.CHAVE_GRUPO_ATIVO,
          valor: vinculoAtivo.grupo.id,
          ativo: true,
        },
        update: {
          valor: vinculoAtivo.grupo.id,
          ativo: true,
          atualizadoEm: new Date(),
        },
      });
    }

    request.grupoAtivo = {
      id: vinculoAtivo.grupo.id,
      codigo: vinculoAtivo.grupo.codigo,
      nome: vinculoAtivo.grupo.nome,
    };

    return capacidades.every((capacidade) =>
      this.avaliarCapacidade(
        vinculoAtivo.grupo.codigo,
        vinculoAtivo.permissao,
        capacidade,
      ),
    );
  }

  private extrairHeaderGrupoAtivo(request: any): string | null {
    const raw = request?.headers?.['x-grupo-ativo-id'];

    if (!raw) {
      return null;
    }

    if (Array.isArray(raw)) {
      return raw[0] || null;
    }

    return raw;
  }

  private avaliarCapacidade(
    grupoCodigo: GrupoCodigo,
    permissao: {
      visualizar_proprios: boolean;
      visualizar_grupo: boolean;
      modificar_proprios: boolean;
      modificar_grupo: boolean;
      excluir: boolean;
    },
    capacidade: string,
  ): boolean {
    const acao = capacidade.split('.')[1];

    if (acao === 'visualizar') {
      if (grupoCodigo === GrupoCodigo.GABINETE && permissao.visualizar_grupo) {
        return true;
      }

      return permissao.visualizar_grupo || permissao.visualizar_proprios;
    }

    if (acao === 'modificar') {
      return permissao.modificar_grupo || permissao.modificar_proprios;
    }

    if (acao === 'excluir') {
      return permissao.excluir;
    }

    return false;
  }
}
