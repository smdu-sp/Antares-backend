import { ApiPropertyOptional } from '@nestjs/swagger';
import { $Enums } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export class AtualizarPermissoesDevDto {
  @ApiPropertyOptional({ enum: $Enums.Permissao })
  @IsOptional()
  @IsEnum($Enums.Permissao)
  permissao?: $Enums.Permissao;

  @ApiPropertyOptional({
    description: 'Permite ativar/desativar usuário no painel DEV',
  })
  @IsOptional()
  @IsBoolean()
  status?: boolean;
}
