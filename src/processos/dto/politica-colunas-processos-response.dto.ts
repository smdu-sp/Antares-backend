import { ApiProperty } from '@nestjs/swagger';
import { GrupoCodigo } from '@prisma/client';

class GrupoAtivoColunasDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: GrupoCodigo })
  codigo: GrupoCodigo;

  @ApiProperty()
  nome: string;
}

export class PoliticaColunasProcessosResponseDto {
  @ApiProperty({ type: GrupoAtivoColunasDto })
  grupoAtivo: GrupoAtivoColunasDto;

  @ApiProperty({
    description:
      'Chave de preferencia recomendada para salvar somente a ordem de colunas do usuario',
  })
  chavePreferenciaOrdem: string;

  @ApiProperty({
    type: [String],
    description:
      'Colunas fixas do grid que sempre permanecem para todos os grupos',
  })
  colunasFixas: string[];

  @ApiProperty({
    type: [String],
    description: 'Colunas oficiais disponiveis para o grupo ativo',
  })
  colunasDisponiveis: string[];

  @ApiProperty({
    type: [String],
    description: 'Ordem oficial padrao por grupo',
  })
  ordemPadrao: string[];

  @ApiProperty({
    type: [String],
    description:
      'Ordem preferida do usuario lida de preferencias (somente colunas permitidas)',
  })
  ordemUsuario: string[];

  @ApiProperty({
    type: [String],
    description:
      'Ordem final efetiva para renderizacao (ordemUsuario + faltantes na ordemPadrao)',
  })
  ordemEfetiva: string[];
}
