import { ApiProperty } from '@nestjs/swagger';
import { Permissao } from '@prisma/client';
import { IsDate, IsString, IsUUID } from 'class-validator';

export class EuResponseDTO {
  @ApiProperty()
  @IsUUID()
  id: string;
  @ApiProperty()
  @IsString()
  nome: string;
  @ApiProperty()
  @IsString()
  login: string;
  @ApiProperty()
  @IsString()
  email: string;
  @ApiProperty()
  status: boolean;
  @ApiProperty()
  @IsDate()
  ultimoLogin: Date;
  @ApiProperty()
  @IsDate()
  criadoEm: Date;
  @ApiProperty()
  @IsDate()
  atualizadoEm: Date;
  @ApiProperty()
  @IsString()
  avatar?: string;
  @ApiProperty()
  permissao: Permissao;
}
