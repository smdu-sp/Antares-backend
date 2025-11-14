import { ApiProperty } from '@nestjs/swagger';
import { Unidade } from '@prisma/client';

/**
 * DTO de resposta para Unidade
 */
export class UnidadeResponseDto implements Unidade {
  @ApiProperty({ description: 'ID único da unidade' })
  id: string;

  @ApiProperty({ description: 'Nome completo da unidade' })
  nome: string;

  @ApiProperty({ description: 'Sigla da unidade' })
  sigla: string;

  @ApiProperty({ description: 'Data de criação' })
  criadoEm: Date;

  @ApiProperty({ description: 'Data da última atualização' })
  atualizadoEm: Date;
}

/**
 * DTO para resposta paginada de unidades
 */
export class UnidadePaginadoResponseDto {
  @ApiProperty({ description: 'Total de unidades encontradas' })
  total: number;

  @ApiProperty({ description: 'Página atual' })
  pagina: number;

  @ApiProperty({ description: 'Limite de itens por página' })
  limite: number;

  @ApiProperty({ description: 'Lista de unidades', type: [UnidadeResponseDto] })
  data: UnidadeResponseDto[];
}



