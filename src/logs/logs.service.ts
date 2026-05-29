import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { $Enums, Log } from '@prisma/client';
import { LogPaginadoResponseDto, LogResponseDto } from './dto/log-response.dto';
import { AppService } from 'src/app.service';
import { FilterLogDto } from './dto/filter-log.dto';

/**
 * Service para gerenciar logs de auditoria do sistema
 *
 * Responsável por registrar todas as ações realizadas no sistema
 * para fins de auditoria, rastreabilidade e histórico de alterações
 */
@Injectable()
export class LogsService {
  constructor(
    private prisma: PrismaService,
    private app: AppService,
  ) {}

  /**
   * Cria um novo registro de log no sistema
   *
   * @param tipoAcao - Tipo da ação realizada (enum TipoAcao)
   * @param descricao - Descrição detalhada da ação
   * @param entidadeTipo - Tipo da entidade afetada (processo, andamento, etc.)
   * @param entidadeId - ID da entidade afetada
   * @param usuario_id - ID do usuário que realizou a ação
   * @param dadosAntigos - Estado anterior dos dados (para updates)
   * @param dadosNovos - Novo estado dos dados (para creates/updates)
   * @returns Log criado
   */
  async criar(
    tipoAcao: $Enums.TipoAcao,
    descricao: string,
    entidadeTipo: string,
    entidadeId: string,
    usuario_id: string,
    dadosAntigos: any | null = null,
    dadosNovos: any | null = null,
  ): Promise<Log> {
    try {
      const log = await this.prisma.log.create({
        data: {
          tipoAcao,
          descricao,
          entidadeTipo,
          entidadeId,
          usuario_id,
          dadosAntigos: dadosAntigos ? JSON.stringify(dadosAntigos) : null,
          dadosNovos: dadosNovos ? JSON.stringify(dadosNovos) : null,
        },
      });

      return log;
    } catch (error) {
      // Log silencioso - não deve interromper a operação principal
      console.error('Erro ao criar log:', error);
      // Retorna um objeto vazio para não quebrar a aplicação
      return null;
    }
  }

  /**
   * Busca todos os logs com paginação e filtros
   *
   * @param pagina - Número da página (padrão: 1)
   * @param limite - Itens por página (padrão: 10)
   * @param filtros - Filtros para busca
   * @returns Lista paginada de logs
   */
  async buscarTudo(
    pagina: number = 1,
    limite: number = 10,
    filtros?: FilterLogDto,
  ): Promise<LogPaginadoResponseDto> {
    // Valida e ajusta página e limite
    [pagina, limite] = this.app.verificaPagina(pagina, limite);

    // Monta os filtros de busca
    const searchParams: any = {
      ...(filtros?.tipoAcao && { tipoAcao: filtros.tipoAcao }),
      ...(filtros?.entidadeTipo && { entidadeTipo: filtros.entidadeTipo }),
      ...(filtros?.entidadeId && { entidadeId: filtros.entidadeId }),
      ...(filtros?.usuario_id && { usuario_id: filtros.usuario_id }),
    };

    // Filtro por data
    if (filtros?.dataInicio || filtros?.dataFim) {
      const [dataInicio, dataFim] = this.app.verificaData(
        filtros.dataInicio || '',
        filtros.dataFim || '',
      );
      searchParams.criadoEm = {
        gte: dataInicio,
        lte: dataFim,
      };
    }

    // Conta o total de logs que atendem aos filtros
    const total = await this.prisma.log.count({
      where: searchParams,
    });

    if (total === 0) {
      return { total: 0, pagina: 0, limite: 0, data: [] };
    }

    // Ajusta página e limite baseado no total
    [pagina, limite] = this.app.verificaLimite(pagina, limite, total);

    // Busca os logs com paginação
    const logs = await this.prisma.log.findMany({
      where: searchParams,
      orderBy: { criadoEm: 'desc' }, // Mais recentes primeiro
      skip: (pagina - 1) * limite,
      take: limite,
      include: {
        usuario: {
          select: {
            id: true,
            nome: true,
            login: true,
          },
        },
      },
    });

    return {
      total: +total,
      pagina: +pagina,
      limite: +limite,
      data: logs,
    };
  }

  /**
   * Busca logs de uma entidade específica
   *
   * @param entidadeTipo - Tipo da entidade
   * @param entidadeId - ID da entidade
   * @param pagina - Número da página
   * @param limite - Itens por página
   * @returns Lista paginada de logs da entidade
   */
  async buscarPorEntidade(
    entidadeTipo: string,
    entidadeId: string,
    pagina: number = 1,
    limite: number = 10,
  ): Promise<LogPaginadoResponseDto> {
    return this.buscarTudo(pagina, limite, {
      entidadeTipo,
      entidadeId,
    });
  }

  /**
   * Busca logs de um usuário específico
   *
   * @param usuario_id - ID do usuário
   * @param pagina - Número da página
   * @param limite - Itens por página
   * @returns Lista paginada de logs do usuário
   */
  async buscarPorUsuario(
    usuario_id: string,
    pagina: number = 1,
    limite: number = 10,
  ): Promise<LogPaginadoResponseDto> {
    return this.buscarTudo(pagina, limite, { usuario_id });
  }

  /**
   * Busca logs por tipo de ação
   *
   * @param tipoAcao - Tipo da ação
   * @param pagina - Número da página
   * @param limite - Itens por página
   * @returns Lista paginada de logs do tipo de ação
   */
  async buscarPorTipoAcao(
    tipoAcao: $Enums.TipoAcao,
    pagina: number = 1,
    limite: number = 10,
  ): Promise<LogPaginadoResponseDto> {
    return this.buscarTudo(pagina, limite, { tipoAcao });
  }

  /**
   * Busca um log específico por ID
   *
   * @param id - ID do log
   * @returns Log encontrado
   */
  async buscarPorId(id: string): Promise<LogResponseDto | null> {
    const log = await this.prisma.log.findUnique({
      where: { id },
      include: {
        usuario: {
          select: {
            id: true,
            nome: true,
            login: true,
          },
        },
      },
    });

    return log;
  }
}
