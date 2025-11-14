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
import { UnidadesService } from './unidades.service';
import { CreateUnidadeDto } from './dto/create-unidade.dto';
import { UpdateUnidadeDto } from './dto/update-unidade.dto';
import { UnidadeResponseDto, UnidadePaginadoResponseDto } from './dto/unidade-response.dto';
import { Permissoes } from 'src/auth/decorators/permissoes.decorator';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Unidades')
@ApiBearerAuth()
@Controller('unidades')
export class UnidadesController {
  constructor(private readonly unidadesService: UnidadesService) {}

  /**
   * POST /unidades
   * Cria uma nova unidade
   */
  @Permissoes('ADM')
  @Post()
  @ApiOperation({ summary: 'Cria uma nova unidade' })
  @ApiResponse({ status: 201, description: 'Unidade criada com sucesso', type: UnidadeResponseDto })
  criar(@Body() createUnidadeDto: CreateUnidadeDto): Promise<UnidadeResponseDto> {
    return this.unidadesService.criar(createUnidadeDto);
  }

  /**
   * GET /unidades
   * Lista todas as unidades com paginação
   */
  @Permissoes('ADM', 'TEC', 'USR')
  @Get()
  @ApiOperation({ summary: 'Lista todas as unidades com paginação' })
  @ApiResponse({ status: 200, description: 'Lista de unidades', type: UnidadePaginadoResponseDto })
  buscarTudo(
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
    @Query('busca') busca?: string,
  ): Promise<UnidadePaginadoResponseDto> {
    return this.unidadesService.buscarTudo(+pagina, +limite, busca);
  }

  /**
   * GET /unidades/lista-completa
   * Lista todas as unidades (sem paginação)
   */
  @Permissoes('ADM', 'TEC', 'USR')
  @Get('lista-completa')
  @ApiOperation({ summary: 'Lista todas as unidades (sem paginação)' })
  @ApiResponse({ status: 200, description: 'Lista completa de unidades', type: [UnidadeResponseDto] })
  listaCompleta(): Promise<UnidadeResponseDto[]> {
    return this.unidadesService.listaCompleta();
  }

  /**
   * GET /unidades/:id
   * Busca uma unidade por ID
   */
  @Permissoes('ADM', 'TEC', 'USR')
  @Get(':id')
  @ApiOperation({ summary: 'Busca uma unidade por ID' })
  @ApiResponse({ status: 200, description: 'Unidade encontrada', type: UnidadeResponseDto })
  buscarPorId(@Param('id') id: string): Promise<UnidadeResponseDto> {
    return this.unidadesService.buscarPorId(id);
  }

  /**
   * PATCH /unidades/:id
   * Atualiza uma unidade
   */
  @Permissoes('ADM')
  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza uma unidade' })
  @ApiResponse({ status: 200, description: 'Unidade atualizada com sucesso', type: UnidadeResponseDto })
  atualizar(
    @Param('id') id: string,
    @Body() updateUnidadeDto: UpdateUnidadeDto,
  ): Promise<UnidadeResponseDto> {
    return this.unidadesService.atualizar(id, updateUnidadeDto);
  }

  /**
   * DELETE /unidades/:id
   * Remove uma unidade
   */
  @Permissoes('ADM')
  @Delete(':id')
  @ApiOperation({ summary: 'Remove uma unidade' })
  @ApiResponse({ status: 200, description: 'Unidade removida com sucesso' })
  remover(@Param('id') id: string): Promise<{ removido: boolean }> {
    return this.unidadesService.remover(id);
  }
}



