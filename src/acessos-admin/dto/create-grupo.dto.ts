import { ApiProperty } from '@nestjs/swagger';
import { GrupoCodigo, GrupoTipo } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateGrupoDto {
  @ApiProperty({ enum: GrupoCodigo })
  @IsEnum(GrupoCodigo)
  codigo: GrupoCodigo;

  @ApiProperty({ enum: GrupoTipo })
  @IsEnum(GrupoTipo)
  tipo: GrupoTipo;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome: string;
}
