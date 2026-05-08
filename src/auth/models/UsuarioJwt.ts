import { Permissao } from '@prisma/client';

export interface UsuarioJwt {
  id: string;
  login: string;
  nome: string;
  nomeSocial?: string;
  email: string;
  status: boolean;
  avatar?: string;
  permissao: Permissao;
}
