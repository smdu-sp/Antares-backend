import { ApiPropertyOptional } from '@nestjs/swagger';
import { NivelVisaoGrupoProcesso } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export class VincularProcessoGrupoDto {
  @ApiPropertyOptional({ enum: NivelVisaoGrupoProcesso })
  @IsOptional()
  @IsEnum(NivelVisaoGrupoProcesso)
  nivelVisao?: NivelVisaoGrupoProcesso;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
