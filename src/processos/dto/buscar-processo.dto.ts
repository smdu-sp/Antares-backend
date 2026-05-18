// arquivo buscar-processo.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO para busca e filtros de processos
 *
 * Define todos os parâmetros aceitos na busca de processos:
 * - Paginação (pagina, limite)
 * - Busca geral (busca em todos os campos)
 * - Buscas específicas (interessado, unidadeRemetente)
 * - Filtros rápidos (vencendoHoje, atrasados, concluidos)
 */
export class BuscarProcessoDto {
  @ApiProperty({
    description: 'Número da página',
    required: false,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  pagina?: number = 1;

  @ApiProperty({
    description: 'Limite de itens por página',
    required: false,
    default: 10,
    example: 10,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  limite?: number = 10;

  @ApiProperty({
    description:
      'Termo de busca geral. Pesquisa em todos os campos do processo e andamentos (número SEI, assunto, origem, observações, etc.)',
    required: false,
    example: 'licença obra',
  })
  @IsOptional()
  @IsString()
  busca?: string;

  @ApiProperty({
    description: 'Busca específica no campo Interessado do processo',
    required: false,
    example: 'João Silva',
  })
  @IsOptional()
  @IsString()
  interessado?: string;

  @ApiProperty({
    description: 'Busca específica no campo Unidade Remetente do processo',
    required: false,
    example: 'COJUR',
  })
  @IsOptional()
  @IsString()
  unidadeRemetente?: string;

  @ApiProperty({
    description: 'Busca específica no campo Unidade Destino do processo',
    required: false,
    example: 'COINFRA',
  })
  @IsOptional()
  @IsString()
  unidadeDestino?: string;

  @ApiProperty({
    description:
      'Busca combinada por unidade (remetente OU destino) — nome ou sigla',
    required: false,
    example: 'COINFRA',
  })
  @IsOptional()
  @IsString()
  unidade?: string;

  @ApiProperty({
    description:
      'Filtro: processos vencendo hoje (prazo ou prorrogação vence hoje)',
    required: false,
    default: false,
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  vencendoHoje?: boolean = false;

  @ApiProperty({
    description: 'Filtro: processos atrasados (prazo ou prorrogação já venceu)',
    required: false,
    default: false,
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  atrasados?: boolean = false;

  @ApiProperty({
    description: 'Filtro: processos concluídos (com andamentos concluídos)',
    required: false,
    default: false,
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  concluidos?: boolean = false;
}
