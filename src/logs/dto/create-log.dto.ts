import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { $Enums } from '@prisma/client';

/**
 * DTO para criação de logs
 * Define os dados necessários para registrar uma ação no sistema
 */
export class CreateLogDto {
  @IsEnum($Enums.TipoAcao)
  @IsNotEmpty({ message: 'Tipo de ação é obrigatório' })
  tipoAcao: $Enums.TipoAcao;

  @IsString()
  @IsNotEmpty({ message: 'Descrição é obrigatória' })
  descricao: string;

  @IsString()
  @IsNotEmpty({ message: 'Tipo da entidade é obrigatório' })
  entidadeTipo: string;

  @IsUUID()
  @IsNotEmpty({ message: 'ID da entidade é obrigatório' })
  entidadeId: string;

  @IsUUID()
  @IsNotEmpty({ message: 'ID do usuário é obrigatório' })
  usuario_id: string;

  @IsOptional()
  dadosAntigos?: any;

  @IsOptional()
  dadosNovos?: any;
}
