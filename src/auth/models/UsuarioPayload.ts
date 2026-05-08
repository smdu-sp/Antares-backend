import { Permissao } from '@prisma/client';

export interface UsuarioPayload {
  sub: string;
  login: string;
  email: string;
  nome: string;
  nomeSocial?: string;
  status: boolean;
  avatar?: string;
  permissao: Permissao;
  iat?: number;
  exp?: number;
}
