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
import { Permissoes } from 'src/auth/decorators/permissoes.decorator';
import { UsuarioAtual } from 'src/auth/decorators/usuario-atual.decorator';
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
   * POST /processos
   * Cria um novo processo
   *
   * @param createProcessoDto - Dados do processo
   * @returns Processo criado
   */
  @Permissoes('ADM', 'TEC') // Apenas Admin e Técnico podem criar
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
   * - busca: termo de busca (opcional)
   *
   * @returns Lista paginada de processos
   */
  @Permissoes('ADM', 'TEC', 'USR') // Todos os usuários autenticados podem listar
  @Get()
  @ApiOperation({ summary: 'Lista todos os processos com paginação' })
  @ApiResponse({
    status: 200,
    description: 'Lista de processos',
    type: ProcessoPaginadoResponseDto,
  })
  buscarTudo(
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
    @Query('busca') busca?: string,
    @Query('vencendoHoje') vencendoHoje?: string,
    @Query('atrasados') atrasados?: string,
    @UsuarioAtual() usuario?: Usuario,
  ): Promise<ProcessoPaginadoResponseDto> {
    return this.processosService.buscarTudo(
      +pagina,
      +limite,
      busca,
      vencendoHoje === 'true',
      atrasados === 'true',
      usuario?.id,
    );
  }

  /**
   * GET /processos/contar/vencendo-hoje
   * Conta processos vencendo hoje
   */
  @Permissoes('ADM', 'TEC', 'USR')
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
  @Permissoes('ADM', 'TEC')
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
  @Permissoes('ADM') // Apenas Admin pode remover
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
