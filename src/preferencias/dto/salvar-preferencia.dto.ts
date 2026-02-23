import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class SalvarPreferenciaDto {
  @ApiProperty({
    description: 'Chave identificadora da preferência',
    example: 'ag-grid-column-state',
  })
  @IsString()
  @IsNotEmpty()
  chave: string;

  @ApiProperty({
    description: 'Valor da preferência em formato JSON (string)',
    example: JSON.stringify([
      { colId: 'numero_sei', width: 150, hide: false },
      { colId: 'assunto', width: 300, hide: false },
    ]),
  })
  @IsString()
  @IsNotEmpty()
  valor: string;
}
