// ...existing code...
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProcessoDto } from './dto/create-processo.dto';
import { UpdateProcessoDto } from './dto/update-processo.dto';
import { CreateRespostaFinalDto } from './dto/create-resposta-final.dto';
import {
  ProcessoResponseDto,
  ProcessoPaginadoResponseDto,
} from './dto/processo-response.dto';
import { processo, andamento, $Enums, GrupoCodigo } from '@prisma/client';
import { AppService } from 'src/app.service';
import { LogsService } from 'src/logs/logs.service';

/**
 * Helper function to map Prisma processo to ProcessoResponseDto
 */
function mapProcessoToResponseDto(
  processo: processo & { andamentos?: andamento[] },
): ProcessoResponseDto {
  return {
    ...processo,
    data_prorrogacao: processo.prorrogacao,
  };
}

/**
 * Service - Camada de Lógica de Negócio
 *
 * O Service é responsável por:
 * 1. Implementar a lógica de negócio (regras de negócio)
 * 2. Interagir com o banco de dados através do PrismaService
 * 3. Validar dados antes de salvar
 * 4. Tratar erros e exceções
 * 5. Retornar dados formatados para o Controller
 *
 * O Service NÃO conhece HTTP, rotas ou requisições.
 * Ele apenas processa dados e retorna resultados.
 */
@Injectable()
export class ProcessosService {
  private readonly strictGroupMode = true;
  private readonly CHAVE_GRUPO_ATIVO = 'auth.grupo_ativo_id';
  private readonly CHAVE_ORDEM_COLUNAS_PROCESSOS =
    'grid.processos.colunas.ordem';
  private readonly COLUNAS_FIXAS_PROCESSOS = ['selecao', 'expansao'];
  private readonly COLUNAS_PADRAO_EXPEDIENTE = [
    'numero_sei',
    'assunto',
    'origem',
    'interessado',
    'unidade_remetente',
    'unidade_destino',
    'data_recebimento',
    'data_envio_unidade',
    'prazo',
    'prorrogacao',
    'data_resposta_final',
    'observacoes',
  ];
  private readonly COLUNAS_PADRAO_SERVIN = [
    'numero_sei',
    'assunto',
    'origem',
    'responsavel',
    'prazo',
    'observacoes',
  ];
  private readonly COLUNAS_PADRAO_GABINETE = [
    'numero_sei',
    'assunto',
    'origem',
    'interessado',
    'unidade_remetente',
    'unidade_destino',
    'responsavel',
    'data_recebimento',
    'data_envio_unidade',
    'prazo',
    'prorrogacao',
    'data_resposta_final',
    'observacoes',
  ];

  constructor(
    private prisma: PrismaService, // Injeção de dependência do Prisma
    private app: AppService, // Serviço auxiliar para paginação
    private logsService: LogsService, // Serviço de logs
  ) {}

  async obterPoliticaColunasProcessos(usuarioId: string) {
    const grupoAtivoId = await this.obterGrupoAtivoId(usuarioId);

    if (!grupoAtivoId) {
      throw new BadRequestException(
        'Usuario nao possui grupo ativo para carregar politica de colunas.',
      );
    }

    const vinculoAtivo = await this.prisma.usuarioGrupo.findFirst({
      where: {
        usuario_id: usuarioId,
        grupo_id: grupoAtivoId,
        ativo: true,
        grupo: {
          ativo: true,
        },
      },
      select: {
        grupo: {
          select: {
            id: true,
            codigo: true,
            nome: true,
          },
        },
      },
    });

    if (!vinculoAtivo) {
      throw new BadRequestException(
        'Vinculo ativo do grupo selecionado nao foi encontrado para o usuario.',
      );
    }

    const ordemPadrao = this.obterColunasPadraoPorGrupo(
      vinculoAtivo.grupo.codigo,
    );
    const chaveGrupo = `${this.CHAVE_ORDEM_COLUNAS_PROCESSOS}.${vinculoAtivo.grupo.codigo.toLowerCase()}`;

    const [preferenciaGrupo, preferenciaGlobal] = await Promise.all([
      this.prisma.preferenciasUsuario.findUnique({
        where: {
          usuario_id_chave: {
            usuario_id: usuarioId,
            chave: chaveGrupo,
          },
        },
        select: {
          valor: true,
          ativo: true,
        },
      }),
      this.prisma.preferenciasUsuario.findUnique({
        where: {
          usuario_id_chave: {
            usuario_id: usuarioId,
            chave: this.CHAVE_ORDEM_COLUNAS_PROCESSOS,
          },
        },
        select: {
          valor: true,
          ativo: true,
        },
      }),
    ]);

    const preferenciaValor =
      (preferenciaGrupo?.ativo && preferenciaGrupo.valor
        ? preferenciaGrupo.valor
        : null) ||
      (preferenciaGlobal?.ativo && preferenciaGlobal.valor
        ? preferenciaGlobal.valor
        : null);

    const ordemUsuario = this.parseOrdemColunasPreferida(preferenciaValor);
    const ordemEfetiva = this.montarOrdemEfetivaColunas(
      ordemPadrao,
      ordemUsuario,
    );

    return {
      grupoAtivo: vinculoAtivo.grupo,
      chavePreferenciaOrdem: chaveGrupo,
      colunasFixas: this.COLUNAS_FIXAS_PROCESSOS,
      colunasDisponiveis: ordemPadrao,
      ordemPadrao,
      ordemUsuario,
      ordemEfetiva,
    };
  }

  private obterColunasPadraoPorGrupo(codigoGrupo: GrupoCodigo): string[] {
    if (codigoGrupo === GrupoCodigo.SERVIN) {
      return [...this.COLUNAS_PADRAO_SERVIN];
    }

    if (codigoGrupo === GrupoCodigo.GABINETE) {
      return [...this.COLUNAS_PADRAO_GABINETE];
    }

    if (codigoGrupo === GrupoCodigo.GLOBAL) {
      return [...this.COLUNAS_PADRAO_GABINETE];
    }

    return [...this.COLUNAS_PADRAO_EXPEDIENTE];
  }

