import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ProcessosService } from './processos.service';
import { CreateProcessoDto } from './dto/create-processo.dto';
import { UpdateProcessoDto } from './dto/update-processo.dto';
import { CreateRespostaFinalDto } from './dto/create-resposta-final.dto';
import { BuscarProcessoDto } from './dto/buscar-processo.dto';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import {
  ProcessoResponseDto,
  ProcessoPaginadoResponseDto,
} from './dto/processo-response.dto';
import { PoliticaColunasProcessosResponseDto } from './dto/politica-colunas-processos-response.dto';
import { Permissoes } from 'src/auth/decorators/permissoes.decorator';
import { UsuarioAtual } from 'src/auth/decorators/usuario-atual.decorator';
import { RequerCapacidade } from 'src/auth/decorators/requer-capacidade.decorator';
import { Usuario } from '@prisma/client';

/**
 * Controller - Camada de Apresentação/HTTP
 *
 * O Controller é responsável por:
 * 1. Receber requisições HTTP (GET, POST, PUT, DELETE, etc.)
 * 2. Validar dados de entrada (usando DTOs e class-validator)
 * 3. Chamar o Service para processar a lógica
 * 4. Retornar respostas HTTP (status codes, JSON, etc.)
 * 5. Tratar erros HTTP
 *
 * O Controller NÃO contém lógica de negócio, apenas orquestra
 * as requisições e respostas HTTP.
 */
@ApiTags('Processos') // Tag para agrupar no Swagger
@ApiBearerAuth() // Indica que precisa de autenticação JWT
@Controller('processos') // Define a rota base: /processos
export class ProcessosController {
  constructor(private readonly processosService: ProcessosService) {}

  /**
   * GET /processos/origens/autocomplete
   * Autocomplete de unidade de origem
   * @param q termo digitado
   * @returns lista de strings
   */
  @Get('origens/autocomplete')
  async autocompleteOrigens(@Query('q') q: string) {
    return this.processosService.autocompleteOrigens(q);
  }

