import { ApiProperty } from '@nestjs/swagger';
import { processo, andamento } from '@prisma/client';

/**
 * DTO de resposta para Processo
 *
 * Define como o processo será retornado pela API.
 * Inclui os andamentos relacionados para facilitar consultas.
 */
export class ProcessoResponseDto implements processo {
  @ApiProperty({ description: 'ID único do processo' })
  id: string;

  @ApiProperty({ description: 'Número SEI do processo' })
  numero_sei: string;

  @ApiProperty({ description: 'Assunto do processo' })
  assunto: string;

  @ApiProperty({ description: 'Unidade de origem do processo' })
  origem: string;

  @ApiProperty({ description: 'Data em que o gabinete recebeu o processo' })
  data_recebimento: Date;

  @ApiProperty({
    description: 'Data de resposta final ao solicitante',
    required: false,
  })
  data_resposta_final: Date | null;

  @ApiProperty({ description: 'Texto da resposta final', required: false })
  resposta_final: string | null;

  @ApiProperty({
    description: 'ID/Sigla da unidade respondida',
    required: false,
  })
  unidade_respondida_id: string | null;

  @ApiProperty({ description: 'Status ativo/inativo do processo' })
  ativo: boolean;

  @ApiProperty({ description: 'ID da unidade responsável' })
  unidade_id: string;

  @ApiProperty({ description: 'Data de criação' })
  criadoEm: Date;

  @ApiProperty({ description: 'Data da última atualização' })
  atualizadoEm: Date;

  @ApiProperty({
    description: 'Lista de andamentos do processo',
    type: 'array',
    required: false,
  })
  andamentos?: andamento[];
}

/**
 * DTO para resposta paginada de processos
 *
 * Usado quando há muitos processos e precisamos paginar os resultados
 */
export class ProcessoPaginadoResponseDto {
  @ApiProperty({ description: 'Total de processos encontrados' })
  total: number;

  @ApiProperty({ description: 'Página atual' })
  pagina: number;

  @ApiProperty({ description: 'Limite de itens por página' })
  limite: number;

  @ApiProperty({
    description: 'Lista de processos',
    type: [ProcessoResponseDto],
  })
  data: ProcessoResponseDto[];
}
