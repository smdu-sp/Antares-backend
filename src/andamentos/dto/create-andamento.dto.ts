import { ApiProperty } from '@nestjs/swagger';
import { $Enums } from '@prisma/client';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
  MinLength,
} from 'class-validator';

/**
 * DTO para criar um novo andamento
 *
 * Representa o envio de um processo de uma unidade (origem) para outra (destino)
 */
export class CreateAndamentoDto {
  @ApiProperty({
    description: 'ID do processo relacionado',
    example: 'uuid-do-processo',
  })
  @IsString({ message: 'ID do processo deve ser texto.' })
  processo_id: string;

  @ApiProperty({
    description: 'Unidade de origem (de onde o processo está saindo)',
    example: 'EXPEDIENTE',
  })
  @IsString({ message: 'Origem deve ser texto.' })
  @MinLength(2, { message: 'Origem deve ter ao menos 2 caracteres.' })
  origem: string;

  @ApiProperty({
    description: 'Unidade de destino (para onde o processo está indo)',
    example: 'COORDENADORIA_JURIDICA',
  })
  @IsString({ message: 'Destino deve ser texto.' })
  @MinLength(2, { message: 'Destino deve ter ao menos 2 caracteres.' })
  destino: string;

  @ApiProperty({
    description:
      'Data em que o gabinete enviou o processo para a unidade (ISO 8601)',
    example: '2025-11-28T00:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Data de envio deve ser uma data válida no formato ISO 8601.' },
  )
  data_envio?: string;

  @ApiProperty({
    description: 'Data limite para retorno do processo (ISO 8601)',
    example: '2025-12-31T23:59:59.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Prazo deve ser uma data válida no formato ISO 8601.' },
  )
  prazo?: string; // Será convertido para Date no service

  @ApiProperty({
    description: 'Status do andamento',
    enum: $Enums.StatusAndamento,
    default: 'EM_ANDAMENTO',
    required: false,
  })
  @IsOptional()
  @IsEnum($Enums.StatusAndamento, { message: 'Status inválido.' })
  status?: $Enums.StatusAndamento;

  @ApiProperty({
    description: 'Observações sobre o andamento',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Observação deve ser texto.' })
  observacao?: string;

  @ApiProperty({
    description: 'Assunto específico deste andamento',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Assunto deve ser texto.' })
  assunto?: string;
}
