import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  MinLength,
  MaxLength,
  IsDateString,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class CreateProcessoDto {
  @ApiProperty({
    description: 'Número SEI do processo (único)',
    example: '1234567',
  })
  @IsString({ message: 'Número SEI deve ser texto.' })
  @MinLength(3, { message: 'Número SEI deve ter ao menos 3 caracteres.' })
  numero_sei: string;

  @ApiProperty({
    description: 'Assunto do processo (máximo 5000 caracteres)',
    example:
      'Solicitação de licença para obra com descrição detalhada dos requisitos técnicos, localização, impacto ambiental e documentação necessária',
  })
  @IsString({ message: 'Assunto deve ser texto.' })
  @MinLength(5, { message: 'Assunto deve ter ao menos 5 caracteres.' })
  @MaxLength(5000, { message: 'Assunto deve ter no máximo 5000 caracteres.' })
  assunto: string;

  @ApiProperty({
    description: 'Unidade de origem do processo',
    example: 'EXPEDIENTE',
  })
  @IsString({ message: 'Origem deve ser texto.' })
  @MinLength(2, { message: 'Origem deve ter ao menos 2 caracteres.' })
  origem: string;

  @ApiProperty({
    description: 'ID do interessado no processo',
    example: 'uuid-do-interessado',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: 'ID do interessado deve ser um UUID válido.' })
  interessado_id?: string;

  @ApiProperty({
    description: 'ID da unidade remetente do processo',
    example: 'uuid-da-unidade-remetente',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: 'ID da unidade remetente deve ser um UUID válido.' })
  unidade_remetente_id?: string;

  @ApiProperty({
    description: 'Data em que o gabinete recebeu o processo (ISO 8601)',
    example: '2025-11-28T00:00:00.000Z',
    required: false,
    default: 'Data/hora atual',
  })
  @IsOptional()
  @IsDateString(
    {},
    {
      message:
        'Data de recebimento deve ser uma data válida no formato ISO 8601.',
    },
  )
  data_recebimento?: string;

  @ApiProperty({
    description: 'Prazo limite para conclusão do processo (ISO 8601)',
    example: '2025-12-31T00:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Prazo deve ser uma data válida no formato ISO 8601.' },
  )
  prazo?: string;
}
