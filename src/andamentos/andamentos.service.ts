import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAndamentoDto } from './dto/create-andamento.dto';
import { UpdateAndamentoDto } from './dto/update-andamento.dto';
import { BatchAndamentoDto } from './dto/batch-andamento.dto';
import { AndamentoResponseDto } from './dto/andamento-response.dto';
import { andamento, $Enums, GrupoCodigo } from '@prisma/client';
import { AppService } from 'src/app.service';
import { LogsService } from 'src/logs/logs.service';

/**
 * Service para gerenciar andamentos de processos
 *
 * Andamento representa o envio de um processo de uma unidade para outra,
 * com controle de prazos, prorrogações e conclusões.
 */
@Injectable()
export class AndamentosService {
  private readonly strictGroupMode = true;
  private readonly CHAVE_GRUPO_ATIVO = 'auth.grupo_ativo_id';

  constructor(
    private prisma: PrismaService,
    private app: AppService,
    private logsService: LogsService,
  ) {}

  private async usuarioEhMasterGlobal(usuarioId?: string) {
    if (!usuarioId) {
      return false;
    }

    const vinculo = await this.prisma.usuarioGrupo.findFirst({
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

    return !!vinculo;
  }

  private async usuarioTemVisualizacaoGabinete(usuarioId?: string) {
    if (!usuarioId) {
      return false;
    }

    const grupoAtivoId = await this.obterGrupoAtivoId(usuarioId);

    if (!grupoAtivoId) {
      return false;
    }

    const permissao = await this.prisma.usuarioGrupoPermissao.findFirst({
      where: {
        ativo: true,
        visualizar_grupo: true,
        usuarioGrupo: {
          ativo: true,
          usuario_id: usuarioId,
          grupo_id: grupoAtivoId,
          grupo: {
            ativo: true,
            codigo: GrupoCodigo.GABINETE,
          },
        },
      },
      select: { id: true },
    });

    return !!permissao;
  }

  private async obterGrupoAtivoId(usuarioId: string): Promise<string | null> {
    const preferencia = await this.prisma.preferenciasUsuario.findUnique({
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

    if (preferencia?.ativo && preferencia.valor) {
      const vinculoPreferido = await this.prisma.usuarioGrupo.findFirst({
        where: {
          usuario_id: usuarioId,
          grupo_id: preferencia.valor,
          ativo: true,
          grupo: {
            ativo: true,
          },
        },
        select: { grupo_id: true },
      });

      if (vinculoPreferido) {
        return vinculoPreferido.grupo_id;
      }
    }

    const vinculo = await this.prisma.usuarioGrupo.findFirst({
      where: {
        usuario_id: usuarioId,
        ativo: true,
        grupo: {
          ativo: true,
        },
      },
      orderBy: [{ criadoEm: 'asc' }],
      select: { grupo_id: true },
    });

    return vinculo?.grupo_id || null;
  }

  private async usuarioTemPermissaoNoProcesso(
    usuarioId: string,
    processoId: string,
    acao: 'visualizar' | 'modificar' | 'excluir',
  ): Promise<boolean> {
    const ehMasterGlobal = await this.usuarioEhMasterGlobal(usuarioId);

    if (ehMasterGlobal) {
      return true;
    }

    const grupoAtivoId = await this.obterGrupoAtivoId(usuarioId);

    if (!grupoAtivoId) {
      return false;
    }

    const processo = await this.prisma.processo.findUnique({
      where: { id: processoId },
      select: {
        usuario_atribuido_id: true,
        grupos: {
          where: { ativo: true },
          select: { grupo: { select: { id: true } } },
        },
      },
    });

    if (!processo) {
      return false;
    }

    const grupoIds = processo.grupos.map((item) => item.grupo.id);

    if (grupoIds.length === 0) {
      return false;
    }

    if (!grupoIds.includes(grupoAtivoId)) {
      return false;
    }

    const permissoes = await this.prisma.usuarioGrupoPermissao.findMany({
      where: {
        ativo: true,
        usuarioGrupo: {
          ativo: true,
          usuario_id: usuarioId,
          grupo_id: grupoAtivoId,
          grupo: {
            ativo: true,
          },
        },
      },
      select: {
        visualizar_grupo: true,
        visualizar_proprios: true,
        modificar_grupo: true,
        modificar_proprios: true,
        excluir: true,
      },
    });

    if (permissoes.length === 0) {
      return false;
    }

    const isProprio = processo.usuario_atribuido_id === usuarioId;

    if (acao === 'excluir') {
      return permissoes.some((item) => item.excluir);
    }

    if (acao === 'modificar') {
      return permissoes.some(
        (item) =>
          item.modificar_grupo || (item.modificar_proprios && isProprio),
      );
    }

    return permissoes.some(
      (item) =>
        item.visualizar_grupo || (item.visualizar_proprios && isProprio),
    );
  }

  private async garantirPermissaoProcesso(
    usuarioId: string,
    processoId: string,
    acao: 'visualizar' | 'modificar' | 'excluir',
  ) {
    const ehMasterGlobal = await this.usuarioEhMasterGlobal(usuarioId);

    if (ehMasterGlobal) {
      return;
    }

    const temVisualizacaoGabinete =
      await this.usuarioTemVisualizacaoGabinete(usuarioId);

    if (temVisualizacaoGabinete) {
      return;
    }

    const temPermissaoGrupo = await this.usuarioTemPermissaoNoProcesso(
      usuarioId,
      processoId,
      acao,
    );

    if (temPermissaoGrupo) {
      return;
    }

    throw new ForbiddenException(
      'Você não tem permissão de grupo para acessar este processo.',
    );
  }

  private async montarFiltrosVisibilidadeAndamentos(usuarioId?: string) {
    if (!usuarioId) {
      return { semAcesso: false, filtros: [] as any[] };
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        unidade_id: true,
        permissao: true,
      },
    });

    if (!usuario) {
      return { semAcesso: true, filtros: [] as any[] };
    }

    if (['DEV', 'ADM'].includes(usuario.permissao)) {
      return { semAcesso: false, filtros: [] as any[] };
    }

    const ehMasterGlobal = await this.usuarioEhMasterGlobal(usuarioId);

    if (ehMasterGlobal) {
      return { semAcesso: false, filtros: [] as any[] };
    }

    const grupoAtivoId = await this.obterGrupoAtivoId(usuarioId);

    if (!grupoAtivoId) {
      return { semAcesso: true, filtros: [] as any[] };
    }

    const temVisualizacaoGabinete =
      await this.usuarioTemVisualizacaoGabinete(usuarioId);

    if (temVisualizacaoGabinete) {
      return { semAcesso: false, filtros: [] as any[] };
    }

    const permissoesGrupo = await this.prisma.usuarioGrupoPermissao.findMany({
      where: {
        ativo: true,
        OR: [{ visualizar_grupo: true }, { visualizar_proprios: true }],
        usuarioGrupo: {
          ativo: true,
          usuario_id: usuarioId,
          grupo_id: grupoAtivoId,
          grupo: {
            ativo: true,
          },
        },
      },
      select: {
        visualizar_grupo: true,
        visualizar_proprios: true,
        usuarioGrupo: {
          select: {
            grupo_id: true,
          },
        },
      },
    });

    if (permissoesGrupo.length > 0) {
      const gruposComVisualizacao = Array.from(
        new Set(
          permissoesGrupo
            .filter((item) => item.visualizar_grupo)
            .map((item) => item.usuarioGrupo.grupo_id),
        ),
      );

      const podeVisualizarProprios = permissoesGrupo.some(
        (item) => item.visualizar_proprios,
      );

      const filtrosGrupo: any[] = [];

      if (gruposComVisualizacao.length > 0) {
        filtrosGrupo.push({
          processo: {
            grupos: {
              some: {
                ativo: true,
                grupo_id: {
                  in: gruposComVisualizacao,
                },
              },
            },
          },
        });
      }

      if (podeVisualizarProprios) {
        filtrosGrupo.push({
          AND: [
            { processo: { usuario_atribuido_id: usuarioId } },
            {
              processo: {
                grupos: {
                  some: {
                    ativo: true,
                    grupo_id: grupoAtivoId,
                  },
                },
              },
            },
          ],
        });
      }

      if (filtrosGrupo.length === 0) {
        return { semAcesso: true, filtros: [] as any[] };
      }

      return { semAcesso: false, filtros: [{ OR: filtrosGrupo }] };
    }

    return { semAcesso: true, filtros: [] as any[] };
  }

  /**
   * Cria um novo andamento (envia processo de uma unidade para outra)
   *
   * @param createAndamentoDto - Dados do andamento
   * @param usuario_id - ID do usuário que está criando o andamento
   * @returns Andamento criado
   */
  async criar(
    createAndamentoDto: CreateAndamentoDto,
    usuario_id: string,
  ): Promise<AndamentoResponseDto> {
    // Verifica se o processo existe
    const processo = await this.prisma.processo.findUnique({
      where: { id: createAndamentoDto.processo_id },
    });

    if (!processo) {
      throw new NotFoundException('Processo não encontrado.');
    }

    // Verifica se o usuário existe
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuario_id },
    });

    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    // Converte a string de data para Date
    const prazo = createAndamentoDto.prazo
      ? new Date(createAndamentoDto.prazo)
      : null;
    const data_envio = createAndamentoDto.data_envio
      ? new Date(createAndamentoDto.data_envio)
      : null;

