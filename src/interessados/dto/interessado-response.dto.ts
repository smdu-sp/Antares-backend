import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO de resposta para Interessado
 */
export class InteressadoResponseDto {
  @ApiProperty({ description: 'ID único do interessado' })
  id: string;

  @ApiProperty({ description: 'Nome do interessado' })
  valor: string;

  @ApiProperty({ description: 'Data de criação' })
  criadoEm: Date;
}
