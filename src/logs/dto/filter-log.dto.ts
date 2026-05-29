import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { $Enums } from '@prisma/client';

/**
 * DTO para filtros de busca de logs
 */
export class FilterLogDto {
  @IsOptional()
  @IsEnum($Enums.TipoAcao)
  tipoAcao?: $Enums.TipoAcao;

  @IsOptional()
  @IsString()
  entidadeTipo?: string;

  @IsOptional()
  @IsUUID()
  entidadeId?: string;

  @IsOptional()
  @IsUUID()
  usuario_id?: string;

  @IsOptional()
  @IsString()
  dataInicio?: string;

  @IsOptional()
  @IsString()
  dataFim?: string;
}
