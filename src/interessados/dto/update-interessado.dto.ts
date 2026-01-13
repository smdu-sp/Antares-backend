import { PartialType } from '@nestjs/swagger';
import { CreateInteressadoDto } from './create-interessado.dto';

/**
 * DTO para atualizar um interessado
 */
export class UpdateInteressadoDto extends PartialType(CreateInteressadoDto) {}
