import { ApiPropertyOptional } from '@nestjs/swagger';
import { PermissaoGrupo } from '@prisma/client';
import { IsBoolean, IsOptional } from 'class-validator';
import { IsEnum } from 'class-validator';

export class VincularUsuarioGrupoDto {
  @ApiPropertyOptional({
    description: 'Ativa/desativa o vinculo de usuario no grupo',
  })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @ApiPropertyOptional({
    enum: PermissaoGrupo,
    description: 'Papel do usuário dentro do grupo (ADM, TEC, USR)',
  })
  @IsOptional()
  @IsEnum(PermissaoGrupo)
  permissao_grupo?: PermissaoGrupo;
}