    // Cria o andamento
    const andamento: andamento = await this.prisma.andamento.create({
      data: {
        processo_id: createAndamentoDto.processo_id,
        origem: createAndamentoDto.origem,
        destino: createAndamentoDto.destino,
        data_envio: data_envio,
        prazo: prazo,
        status:
          createAndamentoDto.status || $Enums.StatusAndamento.EM_ANDAMENTO,
        observacao: createAndamentoDto.observacao,
        assunto: createAndamentoDto.assunto,
        usuario_id: usuario_id,
      },
      include: {
        processo: true,
        usuario: true,
        usuarioProrrogacao: true,
      },
    });

    if (!andamento) {
      throw new InternalServerErrorException(
        'Não foi possível criar o andamento.',
      );
    }

    // Registra log
    await this.logsService.criar(
      $Enums.TipoAcao.ANDAMENTO_CRIADO,
      `Andamento criado: ${andamento.origem} → ${andamento.destino}${andamento.prazo ? ` (Prazo: ${new Date(andamento.prazo).toLocaleDateString('pt-BR')})` : ''}`,
      'andamento',
      andamento.id,
      usuario_id,
      null,
      {
        origem: andamento.origem,
        destino: andamento.destino,
        prazo: andamento.prazo,
        processo_id: andamento.processo_id,
      },
    );

