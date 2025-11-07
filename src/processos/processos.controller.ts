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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ProcessoResponseDto, ProcessoPaginadoResponseDto } from './dto/processo-response.dto';
import { Permissoes } from 'src/auth/decorators/permissoes.decorator';

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
@ApiBearerAuth()      // Indica que precisa de autenticação JWT
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
  @ApiResponse({ status: 201, description: 'Processo criado com sucesso', type: ProcessoResponseDto })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  criar(@Body() createProcessoDto: CreateProcessoDto): Promise<ProcessoResponseDto> {
    return this.processosService.criar(createProcessoDto);
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
  @ApiResponse({ status: 200, description: 'Lista de processos', type: ProcessoPaginadoResponseDto })
  buscarTudo(
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
    @Query('busca') busca?: string,
    @Query('vencendoHoje') vencendoHoje?: string,
    @Query('atrasados') atrasados?: string,
  ): Promise<ProcessoPaginadoResponseDto> {
    return this.processosService.buscarTudo(+pagina, +limite, busca, vencendoHoje === 'true', atrasados === 'true');
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
  @ApiResponse({ status: 200, description: 'Processo encontrado', type: ProcessoResponseDto })
  @ApiResponse({ status: 404, description: 'Processo não encontrado' })
  buscarPorId(@Param('id') id: string): Promise<ProcessoResponseDto> {
    return this.processosService.buscarPorId(id);
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
  @ApiResponse({ status: 200, description: 'Processo encontrado', type: ProcessoResponseDto })
  @ApiResponse({ status: 404, description: 'Processo não encontrado' })
  buscarPorNumeroSei(@Param('numero_sei') numero_sei: string): Promise<ProcessoResponseDto> {
    return this.processosService.buscarPorNumeroSei(numero_sei);
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
  @ApiResponse({ status: 200, description: 'Processo atualizado', type: ProcessoResponseDto })
  @ApiResponse({ status: 404, description: 'Processo não encontrado' })
  atualizar(
    @Param('id') id: string,
    @Body() updateProcessoDto: UpdateProcessoDto,
  ): Promise<ProcessoResponseDto> {
    return this.processosService.atualizar(id, updateProcessoDto);
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
  remover(@Param('id') id: string): Promise<{ removido: boolean }> {
    return this.processosService.remover(id);
  }
}

