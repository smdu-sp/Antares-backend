import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

/**
 * DTO (Data Transfer Object) para criar uma nova unidade
 */
export class CreateUnidadeDto {
  @ApiProperty({
    description: 'Nome completo da unidade',
    example: 'Coordenadoria Jurídica',
  })
  @IsString({ message: 'Nome deve ser texto.' })
  @MinLength(3, { message: 'Nome deve ter ao menos 3 caracteres.' })
  nome: string;

  @ApiProperty({
    description: 'Sigla da unidade (única)',
    example: 'COJUR',
  })
  @IsString({ message: 'Sigla deve ser texto.' })
  @MinLength(2, { message: 'Sigla deve ter ao menos 2 caracteres.' })
  @MaxLength(20, { message: 'Sigla deve ter no máximo 20 caracteres.' })
  sigla: string;
}



