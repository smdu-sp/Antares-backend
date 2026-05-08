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
import { BatchAndamentoDto } from './dto/batch-andamento.dto';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { AndamentoResponseDto } from './dto/andamento-response.dto';
import { Permissoes } from 'src/auth/decorators/permissoes.decorator';
import { UsuarioAtual } from 'src/auth/decorators/usuario-atual.decorator';
import { RequerCapacidade } from 'src/auth/decorators/requer-capacidade.decorator';
import { Usuario } from '@prisma/client';

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
  @RequerCapacidade('andamento.modificar')
  @Post()
  @ApiOperation({ summary: 'Cria um novo andamento' })
  @ApiResponse({
    status: 201,
    description: 'Andamento criado com sucesso',
    type: AndamentoResponseDto,
  })
  criar(
    @Body() createAndamentoDto: CreateAndamentoDto,
    @UsuarioAtual() usuario: Usuario,
  ): Promise<AndamentoResponseDto> {
    return this.andamentosService.criar(createAndamentoDto, usuario.id);
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
  @RequerCapacidade('andamento.visualizar')
  @Get()
  @ApiOperation({ summary: 'Lista todos os andamentos com paginação' })
  buscarTudo(
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
    @Query('processo_id') processo_id?: string,
    @Query('status') status?: string,
    @UsuarioAtual() usuario?: Usuario,
  ) {
    return this.andamentosService.buscarTudo(
      +pagina,
      +limite,
      processo_id,
      status,
      usuario?.id,
    );
  }

  /**
   * GET /andamentos/contar/concluidos
   * Conta andamentos concluídos
   */
  @Permissoes('ADM', 'TEC', 'USR')
  @RequerCapacidade('andamento.visualizar')
  @Get('contar/concluidos')
  @ApiOperation({ summary: 'Conta andamentos concluídos' })
  @ApiResponse({ status: 200, description: 'Número de andamentos concluídos' })
  contarConcluidos(
    @UsuarioAtual() usuario?: Usuario,
  ): Promise<{ total: number }> {
    return this.andamentosService
      .contarConcluidos(usuario?.id)
      .then((total) => ({ total }));
  }

  /**
   * GET /andamentos/contar/vencidos
   * Conta andamentos vencidos
   */
  @Permissoes('ADM', 'TEC', 'USR')
  @RequerCapacidade('andamento.visualizar')
  @Get('contar/vencidos')
  @ApiOperation({ summary: 'Conta andamentos vencidos' })
  @ApiResponse({ status: 200, description: 'Número de andamentos vencidos' })
  contarVencidos(
    @UsuarioAtual() usuario?: Usuario,
  ): Promise<{ total: number }> {
    return this.andamentosService
      .contarVencidos(usuario?.id)
      .then((total) => ({ total }));
  }

  /**
   * GET /andamentos/contar/vencendo-hoje
   * Conta andamentos vencendo hoje
   */
  @Permissoes('ADM', 'TEC', 'USR')
  @RequerCapacidade('andamento.visualizar')
  @Get('contar/vencendo-hoje')
  @ApiOperation({ summary: 'Conta andamentos vencendo hoje' })
  @ApiResponse({
    status: 200,
    description: 'Número de andamentos vencendo hoje',
  })
  contarVencendoHoje(
    @UsuarioAtual() usuario?: Usuario,
  ): Promise<{ total: number }> {
    return this.andamentosService
      .contarVencendoHoje(usuario?.id)
      .then((total) => ({ total }));
  }

  /**
   * GET /andamentos/contar/em-andamento
   * Conta andamentos em andamento
   */
  @Permissoes('ADM', 'TEC', 'USR')
  @RequerCapacidade('andamento.visualizar')
  @Get('contar/em-andamento')
  @ApiOperation({ summary: 'Conta andamentos em andamento' })
  @ApiResponse({
    status: 200,
    description: 'Número de andamentos em andamento',
  })
  contarEmAndamento(
    @UsuarioAtual() usuario?: Usuario,
  ): Promise<{ total: number }> {
    return this.andamentosService
      .contarEmAndamento(usuario?.id)
      .then((total) => ({ total }));
  }

  /**
   * GET /andamentos/processo/:processo_id
   * Busca todos os andamentos de um processo específico
   */
  @Permissoes('ADM', 'TEC', 'USR')
  @RequerCapacidade('andamento.visualizar')
  @Get('processo/:processo_id')
  @ApiOperation({ summary: 'Busca andamentos de um processo' })
  @ApiResponse({
    status: 200,
    description: 'Lista de andamentos',
    type: [AndamentoResponseDto],
  })
  buscarPorProcesso(
    @Param('processo_id') processo_id: string,
    @UsuarioAtual() usuario?: Usuario,
  ): Promise<AndamentoResponseDto[]> {
    return this.andamentosService.buscarPorProcesso(processo_id, usuario?.id);
  }

  /**
   * PATCH /andamentos/lote
   * Realiza operações em lote em andamentos (excluir, prorrogar, concluir)
   * IMPORTANTE: Esta rota deve vir ANTES de @Patch(':id') para não ser capturada como ID
   */
  @Permissoes('ADM', 'TEC')
  @RequerCapacidade('andamento.modificar')
  @Patch('lote')
  @ApiOperation({ summary: 'Operações em lote em andamentos' })
  @ApiResponse({ status: 200, description: 'Operações realizadas com sucesso' })
  lote(
    @Body() batchAndamentoDto: BatchAndamentoDto,
    @UsuarioAtual() usuario: Usuario,
  ): Promise<{ processados: number; erros: string[] }> {
    return this.andamentosService.lote(batchAndamentoDto, usuario.id);
  }

  /**
   * GET /andamentos/:id
   * Busca um andamento por ID
   */
  @Permissoes('ADM', 'TEC', 'USR')
  @RequerCapacidade('andamento.visualizar')
  @Get(':id')
  @ApiOperation({ summary: 'Busca um andamento por ID' })
  @ApiResponse({
    status: 200,
    description: 'Andamento encontrado',
    type: AndamentoResponseDto,
  })
  buscarPorId(
    @Param('id') id: string,
    @UsuarioAtual() usuario?: Usuario,
  ): Promise<AndamentoResponseDto> {
    return this.andamentosService.buscarPorId(id, usuario?.id);
  }

  /**
   * PATCH /andamentos/:id
   * Atualiza um andamento
   */
  @Permissoes('ADM', 'TEC')
  @RequerCapacidade('andamento.modificar')
  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza um andamento' })
  @ApiResponse({
    status: 200,
    description: 'Andamento atualizado',
    type: AndamentoResponseDto,
  })
  atualizar(
    @Param('id') id: string,
    @Body() updateAndamentoDto: UpdateAndamentoDto,
    @UsuarioAtual() usuario: Usuario,
  ): Promise<AndamentoResponseDto> {
    return this.andamentosService.atualizar(id, updateAndamentoDto, usuario.id);
  }

  /**
   * PATCH /andamentos/:id/concluir
   * Marca um andamento como concluído
   */
  @Permissoes('ADM', 'TEC')
  @RequerCapacidade('andamento.modificar')
  @Patch(':id/concluir')
  @ApiOperation({ summary: 'Marca um andamento como concluído' })
  @ApiResponse({
    status: 200,
    description: 'Andamento concluído',
    type: AndamentoResponseDto,
  })
  concluir(
    @Param('id') id: string,
    @UsuarioAtual() usuario: Usuario,
  ): Promise<AndamentoResponseDto> {
    return this.andamentosService.concluir(id, usuario.id);
  }

  /**
   * PATCH /andamentos/:id/prorrogar
   * Prorroga um andamento
   */
  @Permissoes('ADM', 'TEC')
  @RequerCapacidade('andamento.modificar')
  @Patch(':id/prorrogar')
  @ApiOperation({ summary: 'Prorroga um andamento' })
  @ApiResponse({
    status: 200,
    description: 'Andamento prorrogado',
    type: AndamentoResponseDto,
  })
  prorrogar(
    @Param('id') id: string,
    @Body('novaDataLimite') novaDataLimite: string,
    @UsuarioAtual() usuario: Usuario,
  ): Promise<AndamentoResponseDto> {
    return this.andamentosService.prorrogar(id, novaDataLimite, usuario.id);
  }

  /**
   * DELETE /andamentos/:id
   * Remove um andamento
   */
  @Permissoes('DEV', 'ADM', 'TEC')
  @RequerCapacidade('andamento.excluir')
  @Delete(':id')
  @ApiOperation({ summary: 'Remove um andamento' })
  @ApiResponse({ status: 200, description: 'Andamento removido' })
  remover(
    @Param('id') id: string,
    @UsuarioAtual() usuario: Usuario,
  ): Promise<{ removido: boolean }> {
    return this.andamentosService.remover(id, usuario.id);
  }
}
