import { PartialType } from '@nestjs/swagger';
import { CreateProcessoDto } from './create-processo.dto';

/**
 * DTO para atualizar um processo
 *
 * Usa PartialType que torna todos os campos opcionais,
 * permitindo atualizar apenas alguns campos do processo
 */
export class UpdateProcessoDto extends PartialType(CreateProcessoDto) {
  // Campos adicionais para compatibilidade com nomes alternativos
  interessado?: string; // Nome do interessado (para busca/criação)
  unidade_remetente?: string; // Nome/sigla da unidade remetente
}
