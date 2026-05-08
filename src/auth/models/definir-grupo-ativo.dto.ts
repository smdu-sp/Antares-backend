import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class DefinirGrupoAtivoDto {
  @ApiProperty({
    description: 'ID do grupo que sera usado como contexto ativo',
  })
  @IsUUID('4', { message: 'grupoId deve ser um UUID valido.' })
  grupoId: string;
}
