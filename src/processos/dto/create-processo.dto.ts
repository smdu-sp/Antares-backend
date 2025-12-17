import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, IsDateString, IsOptional } from 'class-validator';

/**
 * DTO (Data Transfer Object) para criar um novo processo
 *
 * DTOs são objetos que definem a estrutura dos dados que serão recebidos
 * pela API. Eles servem para:
 * 1. Validar os dados de entrada
 * 2. Documentar a API (Swagger)
 * 3. Separar a camada de apresentação da camada de negócio
 */
export class CreateProcessoDto {
  @ApiProperty({
    description: 'Número SEI do processo (único)',
    example: '1234567',
  })
  @IsString({ message: 'Número SEI deve ser texto.' })
  @MinLength(3, { message: 'Número SEI deve ter ao menos 3 caracteres.' })
  numero_sei: string;

  @ApiProperty({
    description: 'Assunto do processo',
    example: 'Solicitação de licença para obra',
  })
  @IsString({ message: 'Assunto deve ser texto.' })
  @MinLength(5, { message: 'Assunto deve ter ao menos 5 caracteres.' })
  assunto: string;

  @ApiProperty({
    description: 'Unidade de origem do processo',
    example: 'EXPEDIENTE',
  })
  @IsString({ message: 'Origem deve ser texto.' })
  @MinLength(2, { message: 'Origem deve ter ao menos 2 caracteres.' })
  origem: string;

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
