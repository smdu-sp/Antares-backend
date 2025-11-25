import { ApiProperty } from '@nestjs/swagger';
import { andamento, processo, Usuario, StatusAndamento } from '@prisma/client';

/**
 * DTO de resposta para Andamento
 *
 * Inclui o processo relacionado para facilitar consultas
 */
export class AndamentoResponseDto {
  @ApiProperty({ description: 'ID único do andamento' })
  id: string;

  @ApiProperty({ description: 'Unidade de origem' })
  origem: string;

  @ApiProperty({ description: 'Unidade de destino' })
  destino: string;

  @ApiProperty({ description: 'Data limite para retorno' })
  prazo: Date;

  @ApiProperty({
    description: 'Nova data limite se prorrogado',
    required: false,
  })
  prorrogacao: Date | null;

  @ApiProperty({ description: 'Data de resposta/retorno', required: false })
  resposta: Date | null;

  @ApiProperty({ description: 'Status do andamento', enum: StatusAndamento })
  status: StatusAndamento;

  @ApiProperty({ description: 'Observações', required: false })
  observacao: string | null;

  @ApiProperty({ description: 'Data de criação' })
  criadoEm: Date;

  @ApiProperty({ description: 'Data da última atualização' })
  atualizadoEm: Date;

  @ApiProperty({ description: 'ID do processo relacionado' })
  processo_id: string;

  @ApiProperty({ description: 'ID do usuário que criou o andamento' })
  usuario_id: string;

  @ApiProperty({
    description: 'ID do usuário que prorrogou o prazo',
    required: false,
  })
  usuario_prorrogacao_id?: string | null;

  @ApiProperty({ description: 'Processo relacionado', required: false })
  processo?: processo;

  @ApiProperty({
    description: 'Usuário que criou o andamento',
    required: false,
  })
  usuario?: Usuario;

  @ApiProperty({
    description: 'Usuário que prorrogou o prazo',
    required: false,
  })
  usuarioProrrogacao?: Usuario | null;
}
