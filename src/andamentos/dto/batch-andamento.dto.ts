import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsString,
  IsOptional,
  IsDateString,
  ArrayMinSize,
  IsNotEmpty,
} from 'class-validator';

/**
 * DTO para operações em lote em andamentos
 *
 * Permite excluir, prorrogar ou concluir múltiplos andamentos de uma vez
 */
export class BatchAndamentoDto {
  @ApiProperty({
    description: 'IDs dos andamentos a serem processados',
    example: ['uuid-andamento-1', 'uuid-andamento-2'],
  })
  @IsArray({ message: 'IDs deve ser um array.' })
  @ArrayMinSize(1, { message: 'Deve haver pelo menos um ID.' })
  @IsString({ each: true, message: 'Cada ID deve ser uma string.' })
  @IsNotEmpty({ each: true, message: 'Cada ID deve ser não vazio.' })
  ids: string[];

  @ApiProperty({
    description: 'Operação a ser realizada: excluir, prorrogar ou concluir',
    example: 'excluir',
    enum: ['excluir', 'prorrogar', 'concluir'],
  })
  @IsString({ message: 'Operação deve ser texto.' })
  operacao: 'excluir' | 'prorrogar' | 'concluir';

  @ApiProperty({
    description:
      'Nova data limite para prorrogação (obrigatório apenas para prorrogar). Aceita "novaDataLimite" ou "prazo"',
    example: '2025-12-31T00:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString(
    {},
    {
      message: 'Nova data limite deve ser uma data válida no formato ISO 8601.',
    },
  )
  novaDataLimite?: string;

  @ApiProperty({
    description:
      'Alternativa para novaDataLimite - data de prorrogação (obrigatório apenas para prorrogar)',
    example: '2026-01-08',
    required: false,
  })
  @IsOptional()
  @IsDateString(
    {},
    {
      message: 'Prazo deve ser uma data válida no formato ISO 8601.',
    },
  )
  prazo?: string;
}
