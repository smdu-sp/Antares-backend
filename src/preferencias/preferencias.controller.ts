import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { PreferenciasService } from './preferencias.service';
import { SalvarPreferenciaDto } from './dto/salvar-preferencia.dto';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { UsuarioAtual } from '../auth/decorators/usuario-atual.decorator';
import { Usuario } from '@prisma/client';

@ApiTags('Preferências')
@ApiBearerAuth()
@Controller('preferencias')
export class PreferenciasController {
  constructor(private readonly preferenciasService: PreferenciasService) {}

  /**
   * POST /preferencias
   * Salva ou atualiza uma preferência do usuário autenticado
   */
  @Post()
  @ApiOperation({ summary: 'Salva ou atualiza uma preferência do usuário' })
  @ApiResponse({ status: 200, description: 'Preferência salva com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  async salvar(
    @Body() dto: SalvarPreferenciaDto,
    @UsuarioAtual() usuario: Usuario,
  ) {
    if (!usuario?.id) {
      throw new HttpException('Usuário não autenticado', HttpStatus.UNAUTHORIZED);
    }

    return await this.preferenciasService.salvar(usuario.id, dto);
  }

  /**
   * GET /preferencias
   * Busca todas as preferências do usuário autenticado
   */
  @Get()
  @ApiOperation({ summary: 'Busca todas as preferências do usuário' })
  @ApiResponse({ status: 200, description: 'Lista de preferências' })
  async buscarTodas(@UsuarioAtual() usuario: Usuario) {
    if (!usuario?.id) {
      throw new HttpException('Usuário não autenticado', HttpStatus.UNAUTHORIZED);
    }

    return await this.preferenciasService.buscarTodas(usuario.id);
  }

  /**
   * GET /preferencias/:chave
   * Busca uma preferência específica por chave
   */
  @Get(':chave')
  @ApiOperation({ summary: 'Busca uma preferência específica por chave' })
  @ApiParam({ name: 'chave', description: 'Chave da preferência' })
  @ApiResponse({ status: 200, description: 'Preferência encontrada' })
  @ApiResponse({ status: 404, description: 'Preferência não encontrada' })
  async buscar(
    @Param('chave') chave: string,
    @UsuarioAtual() usuario: Usuario,
  ) {
    if (!usuario?.id) {
      throw new HttpException('Usuário não autenticado', HttpStatus.UNAUTHORIZED);
    }

    const preferencia = await this.preferenciasService.buscar(usuario.id, chave);

    if (!preferencia) {
      throw new HttpException('Preferência não encontrada', HttpStatus.NOT_FOUND);
    }

    return preferencia;
  }

  /**
   * DELETE /preferencias/:chave
   * Deleta uma preferência específica
   */
  @Delete(':chave')
  @ApiOperation({ summary: 'Deleta uma preferência específica' })
  @ApiParam({ name: 'chave', description: 'Chave da preferência' })
  @ApiResponse({ status: 200, description: 'Preferência deletada com sucesso' })
  @ApiResponse({ status: 404, description: 'Preferência não encontrada' })
  async deletar(
    @Param('chave') chave: string,
    @UsuarioAtual() usuario: Usuario,
  ) {
    if (!usuario?.id) {
      throw new HttpException('Usuário não autenticado', HttpStatus.UNAUTHORIZED);
    }

    const result = await this.preferenciasService.deletar(usuario.id, chave);

    if (!result.success) {
      throw new HttpException(result.message, HttpStatus.NOT_FOUND);
    }

    return result;
  }

  /**
   * DELETE /preferencias
   * Deleta todas as preferências do usuário
   */
  @Delete()
  @ApiOperation({ summary: 'Deleta todas as preferências do usuário' })
  @ApiResponse({
    status: 200,
    description: 'Todas as preferências foram deletadas',
  })
  async deletarTodas(@UsuarioAtual() usuario: Usuario) {
    if (!usuario?.id) {
      throw new HttpException('Usuário não autenticado', HttpStatus.UNAUTHORIZED);
    }

    return await this.preferenciasService.deletarTodas(usuario.id);
  }
}
