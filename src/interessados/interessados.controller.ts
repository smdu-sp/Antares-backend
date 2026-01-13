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
import { InteressadosService } from './interessados.service';
import { InteressadoResponseDto } from './dto/interessado-response.dto';
import { CreateInteressadoDto } from './dto/create-interessado.dto';
import { UpdateInteressadoDto } from './dto/update-interessado.dto';
import { Permissoes } from 'src/auth/decorators/permissoes.decorator';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Interessados')
@ApiBearerAuth()
@Controller('interessados')
export class InteressadosController {
  constructor(private readonly interessadosService: InteressadosService) {}

  /**
   * POST /interessados
   * Cria um novo interessado
   */
  @Permissoes('ADM', 'TEC')
  @Post()
  @ApiOperation({ summary: 'Cria um novo interessado' })
  @ApiResponse({
    status: 201,
    description: 'Interessado criado com sucesso',
    type: InteressadoResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Dados inválidos ou interessado já existe',
  })
  criar(
    @Body() createInteressadoDto: CreateInteressadoDto,
  ): Promise<InteressadoResponseDto> {
    return this.interessadosService.criar(createInteressadoDto);
  }

  /**
   * GET /interessados/lista-completa
   * Lista todos os interessados (sem paginação)
   */
  @Permissoes('ADM', 'TEC', 'USR')
  @Get('lista-completa')
  @ApiOperation({ summary: 'Lista todos os interessados (sem paginação)' })
  @ApiResponse({
    status: 200,
    description: 'Lista completa de interessados',
    type: [InteressadoResponseDto],
  })
  listaCompleta(): Promise<InteressadoResponseDto[]> {
    return this.interessadosService.listaCompleta();
  }

  /**
   * GET /interessados/autocomplete
   * Busca interessados para autocomplete
   */
  @Permissoes('ADM', 'TEC', 'USR')
  @Get('autocomplete')
  @ApiOperation({ summary: 'Busca interessados para autocomplete' })
  @ApiResponse({
    status: 200,
    description: 'Lista de interessados para autocomplete',
    type: [InteressadoResponseDto],
  })
  async autocomplete(
    @Query('termo') termo?: string,
  ): Promise<InteressadoResponseDto[]> {
    if (!termo || termo.trim().length < 2) {
      return this.interessadosService.listaCompleta();
    }

    // Busca por termo (case insensitive)
    const interessados = await this.interessadosService.buscarPorTermo(
      termo.trim(),
    );
    return interessados;
  }

  /**
   * GET /interessados/:id
   * Busca um interessado por ID
   */
  @Permissoes('ADM', 'TEC', 'USR')
  @Get(':id')
  @ApiOperation({ summary: 'Busca um interessado por ID' })
  @ApiResponse({
    status: 200,
    description: 'Interessado encontrado',
    type: InteressadoResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Interessado não encontrado' })
  buscarPorId(@Param('id') id: string): Promise<InteressadoResponseDto> {
    return this.interessadosService.buscarPorId(id);
  }

  /**
   * PATCH /interessados/:id
   * Atualiza um interessado
   */
  @Permissoes('ADM', 'TEC')
  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza um interessado' })
  @ApiResponse({
    status: 200,
    description: 'Interessado atualizado com sucesso',
    type: InteressadoResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Interessado não encontrado' })
  @ApiResponse({
    status: 400,
    description: 'Dados inválidos ou nome já existe',
  })
  atualizar(
    @Param('id') id: string,
    @Body() updateInteressadoDto: UpdateInteressadoDto,
  ): Promise<InteressadoResponseDto> {
    return this.interessadosService.atualizar(id, updateInteressadoDto);
  }

  /**
   * DELETE /interessados/:id
   * Remove um interessado
   */
  @Permissoes('ADM')
  @Delete(':id')
  @ApiOperation({ summary: 'Remove um interessado' })
  @ApiResponse({ status: 200, description: 'Interessado removido com sucesso' })
  @ApiResponse({ status: 404, description: 'Interessado não encontrado' })
  @ApiResponse({
    status: 400,
    description: 'Interessado possui processos vinculados',
  })
  remover(@Param('id') id: string): Promise<{ removido: boolean }> {
    return this.interessadosService.remover(id);
  }
}
