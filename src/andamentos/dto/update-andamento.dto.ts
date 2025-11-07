import { PartialType } from '@nestjs/swagger';
import { CreateAndamentoDto } from './create-andamento.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsDateString } from 'class-validator';

/**
 * DTO para atualizar um andamento
 * 
 * Permite atualizar:
 * - Origem e Destino
 * - Prazo
 * - Data de prorrogação (status é definido automaticamente como PRORROGADO)
 * - Data de conclusão (status é definido automaticamente como CONCLUIDO)
 * - Observações
 * 
 * NOTA: O status NÃO pode ser atualizado manualmente. Ele é definido automaticamente:
 * - CONCLUIDO: quando há data de conclusão
 * - PRORROGADO: quando há data de prorrogação (sem conclusão)
 * - EM_ANDAMENTO: quando não há conclusão nem prorrogação
 */
export class UpdateAndamentoDto extends PartialType(CreateAndamentoDto) {
  @ApiProperty({
    description: 'Nova data limite se o processo foi prorrogado. Envie null para limpar.',
    required: false,
    nullable: true,
  })
  @IsOptional()
  prorrogacao?: string | null;

  @ApiProperty({
    description: 'Data de conclusão/retorno do processo. Envie null para limpar.',
    required: false,
    nullable: true,
  })
  @IsOptional()
  conclusao?: string | null;
}

