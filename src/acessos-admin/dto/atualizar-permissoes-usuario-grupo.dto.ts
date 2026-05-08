import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class AtualizarPermissoesUsuarioGrupoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  visualizar_proprios?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  visualizar_grupo?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  modificar_proprios?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  modificar_grupo?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  excluir?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
