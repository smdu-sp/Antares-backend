import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsArray, IsString } from 'class-validator';

/**
 * DTO para parâmetros de exportação
 */
export class ExportParamsDto {
  @ApiProperty({
    description: 'IDs específicos para exportar (opcional)',
    required: false,
    example: ['uuid-1', 'uuid-2'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ids?: string[];

  @ApiProperty({
    description: 'Termo de busca (opcional)',
    required: false,
    example: 'licença',
  })
  @IsOptional()
  @IsString()
  busca?: string;

  @ApiProperty({
    description: 'Busca específica no campo Interessado (opcional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  interessado?: string;

  @ApiProperty({
    description: 'Busca específica na Unidade Remetente (opcional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  unidadeRemetente?: string;

  @ApiProperty({
    description: 'Busca específica na Unidade Destino (opcional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  unidadeDestino?: string;

  @ApiProperty({
    description: 'Filtro: processos vencendo hoje',
    required: false,
    default: false,
  })
  @IsOptional()
  vencendoHoje?: boolean;

  @ApiProperty({
    description: 'Filtro: processos atrasados',
    required: false,
    default: false,
  })
  @IsOptional()
  atrasados?: boolean;

  @ApiProperty({
    description: 'Filtro: processos concluídos',
    required: false,
    default: false,
  })
  @IsOptional()
  concluidos?: boolean;

  @ApiProperty({
    description: 'Incluir dados do processo na exportação',
    required: false,
    default: true,
  })
  @IsOptional()
  incluirProcesso?: boolean;

  @ApiProperty({
    description: 'Incluir andamentos do processo',
    required: false,
    default: false,
  })
  @IsOptional()
  incluirAndamentos?: boolean;
}
