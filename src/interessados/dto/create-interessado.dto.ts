import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

/**
 * DTO para criar um novo interessado
 */
export class CreateInteressadoDto {
  @ApiProperty({
    description: 'Nome do interessado',
    example: 'João da Silva',
  })
  @IsString({ message: 'Nome deve ser texto.' })
  @MinLength(3, { message: 'Nome deve ter ao menos 3 caracteres.' })
  @MaxLength(255, { message: 'Nome deve ter no máximo 255 caracteres.' })
  valor: string;
}
