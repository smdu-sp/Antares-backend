import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Usuario } from '@prisma/client';
import { Permissoes } from 'src/auth/decorators/permissoes.decorator';
import { UsuarioAtual } from 'src/auth/decorators/usuario-atual.decorator';
import { AcessosAdminService } from './acessos-admin.service';
import { CreateGrupoDto } from './dto/create-grupo.dto';
import { UpdateGrupoDto } from './dto/update-grupo.dto';
import { VincularUsuarioGrupoDto } from './dto/vincular-usuario-grupo.dto';
import { AtualizarPermissoesUsuarioGrupoDto } from './dto/atualizar-permissoes-usuario-grupo.dto';
import { VincularProcessoGrupoDto } from './dto/vincular-processo-grupo.dto';

@ApiTags('Acessos Admin')
@ApiBearerAuth()
@Controller('acessos-admin')
export class AcessosAdminController {
  constructor(private readonly acessosAdminService: AcessosAdminService) {}

  @Permissoes('DEV')
  @Get('dev/grupos')
  @ApiOperation({ summary: 'Lista grupos de acesso cadastrados' })
  listarGrupos() {
    return this.acessosAdminService.listarGrupos();
  }

  @Permissoes('DEV')
  @Post('dev/grupos')
  @ApiOperation({ summary: 'Cria um grupo de acesso' })
  criarGrupo(@Body() dto: CreateGrupoDto, @UsuarioAtual() usuario: Usuario) {
    return this.acessosAdminService.criarGrupo(dto, usuario.id);
  }

  @Permissoes('DEV')
  @Patch('dev/grupos/:id')
  @ApiOperation({ summary: 'Atualiza um grupo de acesso' })
  atualizarGrupo(
    @Param('id') id: string,
    @Body() dto: UpdateGrupoDto,
    @UsuarioAtual() usuario: Usuario,
  ) {
    return this.acessosAdminService.atualizarGrupo(id, dto, usuario.id);
  }

  @Permissoes('DEV')
  @Delete('dev/grupos/:id')
  @ApiOperation({ summary: 'Desativa um grupo de acesso' })
  desativarGrupo(@Param('id') id: string, @UsuarioAtual() usuario: Usuario) {
    return this.acessosAdminService.desativarGrupo(id, usuario.id);
  }

  @Permissoes('DEV')
  @Post('dev/grupos/semeadura-padrao')
  @ApiOperation({
    summary: 'Cria/reativa grupos padrao (EXPEDIENTE, SERVIN, GABINETE)',
  })
  semearGruposPadrao(@UsuarioAtual() usuario: Usuario) {
    return this.acessosAdminService.semearGruposPadrao(usuario.id);
  }

  @Permissoes('DEV')
  @Get('dev/usuarios/:usuarioId/grupos')
  @ApiOperation({ summary: 'Lista vinculos de grupos de um usuario' })
  listarGruposUsuario(@Param('usuarioId') usuarioId: string) {
    return this.acessosAdminService.listarGruposUsuario(usuarioId);
  }

  @Permissoes('DEV')
  @Patch('dev/usuarios/:usuarioId/grupos/:grupoId')
  @ApiOperation({ summary: 'Cria/atualiza vinculo de usuario em grupo' })
  vincularUsuarioGrupo(
    @Param('usuarioId') usuarioId: string,
    @Param('grupoId') grupoId: string,
    @Body() dto: VincularUsuarioGrupoDto,
    @UsuarioAtual() usuario: Usuario,
  ) {
    return this.acessosAdminService.vincularUsuarioGrupo(
      usuarioId,
      grupoId,
      dto,
      usuario.id,
    );
  }

  @Permissoes('DEV')
  @Patch('dev/usuarios/:usuarioId/grupos/:grupoId/permissoes')
  @ApiOperation({
    summary: 'Atualiza permissoes combinaveis de usuario no grupo',
  })
  atualizarPermissoesUsuarioGrupo(
    @Param('usuarioId') usuarioId: string,
    @Param('grupoId') grupoId: string,
    @Body() dto: AtualizarPermissoesUsuarioGrupoDto,
    @UsuarioAtual() usuario: Usuario,
  ) {
    return this.acessosAdminService.atualizarPermissoesUsuarioGrupo(
      usuarioId,
      grupoId,
      dto,
      usuario.id,
    );
  }

  @Permissoes('DEV')
  @Get('dev/processos/:processoId/grupos')
  @ApiOperation({ summary: 'Lista vinculos de grupo de um processo' })
  listarGruposProcesso(@Param('processoId') processoId: string) {
    return this.acessosAdminService.listarGruposProcesso(processoId);
  }

  @Permissoes('DEV')
  @Patch('dev/processos/:processoId/grupos/:grupoId')
  @ApiOperation({ summary: 'Cria/atualiza vinculo processo-grupo' })
  vincularProcessoGrupo(
    @Param('processoId') processoId: string,
    @Param('grupoId') grupoId: string,
    @Body() dto: VincularProcessoGrupoDto,
    @UsuarioAtual() usuario: Usuario,
  ) {
    return this.acessosAdminService.vincularProcessoGrupo(
      processoId,
      grupoId,
      dto,
      usuario.id,
    );
  }

  @Permissoes('DEV')
  @Get('dev/matriz-permissoes')
  @ApiOperation({
    summary: 'Visualiza matriz de permissoes efetivas por usuario e grupo',
  })
  obterMatrizPermissoesEfetivas(@Query('usuarioId') usuarioId?: string) {
    return this.acessosAdminService.obterMatrizPermissoesEfetivas(usuarioId);
  }
}
