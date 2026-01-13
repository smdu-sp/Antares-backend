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
import { processo, $Enums } from '@prisma/client';
import { AppService } from 'src/app.service';
import { LogsService } from 'src/logs/logs.service';

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
  constructor(
    private prisma: PrismaService, // Injeção de dependência do Prisma
    private app: AppService, // Serviço auxiliar para paginação
    private logsService: LogsService, // Serviço de logs
  ) {}

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
    // Busca o usuário para obter a unidade_id
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuario_id },
      select: { unidade_id: true },
    });

    if (!usuario || !usuario.unidade_id) {
      throw new BadRequestException('Usuário não possui unidade atribuída.');
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
        where: { id: createProcessoDto.interessado_id },
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
        data_recebimento: createProcessoDto.data_recebimento
          ? new Date(createProcessoDto.data_recebimento)
          : undefined,
        prazo: createProcessoDto.prazo
          ? new Date(createProcessoDto.prazo)
          : undefined,
        unidade_id: usuario.unidade_id,
      },
    });

    if (!processo) {
      throw new InternalServerErrorException(
        'Não foi possível criar o processo.',
      );
    }

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

    return processo;
  }

  /**
   * Busca todos os processos com paginação
   *
   * @param pagina - Número da página (padrão: 1)
   * @param limite - Itens por página (padrão: 10)
   * @param busca - Termo de busca (opcional)
   * @param vencendoHoje - Filtrar processos vencendo hoje
   * @param atrasados - Filtrar processos atrasados
   * @param usuario_id - ID do usuário que está buscando (para filtrar por unidade)
   * @returns Lista paginada de processos
   */
  async buscarTudo(
    pagina: number = 1,
    limite: number = 10,
    busca?: string,
    vencendoHoje: boolean = false,
    atrasados: boolean = false,
    usuario_id?: string,
  ): Promise<ProcessoPaginadoResponseDto> {
    // Valida e ajusta página e limite usando o AppService
    [pagina, limite] = this.app.verificaPagina(pagina, limite);

    // Busca o usuário para obter permissão e unidade_id
    let unidade_id: string | undefined;
    let permissao: string | undefined;

    if (usuario_id) {
      const usuario = await this.prisma.usuario.findUnique({
        where: { id: usuario_id },
        select: { unidade_id: true, permissao: true },
      });

      if (usuario) {
        unidade_id = usuario.unidade_id;
        permissao = usuario.permissao;
      }
    }

    // Calcula início e fim do dia atual (00:00:00 até 23:59:59)
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const fimDoDia = new Date(hoje);
    fimDoDia.setHours(23, 59, 59, 999);

    // Monta os filtros de busca com OR entre vencendoHoje e atrasados
    const searchParams: any = {
      ativo: true, // Apenas processos ativos
      // Filtra por unidade do usuário (exceto para DEV e ADM que podem ver todos)
      ...(unidade_id &&
        permissao &&
        !['DEV', 'ADM'].includes(permissao) && {
          unidade_id: unidade_id,
        }),
      ...(busca && {
        OR: [
          { numero_sei: { contains: busca } },
          { assunto: { contains: busca } },
        ],
      }),
    };

    // Se pelo menos um filtro de prazo estiver ativo
    if (vencendoHoje || atrasados) {
      const filtrosPrazo: any[] = [];

      if (vencendoHoje) {
        filtrosPrazo.push({
          andamentos: {
            some: {
              ativo: true, // Apenas andamentos ativos
              status: $Enums.StatusAndamento.EM_ANDAMENTO, // Apenas andamentos em andamento
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
        });
      }

      if (atrasados) {
        filtrosPrazo.push({
          andamentos: {
            some: {
              ativo: true, // Apenas andamentos ativos
              status: $Enums.StatusAndamento.EM_ANDAMENTO, // Apenas andamentos em andamento
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
        });
      }

      // Se houver filtros de prazo, adiciona como OR
      if (filtrosPrazo.length > 0) {
        // Se já existe um OR (do busca), combina com os filtros de prazo
        if (searchParams.OR) {
          searchParams.AND = [{ OR: searchParams.OR }, { OR: filtrosPrazo }];
          delete searchParams.OR;
        } else {
          searchParams.OR = filtrosPrazo;
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
      },
    });

    return {
      total: +total,
      pagina: +pagina,
      limite: +limite,
      data: processos,
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

    if (!processo || !processo.ativo) {
      throw new NotFoundException('Processo não encontrado.');
    }

    // Verifica se o usuário tem permissão para ver este processo
    if (usuario_id) {
      const usuario = await this.prisma.usuario.findUnique({
        where: { id: usuario_id },
        select: { unidade_id: true, permissao: true },
      });

      if (usuario && !['DEV', 'ADM'].includes(usuario.permissao)) {
        if (processo.unidade_id !== usuario.unidade_id) {
          throw new ForbiddenException(
            'Você não tem permissão para acessar este processo.',
          );
        }
      }
    }

    return processo;
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

    if (!processo || !processo.ativo) {
      throw new NotFoundException('Processo não encontrado.');
    }

    // Verifica se o usuário tem permissão para ver este processo
    if (usuario_id) {
      const usuario = await this.prisma.usuario.findUnique({
        where: { id: usuario_id },
        select: { unidade_id: true, permissao: true },
      });

      if (usuario && !['DEV', 'ADM'].includes(usuario.permissao)) {
        if (processo.unidade_id !== usuario.unidade_id) {
          throw new ForbiddenException(
            'Você não tem permissão para acessar este processo.',
          );
        }
      }
    }

    return processo;
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

    // Se recebeu interessado_id diretamente, valida se existe
    if (updateProcessoDto.interessado_id) {
      const interessadoExistente = await this.prisma.interessado.findUnique({
        where: { id: updateProcessoDto.interessado_id },
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
          where: { valor: updateProcessoDto.interessado.trim() },
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

    // Prepara os dados para atualização
    const dadosAtualizacao: any = {
      numero_sei: updateProcessoDto.numero_sei,
      assunto: updateProcessoDto.assunto,
      origem: updateProcessoDto.origem,
      data_recebimento: updateProcessoDto.data_recebimento
        ? new Date(updateProcessoDto.data_recebimento)
        : undefined,
      prazo: updateProcessoDto.prazo
        ? new Date(updateProcessoDto.prazo)
        : undefined,
    };

    // Só adiciona os campos de relacionamento se eles tiverem valores
    if (interessadoId !== null && interessadoId !== undefined) {
      dadosAtualizacao.interessado_id = interessadoId;
    }

    if (unidadeRemetenteId !== null && unidadeRemetenteId !== undefined) {
      dadosAtualizacao.unidade_remetente_id = unidadeRemetenteId;
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

    return processoAtualizado;
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

      return processoAtualizado;
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

      return processoAtualizado;
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

    return processoAtualizado;
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
    // Busca o usuário para obter permissão e unidade_id
    let unidade_id: string | undefined;
    let permissao: string | undefined;

    if (usuario_id) {
      const usuario = await this.prisma.usuario.findUnique({
        where: { id: usuario_id },
        select: { unidade_id: true, permissao: true },
      });

      if (usuario) {
        unidade_id = usuario.unidade_id;
        permissao = usuario.permissao;
      }
    }

    // Calcula início e fim do dia atual
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const fimDoDia = new Date(hoje);
    fimDoDia.setHours(23, 59, 59, 999);

    const searchParams: any = {
      // Filtra por unidade do usuário (exceto para DEV e ADM que podem ver todos)
      ...(unidade_id &&
        permissao &&
        !['DEV', 'ADM'].includes(permissao) && {
          unidade_id: unidade_id,
        }),
      ativo: true, // Apenas processos ativos
      andamentos: {
        some: {
          ativo: true, // Apenas andamentos ativos
          status: $Enums.StatusAndamento.EM_ANDAMENTO, // Apenas andamentos em andamento
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
    };

    return await this.prisma.processo.count({
      where: searchParams,
    });
  }

  /**
   * Conta processos atrasados
   *
   * @param usuario_id - ID do usuário que está buscando (para filtrar por unidade)
   * @returns Número de processos atrasados
   */
  async contarAtrasados(usuario_id?: string): Promise<number> {
    // Busca o usuário para obter permissão e unidade_id
    let unidade_id: string | undefined;
    let permissao: string | undefined;

    if (usuario_id) {
      const usuario = await this.prisma.usuario.findUnique({
        where: { id: usuario_id },
        select: { unidade_id: true, permissao: true },
      });

      if (usuario) {
        unidade_id = usuario.unidade_id;
        permissao = usuario.permissao;
      }
    }

    // Calcula início do dia atual
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const searchParams: any = {
      // Filtra por unidade do usuário (exceto para DEV e ADM que podem ver todos)
      ...(unidade_id &&
        permissao &&
        !['DEV', 'ADM'].includes(permissao) && {
          unidade_id: unidade_id,
        }),
      ativo: true, // Apenas processos ativos
      andamentos: {
        some: {
          ativo: true, // Apenas andamentos ativos
          status: $Enums.StatusAndamento.EM_ANDAMENTO, // Apenas andamentos em andamento
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
    };

    return await this.prisma.processo.count({
      where: searchParams,
    });
  }
}
