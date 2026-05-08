import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  $Enums,
  GrupoCodigo,
  GrupoTipo,
  NivelVisaoGrupoProcesso,
} from '@prisma/client';
import { LogsService } from 'src/logs/logs.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateGrupoDto } from './dto/create-grupo.dto';
import { UpdateGrupoDto } from './dto/update-grupo.dto';
import { VincularUsuarioGrupoDto } from './dto/vincular-usuario-grupo.dto';
import { AtualizarPermissoesUsuarioGrupoDto } from './dto/atualizar-permissoes-usuario-grupo.dto';
import { VincularProcessoGrupoDto } from './dto/vincular-processo-grupo.dto';

@Injectable()
export class AcessosAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logsService: LogsService,
  ) {}

  async listarGrupos() {
    const grupos = await this.prisma.grupo.findMany({
      orderBy: [{ tipo: 'asc' }, { codigo: 'asc' }],
    });

    return { total: grupos.length, data: grupos };
  }

  async criarGrupo(dto: CreateGrupoDto, usuarioId: string) {
    const existente = await this.prisma.grupo.findUnique({
      where: {
        codigo_tipo: {
          codigo: dto.codigo,
          tipo: dto.tipo,
        },
      },
      select: { id: true },
    });

    if (existente) {
      throw new BadRequestException(
        'Ja existe um grupo com este codigo e tipo.',
      );
    }

    const grupo = await this.prisma.grupo.create({
      data: {
        codigo: dto.codigo,
        tipo: dto.tipo,
        nome: dto.nome,
        ativo: true,
      },
    });

    await this.logsService.criar(
      $Enums.TipoAcao.GRUPO_ATUALIZADO,
      `Grupo criado: ${grupo.codigo}/${grupo.tipo} - ${grupo.nome}`,
      'grupo',
      grupo.id,
      usuarioId,
      null,
      grupo,
    );

    return grupo;
  }

  async atualizarGrupo(id: string, dto: UpdateGrupoDto, usuarioId: string) {
    const grupoAtual = await this.prisma.grupo.findUnique({
      where: { id },
    });

    if (!grupoAtual) {
      throw new NotFoundException('Grupo nao encontrado.');
    }

    if (dto.codigo || dto.tipo) {
      const codigo = dto.codigo ?? grupoAtual.codigo;
      const tipo = dto.tipo ?? grupoAtual.tipo;

      const conflito = await this.prisma.grupo.findUnique({
        where: {
          codigo_tipo: {
            codigo,
            tipo,
          },
        },
        select: { id: true },
      });

      if (conflito && conflito.id !== id) {
        throw new BadRequestException(
          'Ja existe um grupo com este codigo e tipo.',
        );
      }
    }

    const grupo = await this.prisma.grupo.update({
      where: { id },
      data: {
        ...(dto.codigo !== undefined ? { codigo: dto.codigo } : {}),
        ...(dto.tipo !== undefined ? { tipo: dto.tipo } : {}),
        ...(dto.nome !== undefined ? { nome: dto.nome } : {}),
      },
    });

    await this.logsService.criar(
      $Enums.TipoAcao.GRUPO_ATUALIZADO,
      `Grupo atualizado: ${grupo.codigo}/${grupo.tipo} - ${grupo.nome}`,
      'grupo',
      grupo.id,
      usuarioId,
      grupoAtual,
      grupo,
    );

    return grupo;
  }

  async desativarGrupo(id: string, usuarioId: string) {
    const grupoAtual = await this.prisma.grupo.findUnique({ where: { id } });

    if (!grupoAtual) {
      throw new NotFoundException('Grupo nao encontrado.');
    }

    const grupo = await this.prisma.grupo.update({
      where: { id },
      data: { ativo: false },
    });

    await this.logsService.criar(
      $Enums.TipoAcao.GRUPO_ATUALIZADO,
      `Grupo desativado: ${grupo.codigo}/${grupo.tipo} - ${grupo.nome}`,
      'grupo',
      grupo.id,
      usuarioId,
      grupoAtual,
      grupo,
    );

    return { sucesso: true };
  }

  async listarGruposUsuario(usuarioId: string) {
    await this.validarUsuario(usuarioId);

    const grupos = await this.prisma.usuarioGrupo.findMany({
      where: { usuario_id: usuarioId },
      include: {
        grupo: true,
        permissao: true,
      },
      orderBy: {
        criadoEm: 'desc',
      },
    });

    return { total: grupos.length, data: grupos };
  }

  async listarUsuariosGrupos(usuarioId?: string) {
    if (usuarioId) {
      await this.validarUsuario(usuarioId);
    }

    const grupos = await this.prisma.usuarioGrupo.findMany({
      where: {
        ...(usuarioId ? { usuario_id: usuarioId } : {}),
      },
      include: {
        usuario: {
          select: {
            id: true,
            nome: true,
            login: true,
            email: true,
            permissao: true,
            status: true,
          },
        },
        grupo: true,
        permissao: true,
      },
      orderBy: [{ usuario: { nome: 'asc' } }, { criadoEm: 'desc' }],
    });

    return { total: grupos.length, data: grupos };
  }

  async vincularUsuarioGrupo(
    usuarioId: string,
    grupoId: string,
    dto: VincularUsuarioGrupoDto,
    operadorId: string,
  ) {
    await this.validarUsuario(usuarioId);
    await this.validarGrupo(grupoId);

    const vinculoAtual = await this.prisma.usuarioGrupo.findUnique({
      where: {
        usuario_id_grupo_id: {
          usuario_id: usuarioId,
          grupo_id: grupoId,
        },
      },
      select: {
        id: true,
        ativo: true,
      },
    });

    const ativo = dto.ativo ?? vinculoAtual?.ativo ?? true;
    const permissaoGrupo = dto.permissao_grupo ?? 'USR';

    if (vinculoAtual?.ativo && dto.ativo === false) {
      const outrosAtivos = await this.prisma.usuarioGrupo.count({
        where: {
          usuario_id: usuarioId,
          ativo: true,
          NOT: {
            grupo_id: grupoId,
          },
          grupo: {
            ativo: true,
          },
        },
      });

      if (outrosAtivos === 0) {
        throw new BadRequestException(
          'Usuario deve manter pelo menos um grupo ativo.',
        );
      }
    }

    const vinculo = await this.prisma.usuarioGrupo.upsert({
      where: {
        usuario_id_grupo_id: {
          usuario_id: usuarioId,
          grupo_id: grupoId,
        },
      },
      create: {
        usuario_id: usuarioId,
        grupo_id: grupoId,
        permissao_grupo: permissaoGrupo,
        ativo,
      },
      update: {
        ativo,
        ...(dto.permissao_grupo !== undefined
          ? { permissao_grupo: dto.permissao_grupo }
          : {}),
      },
      include: {
        grupo: true,
      },
    });

    await this.logsService.criar(
      $Enums.TipoAcao.USUARIO_PERMISSAO_ATUALIZADA,
      `Vinculo usuario-grupo atualizado: usuario=${usuarioId}, grupo=${vinculo.grupo.codigo}`,
      'usuario_grupo',
      vinculo.id,
      operadorId,
      null,
      vinculo,
    );

    return vinculo;
  }

  async atualizarPermissoesUsuarioGrupo(
    usuarioId: string,
    grupoId: string,
    dto: AtualizarPermissoesUsuarioGrupoDto,
    operadorId: string,
  ) {
    await this.validarUsuario(usuarioId);
    await this.validarGrupo(grupoId);

    const vinculo = await this.prisma.usuarioGrupo.upsert({
      where: {
        usuario_id_grupo_id: {
          usuario_id: usuarioId,
          grupo_id: grupoId,
        },
      },
      create: {
        usuario_id: usuarioId,
        grupo_id: grupoId,
        ativo: true,
      },
      update: {},
    });

    const atual = await this.prisma.usuarioGrupoPermissao.findUnique({
      where: { usuario_grupo_id: vinculo.id },
    });

    const permissao = await this.prisma.usuarioGrupoPermissao.upsert({
      where: { usuario_grupo_id: vinculo.id },
      create: {
        usuario_grupo_id: vinculo.id,
        visualizar_proprios: dto.visualizar_proprios ?? false,
        visualizar_grupo: dto.visualizar_grupo ?? false,
        modificar_proprios: dto.modificar_proprios ?? false,
        modificar_grupo: dto.modificar_grupo ?? false,
        excluir: dto.excluir ?? false,
        ativo: dto.ativo ?? true,
      },
      update: {
        ...(dto.visualizar_proprios !== undefined
          ? { visualizar_proprios: dto.visualizar_proprios }
          : {}),
        ...(dto.visualizar_grupo !== undefined
          ? { visualizar_grupo: dto.visualizar_grupo }
          : {}),
        ...(dto.modificar_proprios !== undefined
          ? { modificar_proprios: dto.modificar_proprios }
          : {}),
        ...(dto.modificar_grupo !== undefined
          ? { modificar_grupo: dto.modificar_grupo }
          : {}),
        ...(dto.excluir !== undefined ? { excluir: dto.excluir } : {}),
        ...(dto.ativo !== undefined ? { ativo: dto.ativo } : {}),
      },
    });

    await this.logsService.criar(
      $Enums.TipoAcao.USUARIO_PERMISSAO_ATUALIZADA,
      `Permissao de grupo atualizada: usuario=${usuarioId}, grupo=${grupoId}`,
      'usuario_grupo_permissao',
      permissao.id,
      operadorId,
      atual,
      permissao,
    );

    return permissao;
  }

  async listarGruposProcesso(processoId: string) {
    await this.validarProcesso(processoId);

    const grupos = await this.prisma.processoGrupo.findMany({
      where: { processo_id: processoId },
      include: {
        grupo: true,
      },
      orderBy: {
        criadoEm: 'desc',
      },
    });

    return { total: grupos.length, data: grupos };
  }

  async vincularProcessoGrupo(
    processoId: string,
    grupoId: string,
    dto: VincularProcessoGrupoDto,
    operadorId: string,
  ) {
    await this.validarProcesso(processoId);
    await this.validarGrupo(grupoId);

    const atual = await this.prisma.processoGrupo.findUnique({
      where: {
        processo_id_grupo_id: {
          processo_id: processoId,
          grupo_id: grupoId,
        },
      },
    });

    const vinculo = await this.prisma.processoGrupo.upsert({
      where: {
        processo_id_grupo_id: {
          processo_id: processoId,
          grupo_id: grupoId,
        },
      },
      create: {
        processo_id: processoId,
        grupo_id: grupoId,
        nivelVisao: dto.nivelVisao ?? NivelVisaoGrupoProcesso.TOTAL,
        ativo: dto.ativo ?? true,
      },
      update: {
        ...(dto.nivelVisao !== undefined ? { nivelVisao: dto.nivelVisao } : {}),
        ...(dto.ativo !== undefined ? { ativo: dto.ativo } : {}),
      },
      include: {
        grupo: true,
      },
    });

    await this.logsService.criar(
      $Enums.TipoAcao.PROCESSO_GRUPO_ATUALIZADO,
      `Vinculo processo-grupo atualizado: processo=${processoId}, grupo=${vinculo.grupo.codigo}`,
      'processo_grupo',
      vinculo.id,
      operadorId,
      atual,
      vinculo,
    );

    return vinculo;
  }

  async semearGruposPadrao(usuarioId: string) {
    const padroes: Array<{
      codigo: GrupoCodigo;
      tipo: GrupoTipo;
      nome: string;
    }> = [
      {
        codigo: GrupoCodigo.EXPEDIENTE,
        tipo: GrupoTipo.COORDENADORIA,
        nome: 'Coordenadoria Expediente',
      },
      {
        codigo: GrupoCodigo.SERVIN,
        tipo: GrupoTipo.COORDENADORIA,
        nome: 'Coordenadoria Servin',
      },
      {
        codigo: GrupoCodigo.GABINETE,
        tipo: GrupoTipo.COORDENADORIA,
        nome: 'Gabinete',
      },
      {
        codigo: GrupoCodigo.GLOBAL,
        tipo: GrupoTipo.DIVISAO,
        nome: 'Contexto Global (DEV)',
      },
    ];

    const resultado = [];

    for (const item of padroes) {
      const grupo = await this.prisma.grupo.upsert({
        where: {
          codigo_tipo: {
            codigo: item.codigo,
            tipo: item.tipo,
          },
        },
        create: {
          codigo: item.codigo,
          tipo: item.tipo,
          nome: item.nome,
          ativo: true,
        },
        update: {
          nome: item.nome,
          ativo: true,
        },
      });
      resultado.push(grupo);
    }

    await this.logsService.criar(
      $Enums.TipoAcao.GRUPO_ATUALIZADO,
      'Semeadura de grupos padrao executada no painel DEV.',
      'grupo',
      'semeadura_grupos_padrao',
      usuarioId,
      null,
      { total: resultado.length },
    );

    return { total: resultado.length, data: resultado };
  }

  async obterMatrizPermissoesEfetivas(usuarioId?: string) {
    if (usuarioId) {
      await this.validarUsuario(usuarioId);
    }

    const vinculos = await this.prisma.usuarioGrupo.findMany({
      where: {
        ativo: true,
        ...(usuarioId ? { usuario_id: usuarioId } : {}),
      },
      include: {
        usuario: {
          select: {
            id: true,
            nome: true,
            login: true,
            permissao: true,
            status: true,
          },
        },
        grupo: {
          select: {
            id: true,
            codigo: true,
            tipo: true,
            nome: true,
            ativo: true,
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
      orderBy: [{ usuario: { nome: 'asc' } }, { grupo: { codigo: 'asc' } }],
    });

    const linhas = vinculos.map((item) => {
      const permissao = item.permissao;
      const podeVisualizar =
        !!permissao &&
        (permissao.visualizar_grupo || permissao.visualizar_proprios);
      const podeModificar =
        !!permissao &&
        (permissao.modificar_grupo || permissao.modificar_proprios);

      return {
        usuario: item.usuario,
        grupo: item.grupo,
        permissao: permissao || null,
        efetivo: {
          processo_visualizar: podeVisualizar,
          processo_modificar: podeModificar,
          processo_excluir: !!permissao?.excluir,
          andamento_visualizar: podeVisualizar,
          andamento_modificar: podeModificar,
          andamento_excluir: !!permissao?.excluir,
          visualizacao_global_gabinete:
            item.grupo.codigo === GrupoCodigo.GABINETE &&
            !!permissao?.visualizar_grupo,
        },
      };
    });

    return {
      total: linhas.length,
      data: linhas,
    };
  }

  private async validarUsuario(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { id: true },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario nao encontrado.');
    }
  }

  private async validarGrupo(grupoId: string) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
      select: { id: true },
    });

    if (!grupo) {
      throw new NotFoundException('Grupo nao encontrado.');
    }
  }

  private async validarProcesso(processoId: string) {
    const processo = await this.prisma.processo.findUnique({
      where: { id: processoId },
      select: { id: true },
    });

    if (!processo) {
      throw new NotFoundException('Processo nao encontrado.');
    }
  }
}
