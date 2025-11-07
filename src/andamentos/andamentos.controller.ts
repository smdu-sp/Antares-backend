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
import { AndamentosService } from './andamentos.service';
import { CreateAndamentoDto } from './dto/create-andamento.dto';
import { UpdateAndamentoDto } from './dto/update-andamento.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AndamentoResponseDto } from './dto/andamento-response.dto';
import { Permissoes } from 'src/auth/decorators/permissoes.decorator';

@ApiTags('Andamentos')
@ApiBearerAuth()
@Controller('andamentos')
export class AndamentosController {
  constructor(private readonly andamentosService: AndamentosService) {}

  /**
   * POST /andamentos
   * Cria um novo andamento (envia processo de uma unidade para outra)
   */
  @Permissoes('ADM', 'TEC')
  @Post()
  @ApiOperation({ summary: 'Cria um novo andamento' })
  @ApiResponse({ status: 201, description: 'Andamento criado com sucesso', type: AndamentoResponseDto })
  criar(@Body() createAndamentoDto: CreateAndamentoDto): Promise<AndamentoResponseDto> {
    return this.andamentosService.criar(createAndamentoDto);
  }

  /**
   * GET /andamentos
   * Lista todos os andamentos com paginação
   * 
   * Query params:
   * - pagina: número da página
   * - limite: itens por página
   * - processo_id: filtrar por processo
   * - status: filtrar por status (EM_ANDAMENTO, CONCLUIDO, PRORROGADO)
   */
  @Permissoes('ADM', 'TEC', 'USR')
  @Get()
  @ApiOperation({ summary: 'Lista todos os andamentos com paginação' })
  buscarTudo(
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
    @Query('processo_id') processo_id?: string,
    @Query('status') status?: string,
  ) {
    return this.andamentosService.buscarTudo(+pagina, +limite, processo_id, status);
  }

  /**
   * GET /andamentos/processo/:processo_id
   * Busca todos os andamentos de um processo específico
   */
  @Permissoes('ADM', 'TEC', 'USR')
  @Get('processo/:processo_id')
  @ApiOperation({ summary: 'Busca andamentos de um processo' })
  @ApiResponse({ status: 200, description: 'Lista de andamentos', type: [AndamentoResponseDto] })
  buscarPorProcesso(@Param('processo_id') processo_id: string): Promise<AndamentoResponseDto[]> {
    return this.andamentosService.buscarPorProcesso(processo_id);
  }

  /**
   * GET /andamentos/:id
   * Busca um andamento por ID
   */
  @Permissoes('ADM', 'TEC', 'USR')
  @Get(':id')
  @ApiOperation({ summary: 'Busca um andamento por ID' })
  @ApiResponse({ status: 200, description: 'Andamento encontrado', type: AndamentoResponseDto })
  buscarPorId(@Param('id') id: string): Promise<AndamentoResponseDto> {
    return this.andamentosService.buscarPorId(id);
  }

  /**
   * PATCH /andamentos/:id
   * Atualiza um andamento
   */
  @Permissoes('ADM', 'TEC')
  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza um andamento' })
  @ApiResponse({ status: 200, description: 'Andamento atualizado', type: AndamentoResponseDto })
  atualizar(
    @Param('id') id: string,
    @Body() updateAndamentoDto: UpdateAndamentoDto,
  ): Promise<AndamentoResponseDto> {
    return this.andamentosService.atualizar(id, updateAndamentoDto);
  }

  /**
   * PATCH /andamentos/:id/concluir
   * Marca um andamento como concluído
   */
  @Permissoes('ADM', 'TEC')
  @Patch(':id/concluir')
  @ApiOperation({ summary: 'Marca um andamento como concluído' })
  @ApiResponse({ status: 200, description: 'Andamento concluído', type: AndamentoResponseDto })
  concluir(@Param('id') id: string): Promise<AndamentoResponseDto> {
    return this.andamentosService.concluir(id);
  }

  /**
   * PATCH /andamentos/:id/prorrogar
   * Prorroga um andamento
   */
  @Permissoes('ADM', 'TEC')
  @Patch(':id/prorrogar')
  @ApiOperation({ summary: 'Prorroga um andamento' })
  @ApiResponse({ status: 200, description: 'Andamento prorrogado', type: AndamentoResponseDto })
  prorrogar(
    @Param('id') id: string,
    @Body('novaDataLimite') novaDataLimite: string,
  ): Promise<AndamentoResponseDto> {
    return this.andamentosService.prorrogar(id, novaDataLimite);
  }

  /**
   * DELETE /andamentos/:id
   * Remove um andamento
   */
  @Permissoes('ADM')
  @Delete(':id')
  @ApiOperation({ summary: 'Remove um andamento' })
  @ApiResponse({ status: 200, description: 'Andamento removido' })
  remover(@Param('id') id: string): Promise<{ removido: boolean }> {
    return this.andamentosService.remover(id);
  }
}

