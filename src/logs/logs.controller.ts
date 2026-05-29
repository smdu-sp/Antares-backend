import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { LogsService } from './logs.service';
import { LogPaginadoResponseDto, LogResponseDto } from './dto/log-response.dto';
import { FilterLogDto } from './dto/filter-log.dto';
import { $Enums } from '@prisma/client';
import { Permissoes } from 'src/auth/decorators/permissoes.decorator';

/**
 * Controller para gerenciar logs do sistema
 *
 * Endpoints disponíveis:
 * - GET /logs - Lista todos os logs (com paginação e filtros)
 * - GET /logs/:id - Busca um log específico
 * - GET /logs/entidade/:tipo/:id - Busca logs de uma entidade
 * - GET /logs/usuario/:id - Busca logs de um usuário
 * - GET /logs/tipo/:tipo - Busca logs por tipo de ação
 */
@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  /**
   * Lista todos os logs com paginação e filtros
   *
   * @param pagina - Número da página (query param)
   * @param limite - Limite de itens por página (query param)
   * @param filtros - Filtros adicionais (query params)
   * @returns Lista paginada de logs
   *
   * Exemplo: GET /logs?pagina=1&limite=10&tipoAcao=PROCESSO_CRIADO
   */
  @Get()
  @Permissoes($Enums.Permissao.DEV, $Enums.Permissao.ADM)
  async buscarTudo(
    @Query('pagina') pagina?: number,
    @Query('limite') limite?: number,
    @Query() filtros?: FilterLogDto,
  ): Promise<LogPaginadoResponseDto> {
    return this.logsService.buscarTudo(
      pagina ? +pagina : 1,
      limite ? +limite : 10,
      filtros,
    );
  }

  /**
   * Busca um log específico por ID
   *
   * @param id - ID do log
   * @returns Log encontrado
   *
   * Exemplo: GET /logs/123e4567-e89b-12d3-a456-426614174000
   */
  @Get(':id')
  @Permissoes($Enums.Permissao.DEV, $Enums.Permissao.ADM)
  async buscarPorId(@Param('id') id: string): Promise<LogResponseDto> {
    return this.logsService.buscarPorId(id);
  }

  /**
   * Busca logs de uma entidade específica
   *
   * @param tipo - Tipo da entidade (processo, andamento, etc.)
   * @param id - ID da entidade
   * @param pagina - Número da página
   * @param limite - Limite de itens
   * @returns Lista paginada de logs da entidade
   *
   * Exemplo: GET /logs/entidade/processo/123e4567-e89b-12d3-a456-426614174000?pagina=1&limite=10
   */
  @Get('entidade/:tipo/:id')
  @Permissoes($Enums.Permissao.DEV, $Enums.Permissao.ADM, $Enums.Permissao.TEC)
  async buscarPorEntidade(
    @Param('tipo') tipo: string,
    @Param('id') id: string,
    @Query('pagina') pagina?: number,
    @Query('limite') limite?: number,
  ): Promise<LogPaginadoResponseDto> {
    return this.logsService.buscarPorEntidade(
      tipo,
      id,
      pagina ? +pagina : 1,
      limite ? +limite : 10,
    );
  }

  /**
   * Busca logs de um usuário específico
   *
   * @param id - ID do usuário
   * @param pagina - Número da página
   * @param limite - Limite de itens
   * @returns Lista paginada de logs do usuário
   *
   * Exemplo: GET /logs/usuario/123e4567-e89b-12d3-a456-426614174000?pagina=1&limite=10
   */
  @Get('usuario/:id')
  @Permissoes($Enums.Permissao.DEV, $Enums.Permissao.ADM)
  async buscarPorUsuario(
    @Param('id') id: string,
    @Query('pagina') pagina?: number,
    @Query('limite') limite?: number,
  ): Promise<LogPaginadoResponseDto> {
    return this.logsService.buscarPorUsuario(
      id,
      pagina ? +pagina : 1,
      limite ? +limite : 10,
    );
  }

  /**
   * Busca logs por tipo de ação
   *
   * @param tipo - Tipo de ação (TipoAcao enum)
   * @param pagina - Número da página
   * @param limite - Limite de itens
   * @returns Lista paginada de logs do tipo
   *
   * Exemplo: GET /logs/tipo/PROCESSO_CRIADO?pagina=1&limite=10
   */
  @Get('tipo/:tipo')
  @Permissoes($Enums.Permissao.DEV, $Enums.Permissao.ADM)
  async buscarPorTipo(
    @Param('tipo') tipo: $Enums.TipoAcao,
    @Query('pagina') pagina?: number,
    @Query('limite') limite?: number,
  ): Promise<LogPaginadoResponseDto> {
    return this.logsService.buscarPorTipoAcao(
      tipo,
      pagina ? +pagina : 1,
      limite ? +limite : 10,
    );
  }
}