  private parseOrdemColunasPreferida(valor?: string | null): string[] {
    if (!valor) {
      return [];
    }

    try {
      const parsed = JSON.parse(valor);

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter((item) => typeof item === 'string');
    } catch {
      return valor
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }
  }

  private montarOrdemEfetivaColunas(
    ordemPadrao: string[],
    ordemUsuario: string[],
  ): string[] {
    const colunasPermitidas = new Set(ordemPadrao);
    const ordemUsuarioFiltrada = ordemUsuario.filter((item) =>
      colunasPermitidas.has(item),
    );
    const usadas = new Set(ordemUsuarioFiltrada);

    return [
      ...ordemUsuarioFiltrada,
      ...ordemPadrao.filter((item) => !usadas.has(item)),
    ];
  }

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

  private async vincularProcessoAoGrupoPrincipal(
    processoId: string,
    usuarioId: string,
  ) {
    const grupoAtivoId = await this.obterGrupoAtivoId(usuarioId);

    if (!grupoAtivoId) {
      throw new BadRequestException(
        'Usuario criador nao possui grupo ativo para vincular o processo.',
      );
    }

    await this.prisma.processoGrupo.upsert({
      where: {
        processo_id_grupo_id: {
          processo_id: processoId,
          grupo_id: grupoAtivoId,
        },
      },
      create: {
        processo_id: processoId,
        grupo_id: grupoAtivoId,
        nivelVisao: 'TOTAL',
        ativo: true,
      },
      update: {
        ativo: true,
      },
    });
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

  private async usuarioTemPermissaoGrupoNoProcesso(
    usuarioId: string,
    processo: {
      usuario_atribuido_id?: string | null;
      grupos?: { grupo: { id: string } }[];
    },
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

    const grupos = processo.grupos || [];

    if (grupos.length === 0) {
      return false;
    }

    const grupoIds = grupos.map((item) => item.grupo.id);

    if (!grupoIds.includes(grupoAtivoId)) {
      return false;
    }

    const permissoes = await this.prisma.usuarioGrupoPermissao.findMany({
      where: {
        ativo: true,
        usuarioGrupo: {
          ativo: true,
          usuario_id: usuarioId,
          grupo_id: {
            in: [grupoAtivoId],
          },
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

  private async montarFiltrosVisibilidadeConsulta(usuarioId?: string) {
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
          grupos: {
            some: {
              ativo: true,
              grupo_id: {
                in: gruposComVisualizacao,
              },
            },
          },
        });
      }

      if (podeVisualizarProprios) {
        filtrosGrupo.push({
          AND: [
            { usuario_atribuido_id: usuarioId },
            {
              grupos: {
                some: {
                  ativo: true,
                  grupo_id: grupoAtivoId,
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
   * Busca sugestões de unidade de origem para autocomplete
   * @param q termo digitado
   * @returns lista de strings
   */
  async autocompleteOrigens(q: string): Promise<string[]> {
    if (!q || q.trim() === '') return [];
    const results = await this.prisma.origemProcesso.findMany({
      where: {
        valor: {
          contains: q,
        },
      },
      orderBy: { valor: 'asc' },
      take: 10,
    });
    return results.map((o) => o.valor);
  }

  /**
   * Cria um novo processo
   *
   * @param createProcessoDto - Dados do processo a ser criado
   * @param usuario_id - ID do usuário que está criando o processo
   * @returns Processo criado
   */
  async criar(
    createProcessoDto: CreateProcessoDto,
    usuario_id: string,
  ): Promise<ProcessoResponseDto> {
    // Busca o usuário para obter unidade do cadastro
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuario_id },
      select: { unidade_id: true },
    });

    if (!usuario || !usuario.unidade_id) {
      throw new BadRequestException('Usuário não possui unidade atribuída.');
    }

    const usuarioAtribuidoId = usuario_id;

    if (
      createProcessoDto.usuario_atribuido_id &&
      createProcessoDto.usuario_atribuido_id !== usuario_id
    ) {
      throw new BadRequestException(
        'Owner do processo deve ser o usuario criador.',
      );
    }

    // Se numero_sei não foi fornecido, gera um temporário para permitir criação de rascunho
    let numeroSei = createProcessoDto.numero_sei;
    if (!numeroSei) {
      numeroSei = `DRAFT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Verifica se já existe um processo com o mesmo número SEI
    const processoExistente = await this.prisma.processo.findUnique({
      where: { numero_sei: numeroSei },
    });

    if (processoExistente) {
      throw new BadRequestException(
        'Já existe um processo com este número SEI.',
      );
    }

    // Verifica se o interessado_id existe (se fornecido)
    if (createProcessoDto.interessado_id) {
      const interessado = await this.prisma.interessado.findUnique({
        where: { id: createProcessoDto.interessado_id, ativo: true },
      });
      if (!interessado) {
        throw new BadRequestException('Interessado não encontrado.');
      }
    }

    // Verifica se o unidade_remetente_id existe (se fornecido)
    if (createProcessoDto.unidade_remetente_id) {
      const unidadeRemetente = await this.prisma.unidade.findUnique({
        where: { id: createProcessoDto.unidade_remetente_id },
      });
      if (!unidadeRemetente) {
        throw new BadRequestException('Unidade remetente não encontrada.');
      }
    }

    // Verifica se o unidade_destino_id existe (se fornecido)
    if (createProcessoDto.unidade_destino_id) {
      const unidadeDestino = await this.prisma.unidade.findUnique({
        where: { id: createProcessoDto.unidade_destino_id },
      });
      if (!unidadeDestino) {
        throw new BadRequestException('Unidade destinatária não encontrada.');
      }
    }

    // Salva a origem digitada em OrigemProcesso se não existir
    if (createProcessoDto.origem && createProcessoDto.origem.trim() !== '') {
      await this.prisma.origemProcesso.upsert({
        where: { valor: createProcessoDto.origem.trim() },
        update: {},
        create: { valor: createProcessoDto.origem.trim() },
      });
    }

    // Cria o processo no banco de dados
    const processo: processo = await this.prisma.processo.create({
      data: {
        numero_sei: numeroSei,
        assunto: createProcessoDto.assunto || 'Assunto a ser definido',
        origem: createProcessoDto.origem || 'EXPEDIENTE',
        interessado_id: createProcessoDto.interessado_id || null,
        unidade_remetente_id: createProcessoDto.unidade_remetente_id || null,
        unidade_destino_id: createProcessoDto.unidade_destino_id || null,
        data_recebimento: createProcessoDto.data_recebimento
          ? new Date(createProcessoDto.data_recebimento)
          : undefined,
        data_envio_unidade: createProcessoDto.data_envio_unidade
          ? new Date(createProcessoDto.data_envio_unidade)
          : undefined,
        prazo: createProcessoDto.prazo
          ? new Date(createProcessoDto.prazo)
          : undefined,
        prorrogacao: createProcessoDto.data_prorrogacao
          ? new Date(createProcessoDto.data_prorrogacao)
          : undefined,
        usuario_atribuido_id: usuarioAtribuidoId,
        unidade_id: usuario.unidade_id,
      },
    });

    if (!processo) {
      throw new InternalServerErrorException(
        'Não foi possível criar o processo.',
      );
    }

    await this.vincularProcessoAoGrupoPrincipal(processo.id, usuario_id);

    // Registra log
    await this.logsService.criar(
      $Enums.TipoAcao.PROCESSO_CRIADO,
      `Processo criado: ${processo.numero_sei} - ${processo.assunto}`,
      'processo',
      processo.id,
      usuario_id,
      null,
      { numero_sei: processo.numero_sei, assunto: processo.assunto },
    );

    return mapProcessoToResponseDto(processo);
  }

  async buscarTudo(
    pagina: number = 1,
    limite: number = 10,
    busca?: string,
    interessado?: string,
    unidadeRemetente?: string,
    unidadeDestino?: string,
    vencendoHoje: boolean = false,
    atrasados: boolean = false,
    concluidos: boolean = false,
    usuario_id?: string,
    unidade?: string,
  ): Promise<ProcessoPaginadoResponseDto> {
    // Valida e ajusta página e limite usando o AppService
    [pagina, limite] = this.app.verificaPagina(pagina, limite);

    const visibilidade =
      await this.montarFiltrosVisibilidadeConsulta(usuario_id);

    if (visibilidade.semAcesso) {
      return { total: 0, pagina: 0, limite: 0, data: [] };
    }

    // Calcula início e fim do dia atual (00:00:00 até 23:59:59)
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const fimDoDia = new Date(hoje);
    fimDoDia.setHours(23, 59, 59, 999);

    // Monta os filtros de busca
    const searchParams: any = {
      ativo: true, // Apenas processos ativos
      ...(visibilidade.filtros.length > 0
        ? { AND: [...visibilidade.filtros] }
        : {}),
    };

    // === ISSUE #17: BUSCA GERAL ===
    // Busca em todos os campos do processo e andamentos
    if (busca) {
      searchParams.OR = [
        { numero_sei: { contains: busca } },
        { assunto: { contains: busca } },
        { origem: { contains: busca } },
        { resposta_final: { contains: busca } },
        { unidade_respondida_id: { contains: busca } },
        // Busca nos campos do interessado
        {
          interessado: {
            valor: { contains: busca },
          },
        },
        // Busca nos campos da unidade remetente
        {
          unidadeRemetente: {
            OR: [{ nome: { contains: busca } }, { sigla: { contains: busca } }],
          },
        },
        // Busca nos campos da unidade destino
        {
          unidadeDestino: {
            OR: [{ nome: { contains: busca } }, { sigla: { contains: busca } }],
          },
        },
        // Busca nos campos dos andamentos
        {
          andamentos: {
            some: {
              ativo: true,
              OR: [
                { origem: { contains: busca } },
                { destino: { contains: busca } },
                { observacao: { contains: busca } },
              ],
            },
          },
        },
      ];
    }

    // Filtro específico por interessado
    if (interessado) {
      searchParams.interessado = {
        valor: { contains: interessado },
      };
    }

    // Filtro específico por unidade remetente
    if (unidadeRemetente) {
      searchParams.unidadeRemetente = {
        OR: [
          { nome: { contains: unidadeRemetente } },
          { sigla: { contains: unidadeRemetente } },
        ],
      };
    }

    // Filtro específico por unidade destino
    if (unidadeDestino) {
      searchParams.unidadeDestino = {
        OR: [
          { nome: { contains: unidadeDestino } },
          { sigla: { contains: unidadeDestino } },
        ],
      };
    }

    // Filtro combinado por unidade (remetente OU destino)
    if (unidade) {
      const andAtual = Array.isArray(searchParams.AND)
        ? [...searchParams.AND]
        : searchParams.AND
          ? [searchParams.AND]
          : [];
      searchParams.AND = [
        ...andAtual,
        {
          OR: [
            {
              unidadeRemetente: {
                OR: [
                  { nome: { contains: unidade } },
                  { sigla: { contains: unidade } },
                ],
              },
            },
            {
              unidadeDestino: {
                OR: [
                  { nome: { contains: unidade } },
                  { sigla: { contains: unidade } },
                ],
              },
            },
          ],
        },
      ];
    }

    // === ISSUE #24: FILTROS RÁPIDOS ===
    // Se pelo menos um filtro de prazo/status estiver ativo
    if (vencendoHoje || atrasados || concluidos) {
      const filtrosStatus: any[] = [];

      // Filtro: Vencendo Hoje
      if (vencendoHoje) {
        filtrosStatus.push({
          andamentos: {
            some: {
              ativo: true,
              status: {
                in: [
                  $Enums.StatusAndamento.EM_ANDAMENTO,
                  $Enums.StatusAndamento.PRORROGADO,
                ],
              },
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
          },
          // Garante que não há andamentos mais recentes concluídos
          AND: {
            andamentos: {
              none: {
                ativo: true,
                status: $Enums.StatusAndamento.CONCLUIDO,
              },
            },
          },
        });
      }

      // Filtro: Atrasados
      if (atrasados) {
        filtrosStatus.push({
          andamentos: {
            some: {
              ativo: true,
              status: {
                in: [
                  $Enums.StatusAndamento.EM_ANDAMENTO,
                  $Enums.StatusAndamento.PRORROGADO,
                ],
              },
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
          },
          // Garante que não há andamentos mais recentes concluídos
          AND: {
            andamentos: {
              none: {
                ativo: true,
                status: $Enums.StatusAndamento.CONCLUIDO,
              },
            },
          },
        });
      }

      // Filtro: Concluídos
      if (concluidos) {
        filtrosStatus.push({
          AND: [
            {
              andamentos: {
                some: {
                  ativo: true,
                  status: $Enums.StatusAndamento.CONCLUIDO,
                },
              },
            },
            {
              andamentos: {
                none: {
                  ativo: true,
                  status: { not: $Enums.StatusAndamento.CONCLUIDO },
                },
              },
            },
          ],
        });
      }

      // Adiciona os filtros de status
      if (filtrosStatus.length > 0) {
        const andAtual = [...(searchParams.AND || [])];

        // Se já existe um OR (da busca geral), combina com AND
        if (searchParams.OR) {
          searchParams.AND = [
            ...andAtual,
            { OR: searchParams.OR },
            { OR: filtrosStatus },
          ];
          delete searchParams.OR;
        } else {
          // Se não tem busca geral, usa OR direto para os filtros
          searchParams.AND = [...andAtual, { OR: filtrosStatus }];
        }
      }
    }

    // Conta o total de processos que atendem aos filtros
    const total: number = await this.prisma.processo.count({
      where: searchParams,
    });

    if (total === 0) {
      return { total: 0, pagina: 0, limite: 0, data: [] };
    }

    // Ajusta página e limite baseado no total
    [pagina, limite] = this.app.verificaLimite(pagina, limite, total);

    // Busca os processos com paginação
    const processos: processo[] = await this.prisma.processo.findMany({
      where: searchParams,
      orderBy: { criadoEm: 'desc' }, // Mais recentes primeiro
      skip: (pagina - 1) * limite, // Pula os registros das páginas anteriores
      take: limite, // Limita a quantidade de resultados
      include: {
        interessado: true, // Inclui dados do interessado
        unidadeRemetente: true, // Inclui dados da unidade remetente
        unidadeDestino: true, // Inclui dados da unidade destino
        andamentos: {
          where: { ativo: true }, // Apenas andamentos ativos
          orderBy: { criadoEm: 'desc' }, // Andamentos mais recentes primeiro
          include: {
            usuario: {
              select: {
                id: true,
                nome: true,
                nomeSocial: true,
                login: true,
                email: true,
              },
            },
            usuarioProrrogacao: {
              select: {
                id: true,
                nome: true,
                nomeSocial: true,
                login: true,
                email: true,
              },
            },
          },
        },
        grupos: {
          where: { ativo: true },
          select: {
            grupo: {
              select: {
                id: true,
                codigo: true,
                nome: true,
              },
            },
          },
        },
      },
    });

    return {
      total: +total,
      pagina: +pagina,
      limite: +limite,
      data: processos.map(mapProcessoToResponseDto),
    };
  }

  /**
   * Busca um processo por ID
   *
   * @param id - ID do processo
   * @param usuario_id - ID do usuário que está buscando (para verificar permissão de acesso)
   * @returns Processo encontrado
   */
  async buscarPorId(
    id: string,
    usuario_id?: string,
  ): Promise<ProcessoResponseDto> {
    if (!id || id === '') {
      throw new BadRequestException('ID do processo é obrigatório.');
    }

    const processo = await this.prisma.processo.findUnique({
      where: { id },
      include: {
        interessado: true, // Inclui dados do interessado
        unidadeRemetente: true, // Inclui dados da unidade remetente
        unidadeDestino: true, // Inclui dados da unidade destino
        andamentos: {
          where: { ativo: true }, // Apenas andamentos ativos
          orderBy: { criadoEm: 'desc' },
          include: {
            usuario: {
              select: {
                id: true,
                nome: true,
                nomeSocial: true,
                login: true,
                email: true,
              },
            },
            usuarioProrrogacao: {
              select: {
                id: true,
                nome: true,
                nomeSocial: true,
                login: true,
                email: true,
              },
            },
          },
        },
        grupos: {
          where: { ativo: true },
          select: {
            grupo: {
              select: {
                id: true,
                codigo: true,
                nome: true,
              },
            },
          },
        },
      },
    });

    if (!processo || !processo.ativo) {
      throw new NotFoundException('Processo não encontrado.');
    }

    // Verifica se o usuário tem permissão para ver este processo
    if (usuario_id) {
      const ehMasterGlobal = await this.usuarioEhMasterGlobal(usuario_id);
      const temVisualizacaoGabinete =
        await this.usuarioTemVisualizacaoGabinete(usuario_id);

      const usuario = await this.prisma.usuario.findUnique({
        where: { id: usuario_id },
        select: {
          unidade_id: true,
          permissao: true,
        },
      });

      if (
        usuario &&
        !['DEV'].includes(usuario.permissao) &&
        !ehMasterGlobal &&
        !temVisualizacaoGabinete
      ) {
        const temPermissaoGrupo = await this.usuarioTemPermissaoGrupoNoProcesso(
          usuario_id,
          processo,
          'visualizar',
        );

        if (!temPermissaoGrupo) {
          throw new ForbiddenException(
            'Você não tem permissão de grupo para acessar este processo.',
          );
        }
      }
    }

    return mapProcessoToResponseDto(processo);
  }

  /**
   * Busca um processo por número SEI
   *
   * @param numero_sei - Número SEI do processo
   * @param usuario_id - ID do usuário que está buscando (para verificar permissão de acesso)
   * @returns Processo encontrado
   */
  async buscarPorNumeroSei(
    numero_sei: string,
    usuario_id?: string,
  ): Promise<ProcessoResponseDto> {
    if (!numero_sei || numero_sei === '') {
      throw new BadRequestException('Número SEI é obrigatório.');
    }

    const processo = await this.prisma.processo.findUnique({
      where: { numero_sei },
      include: {
        interessado: true, // Inclui dados do interessado
        unidadeRemetente: true, // Inclui dados da unidade remetente
        unidadeDestino: true, // Inclui dados da unidade destino
        andamentos: {
          where: { ativo: true }, // Apenas andamentos ativos
          orderBy: { criadoEm: 'desc' },
          include: {
            usuario: {
              select: {
                id: true,
                nome: true,
                nomeSocial: true,
                login: true,
                email: true,
              },
            },
            usuarioProrrogacao: {
              select: {
                id: true,
                nome: true,
                nomeSocial: true,
                login: true,
                email: true,
              },
            },
          },
        },
        grupos: {
          where: { ativo: true },
          select: {
            grupo: {
              select: {
                id: true,
                codigo: true,
                nome: true,
              },
            },
          },
        },
      },
    });

    if (!processo || !processo.ativo) {
      throw new NotFoundException('Processo não encontrado.');
    }

    // Verifica se o usuário tem permissão para ver este processo
    if (usuario_id) {
      const ehMasterGlobal = await this.usuarioEhMasterGlobal(usuario_id);
      const temVisualizacaoGabinete =
        await this.usuarioTemVisualizacaoGabinete(usuario_id);

      const usuario = await this.prisma.usuario.findUnique({
        where: { id: usuario_id },
        select: {
          unidade_id: true,
          permissao: true,
        },
      });

      if (
        usuario &&
        !['DEV'].includes(usuario.permissao) &&
        !ehMasterGlobal &&
        !temVisualizacaoGabinete
      ) {
        const temPermissaoGrupo = await this.usuarioTemPermissaoGrupoNoProcesso(
          usuario_id,
          processo,
          'visualizar',
        );

        if (!temPermissaoGrupo) {
          throw new ForbiddenException(
            'Você não tem permissão de grupo para acessar este processo.',
          );
        }
      }
    }

    return mapProcessoToResponseDto(processo);
  }

  /**
   * Atualiza um processo
   *
   * @param id - ID do processo a ser atualizado
   * @param updateProcessoDto - Dados a serem atualizados
   * @param usuario_id - ID do usuário que está atualizando o processo
   * @returns Processo atualizado
   */
  async atualizar(
    id: string,
    updateProcessoDto: UpdateProcessoDto,
    usuario_id: string,
  ): Promise<ProcessoResponseDto> {
    // Verifica se o processo existe e se o usuário tem permissão
    const processoExistente = await this.buscarPorId(id, usuario_id);

    const usuarioAtual = await this.prisma.usuario.findUnique({
      where: { id: usuario_id },
      select: {
        permissao: true,
      },
    });

    const processoPermissao = await this.prisma.processo.findUnique({
      where: { id },
      select: {
        usuario_atribuido_id: true,
        grupos: {
          where: { ativo: true },
          select: { grupo: { select: { id: true } } },
        },
      },
    });

    const temPermissaoGrupoModificar =
      processoPermissao && usuarioAtual
        ? await this.usuarioTemPermissaoGrupoNoProcesso(
            usuario_id,
            processoPermissao,
            'modificar',
          )
        : false;

    const ehMasterGlobal = await this.usuarioEhMasterGlobal(usuario_id);

    if (
      usuarioAtual &&
      !['DEV', 'ADM'].includes(usuarioAtual.permissao) &&
      !ehMasterGlobal &&
      !temPermissaoGrupoModificar
    ) {
      throw new ForbiddenException(
        'Você não tem permissão de grupo para editar este processo.',
      );
    }

    // Se está tentando atualizar o número SEI, verifica se não existe outro com o mesmo número
    if (
      updateProcessoDto.numero_sei &&
      updateProcessoDto.numero_sei !== processoExistente.numero_sei
    ) {
      const processoComMesmoSei = await this.prisma.processo.findUnique({
        where: { numero_sei: updateProcessoDto.numero_sei },
      });

      if (processoComMesmoSei) {
        throw new BadRequestException(
          'Já existe outro processo com este número SEI.',
        );
      }
    }

    // Processa campos alternativos para interessado e unidade remetente
    let interessadoId: string | null = null;
    let unidadeRemetenteId: string | null = null;
    let unidadeDestinoId: string | null = null;

    // Se recebeu interessado_id diretamente, valida se existe
    if (updateProcessoDto.interessado_id) {
      const interessadoExistente = await this.prisma.interessado.findUnique({
        where: { id: updateProcessoDto.interessado_id, ativo: true },
      });
      if (!interessadoExistente) {
        throw new BadRequestException('Interessado não encontrado.');
      }
      interessadoId = updateProcessoDto.interessado_id;
    }

    // Se recebeu interessado como string, busca ou cria o interessado
    if (
      updateProcessoDto.interessado &&
      typeof updateProcessoDto.interessado === 'string' &&
      updateProcessoDto.interessado.trim() !== ''
    ) {
      try {
        // Primeiro tenta encontrar
        let interessado = await this.prisma.interessado.findFirst({
          where: { valor: updateProcessoDto.interessado.trim(), ativo: true },
        });

        // Se não encontrou, cria
        if (!interessado) {
          interessado = await this.prisma.interessado.create({
            data: { valor: updateProcessoDto.interessado.trim() },
          });
        }

        interessadoId = interessado.id;
      } catch (error) {
        throw new BadRequestException('Erro ao processar interessado.');
      }
    }

    // Se recebeu unidade_remetente_id diretamente, valida se existe
    if (updateProcessoDto.unidade_remetente_id) {
      const unidadeExistente = await this.prisma.unidade.findUnique({
        where: { id: updateProcessoDto.unidade_remetente_id },
      });
      if (!unidadeExistente) {
        throw new BadRequestException('Unidade remetente não encontrada.');
      }
      unidadeRemetenteId = updateProcessoDto.unidade_remetente_id;
    }

    // Se recebeu unidade_remetente como string, busca a unidade
    if (
      updateProcessoDto.unidade_remetente &&
      typeof updateProcessoDto.unidade_remetente === 'string' &&
      updateProcessoDto.unidade_remetente.trim() !== ''
    ) {
      const unidade = await this.prisma.unidade.findFirst({
        where: {
          OR: [
            { nome: updateProcessoDto.unidade_remetente.trim() },
            { sigla: updateProcessoDto.unidade_remetente.trim() },
          ],
          ativo: true,
        },
      });
      if (unidade) {
        unidadeRemetenteId = unidade.id;
      } else {
        throw new BadRequestException(
          `Unidade remetente "${updateProcessoDto.unidade_remetente}" não encontrada.`,
        );
      }
    }

    // Se recebeu unidade_destino_id diretamente, valida se existe
    if (updateProcessoDto.unidade_destino_id) {
      const unidadeExistente = await this.prisma.unidade.findUnique({
        where: { id: updateProcessoDto.unidade_destino_id },
      });
      if (!unidadeExistente) {
        throw new BadRequestException('Unidade destinatária não encontrada.');
      }
      unidadeDestinoId = updateProcessoDto.unidade_destino_id;
    }

    // Se recebeu unidade_destino como string, busca a unidade
    if (
      updateProcessoDto.unidade_destino &&
      typeof updateProcessoDto.unidade_destino === 'string' &&
      updateProcessoDto.unidade_destino.trim() !== ''
    ) {
      const unidade = await this.prisma.unidade.findFirst({
        where: {
          OR: [
            { nome: updateProcessoDto.unidade_destino.trim() },
            { sigla: updateProcessoDto.unidade_destino.trim() },
          ],
          ativo: true,
        },
      });
      if (unidade) {
        unidadeDestinoId = unidade.id;
      } else {
        throw new BadRequestException(
          `Unidade destinatária "${updateProcessoDto.unidade_destino}" não encontrada.`,
        );
      }
    }

    // Prepara os dados para atualização
    const dadosAtualizacao: any = {
      numero_sei: updateProcessoDto.numero_sei,
      assunto: updateProcessoDto.assunto,
      origem: updateProcessoDto.origem,
      data_recebimento: updateProcessoDto.data_recebimento
        ? new Date(updateProcessoDto.data_recebimento)
        : undefined,
      data_envio_unidade: updateProcessoDto.data_envio_unidade
        ? new Date(updateProcessoDto.data_envio_unidade)
        : undefined,
      prazo: updateProcessoDto.prazo
        ? new Date(updateProcessoDto.prazo)
        : undefined,
      prorrogacao: updateProcessoDto.data_prorrogacao
        ? new Date(updateProcessoDto.data_prorrogacao)
        : undefined,
      resposta_final: updateProcessoDto.resposta_final,
      data_resposta_final: updateProcessoDto.data_resposta_final
        ? new Date(updateProcessoDto.data_resposta_final)
        : undefined,
    };

    // Só adiciona os campos de relacionamento se eles tiverem valores
    if (interessadoId !== null && interessadoId !== undefined) {
      dadosAtualizacao.interessado_id = interessadoId;
    }

    if (unidadeRemetenteId !== null && unidadeRemetenteId !== undefined) {
      dadosAtualizacao.unidade_remetente_id = unidadeRemetenteId;
    }

    if (unidadeDestinoId !== null && unidadeDestinoId !== undefined) {
      dadosAtualizacao.unidade_destino_id = unidadeDestinoId;
    }

    if (updateProcessoDto.usuario_atribuido_id !== undefined) {
      if (updateProcessoDto.usuario_atribuido_id) {
        const usuarioAtribuido = await this.prisma.usuario.findUnique({
          where: { id: updateProcessoDto.usuario_atribuido_id },
          select: { id: true, status: true },
        });

        if (!usuarioAtribuido || !usuarioAtribuido.status) {
          throw new BadRequestException(
            'Usuário atribuído inválido ou inativo.',
          );
        }
      }

      dadosAtualizacao.usuario_atribuido_id =
        updateProcessoDto.usuario_atribuido_id || null;
    }

    // Atualiza o processo
    const processoAtualizado = await this.prisma.processo.update({
      where: { id },
      data: dadosAtualizacao,
      include: {
        andamentos: {
          where: { ativo: true }, // Apenas andamentos ativos
          orderBy: { criadoEm: 'desc' },
          include: {
            usuario: {
              select: {
                id: true,
                nome: true,
                nomeSocial: true,
                login: true,
                email: true,
              },
            },
            usuarioProrrogacao: {
              select: {
                id: true,
                nome: true,
                nomeSocial: true,
                login: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // Registra log
    await this.logsService.criar(
      $Enums.TipoAcao.PROCESSO_ATUALIZADO,
      `Processo atualizado: ${processoAtualizado.numero_sei} - ${processoAtualizado.assunto}`,
      'processo',
      processoAtualizado.id,
      usuario_id,
      {
        numero_sei: processoExistente.numero_sei,
        assunto: processoExistente.assunto,
      },
      {
        numero_sei: processoAtualizado.numero_sei,
        assunto: processoAtualizado.assunto,
      },
    );

    return mapProcessoToResponseDto(processoAtualizado);
  }

  /**
   * Cria resposta final para um processo
   *
   * @param createRespostaFinalDto - Dados da resposta final
   * @param usuario_id - ID do usuário que está criando a resposta
   * @returns Processo atualizado com resposta final
   */
  async criarRespostaFinal(
    createRespostaFinalDto: CreateRespostaFinalDto,
    usuario_id: string,
  ): Promise<ProcessoResponseDto> {
    const {
      processo_id,
      data_resposta_final,
      resposta_final,
      unidade_respondida_id,
    } = createRespostaFinalDto;

    // Verifica se o processo existe
    const processoExistente = await this.prisma.processo.findUnique({
      where: { id: processo_id },
      select: {
        id: true,
        origem: true,
        ativo: true,
        numero_sei: true,
        data_resposta_final: true,
        resposta_final: true,
        unidade_respondida_id: true,
        andamentos: {
          where: { ativo: true },
          select: { origem: true, destino: true },
        },
      },
    });

    if (!processoExistente) {
      throw new NotFoundException('Processo não encontrado.');
    }

    if (!processoExistente.ativo) {
      throw new BadRequestException('Processo está inativo.');
    }

    // Verifica se há andamentos cadastrados
    if (processoExistente.andamentos.length === 0) {
      throw new BadRequestException(
        'O processo deve ter pelo menos um andamento cadastrado antes de criar resposta final.',
      );
    }

    // Valida se a data não é futura
    const dataResposta = new Date(data_resposta_final);
    const hoje = new Date();
    hoje.setHours(23, 59, 59, 999); // Fim do dia atual

    if (dataResposta > hoje) {
      throw new BadRequestException(
        'A data de resposta final não pode ser futura.',
      );
    }

    // Sempre usa a origem do processo como unidade respondida (mais seguro)
    const unidadeRespondida = processoExistente.origem;

    // --- Idempotência: evita criar andamento duplicado se já existe conclusão igual ---
    // Se o processo já possui os mesmos campos de resposta, retorna o processo
    if (
      processoExistente.data_resposta_final &&
      processoExistente.resposta_final === resposta_final &&
      new Date(processoExistente.data_resposta_final).getTime() ===
        dataResposta.getTime()
    ) {
      const processoAtualizado = await this.prisma.processo.findUnique({
        where: { id: processo_id },
        include: {
          andamentos: {
            where: { ativo: true },
            orderBy: { criadoEm: 'desc' },
            include: {
              usuario: {
                select: {
                  id: true,
                  nome: true,
                  nomeSocial: true,
                  login: true,
                  email: true,
                },
              },
              usuarioProrrogacao: {
                select: {
                  id: true,
                  nome: true,
                  nomeSocial: true,
                  login: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      return mapProcessoToResponseDto(processoAtualizado);
    }

    // Se já existe um andamento CONCLUIDO com mesma observação e data_envio, não cria outro
    const conclusaoExistente = await this.prisma.andamento.findFirst({
      where: {
        processo_id,
        status: $Enums.StatusAndamento.CONCLUIDO,
        ativo: true,
        observacao: resposta_final,
        data_envio: dataResposta,
      },
    });

    if (conclusaoExistente) {
      // Garante que o processo tenha os campos de resposta preenchidos
      if (
        !processoExistente.data_resposta_final ||
        !processoExistente.resposta_final
      ) {
        await this.prisma.processo.update({
          where: { id: processo_id },
          data: {
            data_resposta_final: dataResposta,
            resposta_final,
            unidade_respondida_id: unidadeRespondida,
          },
        });
      }

      const processoAtualizado = await this.prisma.processo.findUnique({
        where: { id: processo_id },
        include: {
          andamentos: {
            where: { ativo: true },
            orderBy: { criadoEm: 'desc' },
            include: {
              usuario: {
                select: {
                  id: true,
                  nome: true,
                  nomeSocial: true,
                  login: true,
                  email: true,
                },
              },
              usuarioProrrogacao: {
                select: {
                  id: true,
                  nome: true,
                  nomeSocial: true,
                  login: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      return mapProcessoToResponseDto(processoAtualizado);
    }

    // Executa update do processo e criação do andamento em transação
    const [updatedProcesso] = await this.prisma.$transaction([
      this.prisma.processo.update({
        where: { id: processo_id },
        data: {
          data_resposta_final: dataResposta,
          resposta_final,
          unidade_respondida_id: unidadeRespondida, // Sempre usa processo.origem
        },
      }),
    ]);

    // Cria o andamento final ligado ao processo (marca conclusão)
    const andamentoCriado = await this.prisma.andamento.create({
      data: {
        processo_id: processo_id,
        origem: unidadeRespondida,
        destino: unidadeRespondida,
        data_envio: dataResposta,
        prazo: dataResposta,
        status: $Enums.StatusAndamento.CONCLUIDO,
        observacao: resposta_final,
        usuario_id: usuario_id,
      },
      include: {
        usuario: true,
      },
    });

    // Busca processo atualizado incluindo andamentos (para retorno)
    const processoAtualizado = await this.prisma.processo.findUnique({
      where: { id: processo_id },
      include: {
        andamentos: {
          where: { ativo: true },
          orderBy: { criadoEm: 'desc' },
          include: {
            usuario: {
              select: {
                id: true,
                nome: true,
                nomeSocial: true,
                login: true,
                email: true,
              },
            },
            usuarioProrrogacao: {
              select: {
                id: true,
                nome: true,
                nomeSocial: true,
                login: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // Registra log (agora com o andamento criado)
    await this.logsService.criar(
      $Enums.TipoAcao.PROCESSO_ATUALIZADO,
      `Resposta final criada para processo: ${updatedProcesso.numero_sei} - Unidade respondida: ${unidadeRespondida}`,
      'processo',
      updatedProcesso.id,
      usuario_id,
      {
        data_resposta_final: processoExistente.data_resposta_final,
        resposta_final: processoExistente.resposta_final,
        unidade_respondida_id: processoExistente.unidade_respondida_id,
      },
      {
        data_resposta_final: updatedProcesso.data_resposta_final,
        resposta_final: updatedProcesso.resposta_final,
        unidade_respondida_id: updatedProcesso.unidade_respondida_id,
      },
    );

    return mapProcessoToResponseDto(processoAtualizado);
  }

  /**
   * Busca unidade respondida para resposta final
   * Retorna a origem do processo (unidade que será respondida)
   *
   * @param id - ID do processo
   * @returns Origem do processo
   */
  async buscarUnidadesResposta(id: string): Promise<{ unidades: string[] }> {
    const processo = await this.prisma.processo.findUnique({
      where: { id },
      select: { origem: true },
    });

    if (!processo) {
      throw new NotFoundException('Processo não encontrado.');
    }

    // Retorna apenas a origem do processo como única opção
    return { unidades: [processo.origem] };
  }

  /**
   * Remove um processo (soft delete - apenas marca como inativo)
   *
   * @param id - ID do processo a ser removido
   * @param usuario_id - ID do usuário que está removendo o processo
   * @returns Confirmação de remoção
   */
  async remover(
    id: string,
    usuario_id: string,
  ): Promise<{ removido: boolean }> {
    // Verifica se o processo existe e se o usuário tem permissão
    const processo = await this.buscarPorId(id, usuario_id);

    const usuarioAtual = await this.prisma.usuario.findUnique({
      where: { id: usuario_id },
      select: {
        permissao: true,
      },
    });

    const processoPermissao = await this.prisma.processo.findUnique({
      where: { id },
      select: {
        usuario_atribuido_id: true,
        grupos: {
          where: { ativo: true },
          select: { grupo: { select: { id: true } } },
        },
      },
    });

    const temPermissaoGrupoExcluir =
      processoPermissao && usuarioAtual
        ? await this.usuarioTemPermissaoGrupoNoProcesso(
            usuario_id,
            processoPermissao,
            'excluir',
          )
        : false;

    const ehMasterGlobal = await this.usuarioEhMasterGlobal(usuario_id);

    if (
      usuarioAtual &&
      !['DEV', 'ADM'].includes(usuarioAtual.permissao) &&
      !ehMasterGlobal &&
      !temPermissaoGrupoExcluir
    ) {
      throw new ForbiddenException(
        'Você não tem permissão de grupo para excluir este processo.',
      );
    }

    // Verifica se há andamentos ativos relacionados
    const andamentos = await this.prisma.andamento.findMany({
      where: {
        processo_id: id,
        ativo: true, // Apenas andamentos ativos
      },
    });

    if (andamentos.length > 0) {
      throw new BadRequestException(
        `Não é possível remover o processo pois existem ${andamentos.length} andamento(s) ativo(s) relacionado(s). Remova os andamentos primeiro.`,
      );
    }

    // Remove o processo (soft delete - marca como inativo)
    await this.prisma.processo.update({
      where: { id },
      data: { ativo: false },
    });

    // Registra log
    await this.logsService.criar(
      $Enums.TipoAcao.PROCESSO_REMOVIDO,
      `Processo removido: ${processo.numero_sei} - ${processo.assunto}`,
      'processo',
      id,
      usuario_id,
      { numero_sei: processo.numero_sei, assunto: processo.assunto },
      null,
    );

    return { removido: true };
  }

  /**
   * Conta processos vencendo hoje
   *
   * @param usuario_id - ID do usuário que está buscando (para filtrar por unidade)
   * @returns Número de processos vencendo hoje
   */
  async contarVencendoHoje(usuario_id?: string): Promise<number> {
    const visibilidade =
      await this.montarFiltrosVisibilidadeConsulta(usuario_id);

    if (visibilidade.semAcesso) {
      return 0;
    }

    // Calcula início e fim do dia atual
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const fimDoDia = new Date(hoje);
    fimDoDia.setHours(23, 59, 59, 999);

    const searchParams: any = {
      ...(visibilidade.filtros.length > 0
        ? { AND: [...visibilidade.filtros] }
        : {}),
      ativo: true, // Apenas processos ativos
      data_resposta_final: null, // Apenas processos sem resposta final
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
    };

    return await this.prisma.processo.count({
      where: searchParams,
    });
  }

  /**
   * Conta processos atrasados
   * Atrasados = processos com prazo vencido E sem data de resposta final
   *
   * @param usuario_id - ID do usuário que está buscando (para filtrar por unidade)
   * @returns Número de processos atrasados
   */
  async contarAtrasados(usuario_id?: string): Promise<number> {
    const visibilidade =
      await this.montarFiltrosVisibilidadeConsulta(usuario_id);

    if (visibilidade.semAcesso) {
      return 0;
    }

    // Calcula início do dia atual
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const searchParams: any = {
      ...(visibilidade.filtros.length > 0
        ? { AND: [...visibilidade.filtros] }
        : {}),
      ativo: true, // Apenas processos ativos
      data_resposta_final: null, // Apenas processos sem resposta final
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
    };

    return await this.prisma.processo.count({
      where: searchParams,
    });
  }

  async contarConcluidos(usuario_id?: string): Promise<number> {
    const visibilidade =
      await this.montarFiltrosVisibilidadeConsulta(usuario_id);

    if (visibilidade.semAcesso) {
      return 0;
    }

    const searchParams: any = {
      ...(visibilidade.filtros.length > 0
        ? { AND: [...visibilidade.filtros] }
        : {}),
      ativo: true, // Apenas processos ativos
      data_resposta_final: { not: null }, // Processos com resposta final
    };

    return await this.prisma.processo.count({
      where: searchParams,
    });
  }

  /**
   * Conta total de processos (sem filtros além de ativo)
   *
   * @param usuario_id - ID do usuário que está buscando (para filtrar por unidade)
   * @returns Número total de processos
   */
  async contarTotal(usuario_id?: string): Promise<number> {
    const visibilidade =
      await this.montarFiltrosVisibilidadeConsulta(usuario_id);

    if (visibilidade.semAcesso) {
      return 0;
    }

    const searchParams: any = {
      ...(visibilidade.filtros.length > 0
        ? { AND: [...visibilidade.filtros] }
        : {}),
      ativo: true, // Apenas processos ativos
    };

    return await this.prisma.processo.count({
      where: searchParams,
    });
  }

  /**
   * Conta processos em andamento
   * Em andamento = não concluídos (sem data_resposta_final) E não atrasados (prazo >= hoje ou sem prazo)
   *
   * @param usuario_id - ID do usuário que está buscando (para filtrar por unidade)
   * @returns Número de processos em andamento
   */
  async contarEmAndamento(usuario_id?: string): Promise<number> {
    const visibilidade =
      await this.montarFiltrosVisibilidadeConsulta(usuario_id);

    if (visibilidade.semAcesso) {
      return 0;
    }

    // Calcula início do dia atual
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const searchParams: any = {
      ...(visibilidade.filtros.length > 0
        ? { AND: [...visibilidade.filtros] }
        : {}),
      ativo: true, // Apenas processos ativos
      data_resposta_final: null, // Apenas processos sem resposta final (não concluídos)
      OR: [
        // Sem prazo definido
        {
          prazo: null,
        },
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
    };

    return await this.prisma.processo.count({
      where: searchParams,
    });
  }
}
