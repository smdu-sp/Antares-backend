import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsDateString, MinLength } from 'class-validator';

/**
 * DTO para criar resposta final de um processo
 *
 * Representa o fechamento/conclusão de um processo com resposta ao solicitante
 */
export class CreateRespostaFinalDto {
  @ApiProperty({
    description: 'ID do processo a ser finalizado',
    example: 'uuid-do-processo',
  })
  @IsString({ message: 'ID do processo deve ser texto.' })
  processo_id: string;

  @ApiProperty({
    description:
      'Data em que o gabinete respondeu o processo ao solicitante (ISO 8601)',
    example: '2025-11-28T00:00:00.000Z',
  })
  @IsDateString(
    {},
    {
      message:
        'Data de resposta final deve ser uma data válida no formato ISO 8601.',
    },
  )
  data_resposta_final: string;

  @ApiProperty({
    description: 'Texto da resposta final dada ao processo',
    example: 'Processo analisado e aprovado conforme normativas vigentes.',
  })
  @IsString({ message: 'Resposta deve ser texto.' })
  @MinLength(10, { message: 'Resposta deve ter ao menos 10 caracteres.' })
  resposta_final: string;

  @ApiProperty({
    description: 'ID/Sigla da unidade que foi respondida',
    example: 'COORDENADORIA_JURIDICA',
  })
  @IsString({ message: 'Unidade respondida deve ser texto.' })
  @MinLength(2, {
    message: 'Unidade respondida deve ter ao menos 2 caracteres.',
  })
  unidade_respondida_id: string;
}