    return andamento;
  }

  /**
   * Busca todos os andamentos com paginação
   *
   * @param pagina - Número da página
   * @param limite - Itens por página
   * @param processo_id - Filtrar por processo (opcional)
   * @param status - Filtrar por status (opcional)
   * @returns Lista paginada de andamentos
   */
  async buscarTudo(
    pagina: number = 1,
    limite: number = 10,
    processo_id?: string,
    status?: string,
    usuario_id?: string,
  ): Promise<{
    total: number;
    pagina: number;
    limite: number;
    data: AndamentoResponseDto[];
  }> {
    [pagina, limite] = this.app.verificaPagina(pagina, limite);

    const visibilidade =
      await this.montarFiltrosVisibilidadeAndamentos(usuario_id);

    if (visibilidade.semAcesso) {
      return { total: 0, pagina: 0, limite: 0, data: [] };
    }

    const searchParams: any = {
      ativo: true,
      ...(visibilidade.filtros.length > 0
        ? { AND: [...visibilidade.filtros] }
        : {}),
      ...(processo_id && { processo_id }),
      ...(status &&
        status !== '' && { status: status as $Enums.StatusAndamento }),
    };

    const total: number = await this.prisma.andamento.count({
      where: searchParams,
    });

    if (total === 0) {
      return { total: 0, pagina: 0, limite: 0, data: [] };
    }

    [pagina, limite] = this.app.verificaLimite(pagina, limite, total);

    const andamentos: andamento[] = await this.prisma.andamento.findMany({
      where: searchParams,
      orderBy: { criadoEm: 'desc' },
      skip: (pagina - 1) * limite,
      take: limite,
      include: {
        processo: true,
        usuario: true,
        usuarioProrrogacao: true,
      },
    });

    return {
      total: +total,
      pagina: +pagina,
      limite: +limite,
      data: andamentos,
    };
  }

  /**
   * Busca andamentos de um processo específico
   *
   * @param processo_id - ID do processo
   * @returns Lista de andamentos do processo
   */
  async buscarPorProcesso(
    processo_id: string,
    usuario_id?: string,
  ): Promise<AndamentoResponseDto[]> {
    if (!processo_id || processo_id === '') {
      throw new BadRequestException('ID do processo é obrigatório.');
    }

    const processo = await this.prisma.processo.findUnique({
      where: { id: processo_id },
    });

    if (!processo) {
      throw new NotFoundException('Processo não encontrado.');
    }

    if (usuario_id) {
      await this.garantirPermissaoProcesso(
        usuario_id,
        processo_id,
        'visualizar',
      );
    }

    const andamentos = await this.prisma.andamento.findMany({
      where: {
        processo_id,
        ativo: true, // Apenas andamentos ativos
      },
      orderBy: { criadoEm: 'desc' },
      include: {
        processo: true,
        usuario: true,
        usuarioProrrogacao: true,
      },
    });

    return andamentos;
  }

  /**
   * Busca um andamento por ID
   *
   * @param id - ID do andamento
   * @returns Andamento encontrado
   */
  async buscarPorId(
    id: string,
    usuario_id?: string,
  ): Promise<AndamentoResponseDto> {
    if (!id || id === '') {
      throw new BadRequestException('ID do andamento é obrigatório.');
    }

    const andamento = await this.prisma.andamento.findUnique({
      where: { id },
      include: {
        processo: true,
        usuario: true,
        usuarioProrrogacao: true,
      },
    });

    if (!andamento || !andamento.ativo) {
      throw new NotFoundException(`Andamento não encontrado ou inativo: ${id}`);
    }

    if (usuario_id) {
      await this.garantirPermissaoProcesso(
        usuario_id,
        andamento.processo_id,
        'visualizar',
      );
    }

    return andamento;
  }

  /**
   * Atualiza um andamento
   * Permite atualizar status, prorrogação, conclusão e observações
   *
   * @param id - ID do andamento
   * @param updateAndamentoDto - Dados a serem atualizados
   * @param usuario_id - ID do usuário que está atualizando o andamento
   * @returns Andamento atualizado
   */
  async atualizar(
    id: string,
    updateAndamentoDto: UpdateAndamentoDto,
    usuario_id: string,
  ): Promise<AndamentoResponseDto> {
    // Verifica se o andamento existe
    const andamentoAtual = await this.buscarPorId(id, usuario_id);
    await this.garantirPermissaoProcesso(
      usuario_id,
      andamentoAtual.processo_id,
      'modificar',
    );

    // Normaliza payloads inesperados do frontend:
    // - aceita campo `conclusao` como sinônimo de `resposta` (data)
    // - se `resposta` vier como texto não-ISO, tratamos como `observacao`
    const payload: any = updateAndamentoDto as any;
    if (payload.conclusao !== undefined && payload.conclusao !== null) {
      payload.resposta = payload.conclusao;
    }
    if (payload.resposta !== undefined && payload.resposta !== null) {
      const possibleDate = new Date(payload.resposta as any);
      if (isNaN(possibleDate.getTime())) {
        // Trata `resposta` textual como observação (se não houver observacao explicita)
        if (!payload.observacao) {
          payload.observacao = payload.resposta;
        }
        delete payload.resposta;
      }
    }

    // Prepara os dados para atualização
    const data: any = {};

    if (updateAndamentoDto.origem) data.origem = updateAndamentoDto.origem;
    if (updateAndamentoDto.destino) data.destino = updateAndamentoDto.destino;
    if (updateAndamentoDto.data_envio !== undefined) {
      data.data_envio = updateAndamentoDto.data_envio
        ? new Date(updateAndamentoDto.data_envio)
        : null;
    }
    if (updateAndamentoDto.prazo)
      data.prazo = new Date(updateAndamentoDto.prazo);
    // Status não pode ser atualizado manualmente - é definido automaticamente pelas etapas
    if (updateAndamentoDto.observacao !== undefined)
      data.observacao = updateAndamentoDto.observacao;
    if (updateAndamentoDto.assunto !== undefined)
      data.assunto = updateAndamentoDto.assunto;

    // Trata prorrogação - aceita null para limpar o campo
    if (updateAndamentoDto.prorrogacao !== undefined) {
      if (updateAndamentoDto.prorrogacao === null) {
        data.prorrogacao = null;
        data.usuario_prorrogacao_id = null; // Remove o usuário que prorrogou
        // Se a prorrogação foi removida e não há resposta, volta para EM_ANDAMENTO
        if (!updateAndamentoDto.resposta) {
          data.status = $Enums.StatusAndamento.EM_ANDAMENTO;
        }
      } else {
        data.prorrogacao = new Date(updateAndamentoDto.prorrogacao);
        data.usuario_prorrogacao_id = usuario_id; // Registra quem prorrogou
        // Só atualiza status para PRORROGADO se não houver resposta
        if (!updateAndamentoDto.resposta) {
          data.status = $Enums.StatusAndamento.PRORROGADO;
        }
      }
    }

    // Trata resposta - aceita null para limpar o campo
    if (updateAndamentoDto.resposta !== undefined) {
      if (updateAndamentoDto.resposta === null) {
        data.resposta = null;
        // Se a resposta foi removida e não há prorrogação, volta para EM_ANDAMENTO
        if (!updateAndamentoDto.prorrogacao) {
          data.status = $Enums.StatusAndamento.EM_ANDAMENTO;
        }
      } else {
        // Valida que a resposta é uma data válida
        const parsedResposta = new Date(updateAndamentoDto.resposta);
        if (isNaN(parsedResposta.getTime())) {
          throw new BadRequestException(
            'Campo `resposta` deve ser uma data válida em formato ISO 8601.',
          );
        }
        data.resposta = parsedResposta;
        // Resposta tem prioridade sobre prorrogação
        data.status = $Enums.StatusAndamento.CONCLUIDO;
      }
    }

    // Busca dados antigos para log
    const andamentoAntigo = await this.prisma.andamento.findUnique({
      where: { id },
    });

    // Se for uma resposta (conclusão), atualizamos o andamento e, se necessário,
    // também atualizamos o processo relacionado dentro de uma transação para
    // garantir atomicidade e evitar estados parciais.
    let andamentoAtualizado;
    let processoAtualizado: any = null;
    let processoPreUpdate: any = null;

    const isRespostaSet =
      updateAndamentoDto.resposta !== undefined &&
      updateAndamentoDto.resposta !== null;

    if (isRespostaSet) {
      // Converte a data para Date (já preparado em `data` acima)
      const respostaDate = data.resposta as Date;

      // Busca processo atual para decidir se precisamos atualizá-lo
      processoPreUpdate = await this.prisma.processo.findUnique({
        where: { id: andamentoAntigo.processo_id },
        select: { data_resposta_final: true, resposta_final: true },
      });

      // Prepara atualização do processo somente se necessário (não sobrescrever dados existentes)
      const processoUpdateData: any = {};
      if (!processoPreUpdate.data_resposta_final) {
        processoUpdateData.data_resposta_final = respostaDate;
      }
      // Use a observação enviada no update como possível texto da resposta final
      if (!processoPreUpdate.resposta_final && updateAndamentoDto.observacao) {
        processoUpdateData.resposta_final = updateAndamentoDto.observacao;
      }
      // Define unidade_respondida_id como a unidade destino do andamento (quem respondeu)
      if (Object.keys(processoUpdateData).length > 0) {
        processoUpdateData.unidade_respondida_id = andamentoAntigo.destino;
      }

      // Monta operações da transação: atualiza andamento sempre, atualiza processo se necessário
      const ops: any[] = [
        this.prisma.andamento.update({
          where: { id },
          data,
          include: {
            processo: true,
            usuario: true,
            usuarioProrrogacao: true,
          },
        }),
      ];

      if (Object.keys(processoUpdateData).length > 0) {
        ops.push(
          this.prisma.processo.update({
            where: { id: andamentoAntigo.processo_id },
            data: processoUpdateData,
            include: {
              andamentos: false,
            },
          }),
        );
      }

      const results = await this.prisma.$transaction(ops);
      andamentoAtualizado = results[0];
      if (results.length > 1) processoAtualizado = results[1];
    } else {
      // Atualização padrão quando não é resposta
      andamentoAtualizado = await this.prisma.andamento.update({
        where: { id },
        data,
        include: {
          processo: true,
          usuario: true,
          usuarioProrrogacao: true,
        },
      });
    }

    // Determina o tipo de ação para o log
    let tipoAcao: $Enums.TipoAcao = $Enums.TipoAcao.ANDAMENTO_ATUALIZADO;
    let descricao = `Andamento atualizado: ${andamentoAtualizado.origem} → ${andamentoAtualizado.destino}`;

    if (
      updateAndamentoDto.prorrogacao !== undefined &&
      updateAndamentoDto.prorrogacao !== null
    ) {
      tipoAcao = $Enums.TipoAcao.ANDAMENTO_PRORROGADO;
      descricao = `Andamento prorrogado: ${andamentoAtualizado.origem} → ${andamentoAtualizado.destino} (Nova data: ${new Date(andamentoAtualizado.prorrogacao).toLocaleDateString('pt-BR')})`;
    } else if (
      updateAndamentoDto.resposta !== undefined &&
      updateAndamentoDto.resposta !== null
    ) {
      tipoAcao = $Enums.TipoAcao.ANDAMENTO_CONCLUIDO;
      descricao = `Andamento concluído: ${andamentoAtualizado.origem} → ${andamentoAtualizado.destino}`;
    }

    // Registra log
    await this.logsService.criar(
      tipoAcao,
      descricao,
      'andamento',
      andamentoAtualizado.id,
      usuario_id,
      andamentoAntigo
        ? {
            origem: andamentoAntigo.origem,
            destino: andamentoAntigo.destino,
            prazo: andamentoAntigo.prazo,
            prorrogacao: andamentoAntigo.prorrogacao,
            resposta: andamentoAntigo.resposta,
            status: andamentoAntigo.status,
          }
        : null,
      {
        origem: andamentoAtualizado.origem,
        destino: andamentoAtualizado.destino,
        prazo: andamentoAtualizado.prazo,
        prorrogacao: andamentoAtualizado.prorrogacao,
        resposta: andamentoAtualizado.resposta,
        status: andamentoAtualizado.status,
      },
    );

    // Se atualizamos também o processo, registre log específico para o processo
    if (processoAtualizado) {
      await this.logsService.criar(
        $Enums.TipoAcao.PROCESSO_ATUALIZADO,
        `Processo atualizado por conclusão de andamento: ${processoAtualizado.numero_sei || processoAtualizado.id}`,
        'processo',
        processoAtualizado.id,
        usuario_id,
        processoPreUpdate
          ? {
              data_resposta_final: processoPreUpdate.data_resposta_final,
              resposta_final: processoPreUpdate.resposta_final,
            }
          : null,
        {
          data_resposta_final: processoAtualizado.data_resposta_final,
          resposta_final: processoAtualizado.resposta_final,
          unidade_respondida_id: processoAtualizado.unidade_respondida_id,
        },
      );
    }

    return andamentoAtualizado;
  }

  /**
   * Marca um andamento como concluído
   *
   * @param id - ID do andamento
   * @param usuario_id - ID do usuário que está concluindo o andamento
   * @returns Andamento atualizado
   */
  async concluir(
    id: string,
    usuario_id: string,
  ): Promise<AndamentoResponseDto> {
    const andamento = await this.buscarPorId(id, usuario_id);

    await this.garantirPermissaoProcesso(
      usuario_id,
      andamento.processo_id,
      'modificar',
    );

    if (andamento.status === $Enums.StatusAndamento.CONCLUIDO) {
      throw new BadRequestException('Andamento já está concluído.');
    }

    return this.atualizar(
      id,
      {
        resposta: new Date().toISOString(),
        status: $Enums.StatusAndamento.CONCLUIDO,
      },
      usuario_id,
    );
  }

  /**
   * Prorroga um andamento
   *
   * @param id - ID do andamento
   * @param novaDataLimite - Nova data limite
   * @param usuario_id - ID do usuário que está prorrogando o andamento
   * @returns Andamento atualizado
   */
  async prorrogar(
    id: string,
    novaDataLimite: string,
    usuario_id: string,
  ): Promise<AndamentoResponseDto> {
    const andamento = await this.buscarPorId(id, usuario_id);

    await this.garantirPermissaoProcesso(
      usuario_id,
      andamento.processo_id,
      'modificar',
    );

    const novaData = new Date(novaDataLimite);
    const dataAtual = new Date();

    if (novaData <= dataAtual) {
      throw new BadRequestException('A nova data limite deve ser futura.');
    }

    return this.atualizar(
      id,
      {
        prorrogacao: novaDataLimite,
        status: $Enums.StatusAndamento.PRORROGADO,
      },
      usuario_id,
    );
  }

  /**
   * Remove um andamento (soft delete - apenas marca como inativo)
   *
   * @param id - ID do andamento
   * @param usuario_id - ID do usuário que está removendo o andamento
   * @returns Confirmação de remoção
   */
  async remover(
    id: string,
    usuario_id: string,
  ): Promise<{ removido: boolean }> {
    const andamento = await this.buscarPorId(id, usuario_id);

    await this.garantirPermissaoProcesso(
      usuario_id,
      andamento.processo_id,
      'excluir',
    );

    // Remove o andamento (soft delete - marca como inativo)
    await this.prisma.andamento.update({
      where: { id },
      data: { ativo: false },
    });

    // Registra log
    await this.logsService.criar(
      $Enums.TipoAcao.ANDAMENTO_REMOVIDO,
      `Andamento removido: ${andamento.origem} → ${andamento.destino}`,
      'andamento',
      id,
      usuario_id,
      {
        origem: andamento.origem,
        destino: andamento.destino,
        prazo: andamento.prazo,
        processo_id: andamento.processo_id,
      },
      null,
    );

    return { removido: true };
  }

  /**
   * Realiza operações em lote em andamentos (excluir, prorrogar, concluir)
   *
   * @param batchAndamentoDto - Dados da operação em lote
   * @param usuario_id - ID do usuário que está realizando a operação
   * @returns Número de andamentos processados e lista de erros
   */
  async lote(
    batchAndamentoDto: BatchAndamentoDto,
    usuario_id: string,
  ): Promise<{ processados: number; erros: string[] }> {
    const ids = batchAndamentoDto.ids;
    const operacao = batchAndamentoDto.operacao;
    const novaDataLimite =
      batchAndamentoDto.novaDataLimite || batchAndamentoDto.prazo;

    const erros: string[] = [];
    let processados = 0;

    // Validação: ids deve ser um array não vazio
    if (!ids || !Array.isArray(ids)) {
      throw new BadRequestException(
        `Campo 'ids' deve ser um array. Recebido tipo: ${typeof ids}`,
      );
    }

    if (ids.length === 0) {
      throw new BadRequestException(
        'Array de IDs está vazio. Pelo menos um ID é necessário.',
      );
    }

    // Validação: operação deve ser válida
    if (!['excluir', 'prorrogar', 'concluir'].includes(operacao)) {
      throw new BadRequestException(
        `Operação inválida: ${operacao}. Use: excluir, prorrogar ou concluir.`,
      );
    }

    // 3. Validação: novaDataLimite é obrigatória para prorrogação
    if (operacao === 'prorrogar' && !novaDataLimite) {
      throw new BadRequestException(
        'Nova data limite é obrigatória para prorrogação.',
      );
    }

    // Regex para validar formato de UUID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Processa cada ID individualmente
    for (const id of ids) {
      // Valida se o ID tem formato de UUID válido
      if (!id || typeof id !== 'string') {
        erros.push(`ID inválido (não é string): ${JSON.stringify(id)}`);
        continue;
      }

      if (!uuidRegex.test(id)) {
        erros.push(`ID inválido (formato UUID incorreto): ${id}`);
        continue;
      }

      try {
        switch (operacao) {
          case 'excluir':
            await this.remover(id, usuario_id);
            break;
          case 'prorrogar':
            await this.prorrogar(id, novaDataLimite!, usuario_id);
            break;
          case 'concluir':
            await this.concluir(id, usuario_id);
            break;
          default:
            erros.push(`Operação inválida para ID ${id}: ${operacao}`);
            continue;
        }
        processados++;
      } catch (error) {
        erros.push(
          `Erro ao processar ID ${id} na operação ${operacao}: ${error.message}`,
        );
      }
    }

    return { processados, erros };
  }

  /**
   * Conta andamentos concluídos
   * @returns Número de andamentos concluídos
   */
  async contarConcluidos(usuario_id?: string): Promise<number> {
    const visibilidade =
      await this.montarFiltrosVisibilidadeAndamentos(usuario_id);

    if (visibilidade.semAcesso) {
      return 0;
    }

    return await this.prisma.andamento.count({
      where: {
        ...(visibilidade.filtros.length > 0
          ? { AND: [...visibilidade.filtros] }
          : {}),
        ativo: true,
        status: $Enums.StatusAndamento.CONCLUIDO,
      },
    });
  }

  /**
   * Conta andamentos vencidos
   * Vencidos = não concluídos com prazo passado
   * @returns Número de andamentos vencidos
   */
  async contarVencidos(usuario_id?: string): Promise<number> {
    const visibilidade =
      await this.montarFiltrosVisibilidadeAndamentos(usuario_id);

    if (visibilidade.semAcesso) {
      return 0;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    return await this.prisma.andamento.count({
      where: {
        ...(visibilidade.filtros.length > 0
          ? { AND: [...visibilidade.filtros] }
          : {}),
        ativo: true,
        status: { not: $Enums.StatusAndamento.CONCLUIDO },
        OR: [
          // Prazo original já venceu (sem prorrogação)
          {
            prazo: {
              lt: hoje,
            },
            prorrogacao: null,
          },
          // Prorrogação já venceu
          {
            prorrogacao: {
              lt: hoje,
            },
          },
        ],
      },
    });
  }

  /**
   * Conta andamentos vencendo hoje
   * Vencendo hoje = não concluídos com prazo hoje
   * @returns Número de andamentos vencendo hoje
   */
  async contarVencendoHoje(usuario_id?: string): Promise<number> {
    const visibilidade =
      await this.montarFiltrosVisibilidadeAndamentos(usuario_id);

    if (visibilidade.semAcesso) {
      return 0;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const fimDoDia = new Date(hoje);
    fimDoDia.setHours(23, 59, 59, 999);

    return await this.prisma.andamento.count({
      where: {
        ...(visibilidade.filtros.length > 0
          ? { AND: [...visibilidade.filtros] }
          : {}),
        ativo: true,
        status: { not: $Enums.StatusAndamento.CONCLUIDO },
        OR: [
          // Prazo original vencendo hoje (sem prorrogação)
          {
            prazo: {
              gte: hoje,
              lte: fimDoDia,
            },
            prorrogacao: null,
          },
          // Prorrogação vencendo hoje
          {
            prorrogacao: {
              gte: hoje,
              lte: fimDoDia,
            },
          },
        ],
      },
    });
  }

  /**
   * Conta andamentos em andamento
   * Em andamento = não concluídos com prazo futuro
   * @returns Número de andamentos em andamento
   */
  async contarEmAndamento(usuario_id?: string): Promise<number> {
    const visibilidade =
      await this.montarFiltrosVisibilidadeAndamentos(usuario_id);

    if (visibilidade.semAcesso) {
      return 0;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    return await this.prisma.andamento.count({
      where: {
        ...(visibilidade.filtros.length > 0
          ? { AND: [...visibilidade.filtros] }
          : {}),
        ativo: true,
        status: { not: $Enums.StatusAndamento.CONCLUIDO },
        OR: [
          // Prazo original no futuro (sem prorrogação)
          {
            prazo: {
              gte: hoje,
            },
            prorrogacao: null,
          },
          // Prorrogação no futuro
          {
            prorrogacao: {
              gte: hoje,
            },
          },
        ],
      },
    });
  }
}
