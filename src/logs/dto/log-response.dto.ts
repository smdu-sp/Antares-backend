import { $Enums, Log } from '@prisma/client';

/**
 * DTO de resposta para logs
 * Define a estrutura dos dados retornados ao consultar logs
 */
export class LogResponseDto {
  id: string;
  tipoAcao: $Enums.TipoAcao;
  descricao: string;
  entidadeTipo: string;
  entidadeId: string;
  dadosAntigos?: string | null;
  dadosNovos?: string | null;
  criadoEm: Date;
  usuario_id: string;
  usuario?: {
    id: string;
    nome: string;
    login: string;
  };
}

/**
 * DTO de resposta paginada para logs
 */
export class LogPaginadoResponseDto {
  total: number;
  pagina: number;
  limite: number;
  data: Log[];
}