  /**
   * POST /processos
   * Cria um novo processo
   *
   * @param createProcessoDto - Dados do processo
   * @returns Processo criado
   */
  @Permissoes('ADM', 'TEC', 'USR')
  @RequerCapacidade('processo.modificar')
  @Post()
  @ApiOperation({ summary: 'Cria um novo processo' })
  @ApiResponse({
    status: 201,
    description: 'Processo criado com sucesso',
    type: ProcessoResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  criar(
    @Body() createProcessoDto: CreateProcessoDto,
    @UsuarioAtual() usuario: Usuario,
  ): Promise<ProcessoResponseDto> {
    return this.processosService.criar(createProcessoDto, usuario.id);
  }

  /**
   * GET /processos
   * Lista todos os processos com paginação
   *
   * Query params:
   * - pagina: número da página (padrão: 1)
   * - limite: itens por página (padrão: 10)
   * - busca: termo de busca geral (pesquisa em todos os campos)
   * - interessado: busca específica no campo interessado
   * - unidadeRemetente: busca específica na unidade remetente
   * - unidadeDestino: busca específica na unidade destino
   * - vencendoHoje: filtro de processos vencendo hoje (true/false)
   * - atrasados: filtro de processos atrasados (true/false)
   * - concluidos: filtro de processos concluídos (true/false)
   *
   * @returns Lista paginada de processos
   */
  @Permissoes('ADM', 'TEC', 'USR') // Todos os usuários autenticados podem listar
  @RequerCapacidade('processo.visualizar')
  @Get()
  @ApiOperation({
    summary: 'Lista todos os processos com paginação e filtros',
    description: `
      Lista processos com suporte a:
      - Busca geral: pesquisa em todos os campos do processo e andamentos
      - Buscas específicas: interessado, unidade remetente e unidade destino
      - Filtros rápidos: vencendo hoje, atrasados e concluídos (podem ser combinados)
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de processos',
    type: ProcessoPaginadoResponseDto,
  })
  buscarTudo(
    @Query() filtros: BuscarProcessoDto,
    @UsuarioAtual() usuario?: Usuario,
  ): Promise<ProcessoPaginadoResponseDto> {
    return this.processosService.buscarTudo(
      filtros.pagina,
      filtros.limite,
      filtros.busca,
      filtros.interessado,
      filtros.unidadeRemetente,
      filtros.unidadeDestino,
      filtros.vencendoHoje,
      filtros.atrasados,
      filtros.concluidos,
      usuario?.id,
    );
  }

  /**
   * GET /processos/contar/total
   * Conta total de processos
   */
  @Permissoes('ADM', 'TEC', 'USR')
  @RequerCapacidade('processo.visualizar')
  @Get('contar/total')
  @ApiOperation({ summary: 'Conta total de processos' })
  @ApiResponse({
    status: 200,
    description: 'Número total de processos',
  })
  contarTotal(@UsuarioAtual() usuario?: Usuario): Promise<{ total: number }> {
    return this.processosService
      .contarTotal(usuario?.id)
      .then((total) => ({ total }));
  }

  /**
   * GET /processos/contar/em-andamento
   * Conta processos em andamento (não concluídos e não atrasados)
   */
  @Permissoes('ADM', 'TEC', 'USR')
  @RequerCapacidade('processo.visualizar')
  @Get('contar/em-andamento')
  @ApiOperation({ summary: 'Conta processos em andamento' })
  @ApiResponse({
    status: 200,
    description: 'Número de processos em andamento',
  })
  contarEmAndamento(
    @UsuarioAtual() usuario?: Usuario,
  ): Promise<{ total: number }> {
    return this.processosService
      .contarEmAndamento(usuario?.id)
      .then((total) => ({ total }));
  }

  /**
   * GET /processos/contar/vencendo-hoje
   * Conta processos vencendo hoje
   */
  @Permissoes('ADM', 'TEC', 'USR')
  @RequerCapacidade('processo.visualizar')
  @Get('contar/vencendo-hoje')
  @ApiOperation({ summary: 'Conta processos vencendo hoje' })
  @ApiResponse({
    status: 200,
    description: 'Número de processos vencendo hoje',
  })
  contarVencendoHoje(
    @UsuarioAtual() usuario?: Usuario,
  ): Promise<{ total: number }> {
    return this.processosService
      .contarVencendoHoje(usuario?.id)
      .then((total) => ({ total }));
  }

  /**
   * GET /processos/contar/atrasados
   * Conta processos atrasados
   */
  @Permissoes('ADM', 'TEC', 'USR')
  @RequerCapacidade('processo.visualizar')
  @Get('contar/atrasados')
  @ApiOperation({ summary: 'Conta processos atrasados' })
  @ApiResponse({ status: 200, description: 'Número de processos atrasados' })
  contarAtrasados(
    @UsuarioAtual() usuario?: Usuario,
  ): Promise<{ total: number }> {
    return this.processosService
      .contarAtrasados(usuario?.id)
      .then((total) => ({ total }));
  }

  /**
   * GET /processos/contar/concluidos
   * Conta processos concluídos
   */
  @Permissoes('ADM', 'TEC', 'USR')
  @RequerCapacidade('processo.visualizar')
  @Get('contar/concluidos')
  @ApiOperation({ summary: 'Conta processos concluídos' })
  @ApiResponse({ status: 200, description: 'Número de processos concluídos' })
  contarConcluidos(
    @UsuarioAtual() usuario?: Usuario,
  ): Promise<{ total: number }> {
    return this.processosService
      .contarConcluidos(usuario?.id)
      .then((total) => ({ total }));
  }

  /**
   * GET /processos/colunas/politica
   * Retorna politica oficial de colunas por grupo ativo
   * e aplica preferencia do usuario apenas para ordem.
   */
  @Permissoes('ADM', 'TEC', 'USR')
  @RequerCapacidade('processo.visualizar')
  @Get('colunas/politica')
  @ApiOperation({
    summary: 'Retorna politica oficial de colunas do grid de processos',
    description:
      'A politica de colunas e definida por grupo ativo. Preferencias do usuario sao usadas apenas para ordem.',
  })
  @ApiResponse({
    status: 200,
    description: 'Politica de colunas carregada com sucesso',
    type: PoliticaColunasProcessosResponseDto,
  })
  obterPoliticaColunas(
    @UsuarioAtual() usuario: Usuario,
  ): Promise<PoliticaColunasProcessosResponseDto> {
    return this.processosService.obterPoliticaColunasProcessos(usuario.id);
  }

  /**
   * GET /processos/:id/unidades-resposta
   * Busca unidades disponíveis para resposta final baseado nos andamentos do processo
   */
  @Get(':id/unidades-resposta')
  @ApiOperation({ summary: 'Busca unidades disponíveis para resposta final' })
  @ApiResponse({ status: 200, description: 'Lista de unidades' })
  @ApiResponse({ status: 404, description: 'Processo não encontrado' })
  async buscarUnidadesResposta(
    @Param('id') id: string,
  ): Promise<{ unidades: string[] }> {
    return this.processosService.buscarUnidadesResposta(id);
  }

  /**
   * GET /processos/:id
   * Busca um processo por ID
   *
   * @param id - ID do processo
   * @returns Processo encontrado
   */
  @Permissoes('ADM', 'TEC', 'USR')
  @RequerCapacidade('processo.visualizar')
  @Get(':id')
  @ApiOperation({ summary: 'Busca um processo por ID' })
  @ApiResponse({
    status: 200,
    description: 'Processo encontrado',
    type: ProcessoResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Processo não encontrado' })
  buscarPorId(
    @Param('id') id: string,
    @UsuarioAtual() usuario?: Usuario,
  ): Promise<ProcessoResponseDto> {
    return this.processosService.buscarPorId(id, usuario?.id);
  }

  /**
   * GET /processos/numero-sei/:numero_sei
   * Busca um processo por número SEI
   *
   * @param numero_sei - Número SEI do processo
   * @returns Processo encontrado
   */
  @Permissoes('ADM', 'TEC', 'USR')
  @RequerCapacidade('processo.visualizar')
  @Get('numero-sei/:numero_sei')
  @ApiOperation({ summary: 'Busca um processo por número SEI' })
  @ApiResponse({
    status: 200,
    description: 'Processo encontrado',
    type: ProcessoResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Processo não encontrado' })
  buscarPorNumeroSei(
    @Param('numero_sei') numero_sei: string,
    @UsuarioAtual() usuario?: Usuario,
  ): Promise<ProcessoResponseDto> {
    return this.processosService.buscarPorNumeroSei(numero_sei, usuario?.id);
  }

  /**
   * PATCH /processos/:id
   * Atualiza um processo
   *
   * @param id - ID do processo
   * @param updateProcessoDto - Dados a serem atualizados
   * @returns Processo atualizado
   */
  @Permissoes('ADM', 'TEC', 'USR')
  @RequerCapacidade('processo.modificar')
  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza um processo' })
  @ApiResponse({
    status: 200,
    description: 'Processo atualizado',
    type: ProcessoResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Processo não encontrado' })
  atualizar(
    @Param('id') id: string,
    @Body() updateProcessoDto: UpdateProcessoDto,
    @UsuarioAtual() usuario: Usuario,
  ): Promise<ProcessoResponseDto> {
    return this.processosService.atualizar(id, updateProcessoDto, usuario.id);
  }

  /**
   * POST /processos/resposta-final
   * Cria resposta final para um processo
   *
   * @param createRespostaFinalDto - Dados da resposta final
   * @param usuario - Usuário autenticado
   * @returns Processo atualizado com resposta final
   */
  @RequerCapacidade('processo.modificar')
  @Post('resposta-final')
  @ApiOperation({ summary: 'Cria resposta final para um processo' })
  @ApiResponse({
    status: 201,
    description: 'Resposta final criada',
    type: ProcessoResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Processo não encontrado' })
  @ApiResponse({
    status: 400,
    description: 'Dados inválidos ou processo sem andamentos',
  })
  criarRespostaFinal(
    @Body() createRespostaFinalDto: CreateRespostaFinalDto,
    @UsuarioAtual() usuario: Usuario,
  ): Promise<ProcessoResponseDto> {
    return this.processosService.criarRespostaFinal(
      createRespostaFinalDto,
      usuario.id,
    );
  }

  /**
   * DELETE /processos/:id
   * Remove um processo
   *
   * @param id - ID do processo
   * @returns Confirmação de remoção
   */
  @Permissoes('ADM', 'TEC', 'USR')
  @RequerCapacidade('processo.excluir')
  @Delete(':id')
  @ApiOperation({ summary: 'Remove um processo' })
  @ApiResponse({ status: 200, description: 'Processo removido' })
  @ApiResponse({ status: 404, description: 'Processo não encontrado' })
  remover(
    @Param('id') id: string,
    @UsuarioAtual() usuario: Usuario,
  ): Promise<{ removido: boolean }> {
    return this.processosService.remover(id, usuario.id);
  }
}
