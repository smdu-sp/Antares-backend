import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsuariosService } from 'src/usuarios/usuarios.service';
import { GrupoCodigo, GrupoTipo, Usuario } from '@prisma/client';
import { UsuarioPayload } from './models/UsuarioPayload';
import { JwtService } from '@nestjs/jwt';
import { UsuarioToken } from './models/UsuarioToken';
import { UsuarioJwt } from './models/UsuarioJwt';
import { Client as LdapClient } from 'ldapts';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AuthService {
  private readonly CHAVE_GRUPO_ATIVO = 'auth.grupo_ativo_id';

  private async garantirGrupoGlobal() {
    const grupoGlobal = await this.prisma.grupo.upsert({
      where: {
        codigo_tipo: {
          codigo: GrupoCodigo.GLOBAL,
          tipo: GrupoTipo.DIVISAO,
        },
      },
      create: {
        codigo: GrupoCodigo.GLOBAL,
        tipo: GrupoTipo.DIVISAO,
        nome: 'Contexto Global (DEV)',
        ativo: true,
      },
      update: {
        nome: 'Contexto Global (DEV)',
        ativo: true,
      },
      select: {
        id: true,
        codigo: true,
        nome: true,
        tipo: true,
      },
    });

    return grupoGlobal;
  }

  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async obterGrupoAtivo(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { permissao: true },
    });

    if (usuario?.permissao === 'DEV') {
      const grupoGlobal = await this.garantirGrupoGlobal();

      const vinculos = await this.prisma.usuarioGrupo.findMany({
        where: {
          usuario_id: usuarioId,
          ativo: true,
          grupo: { ativo: true },
        },
        include: {
          grupo: {
            select: {
              id: true,
              codigo: true,
              nome: true,
              tipo: true,
            },
          },
        },
        orderBy: [{ grupo: { codigo: 'asc' } }, { criadoEm: 'asc' }],
      });

      const vinculoGlobal = vinculos.find(
        (item) =>
          item.grupo.codigo === GrupoCodigo.GLOBAL &&
          item.grupo.tipo === GrupoTipo.DIVISAO,
      );

      if (vinculos.length === 0) {
        return {
          grupoAtivo: null,
          origem: null,
          gruposDisponiveis: [],
        };
      }

      const preferencia = await this.prisma.preferenciasUsuario.findUnique({
        where: {
          usuario_id_chave: {
            usuario_id: usuarioId,
            chave: this.CHAVE_GRUPO_ATIVO,
          },
        },
        select: {
          valor: true,
          ativo: true,
        },
      });

      const preferidoId =
        preferencia?.ativo && preferencia.valor ? preferencia.valor : null;

      const vinculoAtivo =
        (preferidoId
          ? vinculos.find((item) => item.grupo_id === preferidoId)
          : null) ||
        vinculoGlobal ||
        vinculos[0];

      if (
        !preferencia?.ativo ||
        !preferidoId ||
        preferidoId !== vinculoAtivo.grupo.id
      ) {
        await this.prisma.preferenciasUsuario.upsert({
          where: {
            usuario_id_chave: {
              usuario_id: usuarioId,
              chave: this.CHAVE_GRUPO_ATIVO,
            },
          },
          create: {
            usuario_id: usuarioId,
            chave: this.CHAVE_GRUPO_ATIVO,
            valor: vinculoAtivo.grupo.id,
            ativo: true,
          },
          update: {
            valor: vinculoAtivo.grupo.id,
            ativo: true,
            atualizadoEm: new Date(),
          },
        });
      }

      const gruposDisponiveis = [
        ...vinculos
          .map((item) => item.grupo)
          .filter((item) => item.id !== vinculoAtivo.grupo.id),
      ];

      return {
        grupoAtivo: vinculoAtivo.grupo,
        origem:
          preferidoId && preferidoId === vinculoAtivo.grupo.id
            ? 'preferencia'
            : vinculoAtivo.grupo.id === grupoGlobal.id
              ? 'fallback-global-dev'
              : 'fallback',
        gruposDisponiveis: [vinculoAtivo.grupo, ...gruposDisponiveis],
      };
    }

    const vinculos = await this.prisma.usuarioGrupo.findMany({
      where: {
        usuario_id: usuarioId,
        ativo: true,
        grupo: { ativo: true },
      },
      include: {
        grupo: {
          select: {
            id: true,
            codigo: true,
            nome: true,
            tipo: true,
          },
        },
      },
      orderBy: [{ grupo: { codigo: 'asc' } }, { criadoEm: 'asc' }],
    });

    if (vinculos.length === 0) {
      return {
        grupoAtivo: null,
        origem: null,
        gruposDisponiveis: [],
      };
    }

    const preferencia = await this.prisma.preferenciasUsuario.findUnique({
      where: {
        usuario_id_chave: {
          usuario_id: usuarioId,
          chave: this.CHAVE_GRUPO_ATIVO,
        },
      },
      select: {
        valor: true,
        ativo: true,
      },
    });

    const preferidoId =
      preferencia?.ativo && preferencia.valor ? preferencia.valor : null;

    const ativo =
      (preferidoId
        ? vinculos.find((item) => item.grupo_id === preferidoId)
        : null) || vinculos[0];

    if (!preferencia?.ativo || !preferidoId || preferidoId !== ativo.grupo.id) {
      await this.prisma.preferenciasUsuario.upsert({
        where: {
          usuario_id_chave: {
            usuario_id: usuarioId,
            chave: this.CHAVE_GRUPO_ATIVO,
          },
        },
        create: {
          usuario_id: usuarioId,
          chave: this.CHAVE_GRUPO_ATIVO,
          valor: ativo.grupo.id,
          ativo: true,
        },
        update: {
          valor: ativo.grupo.id,
          ativo: true,
          atualizadoEm: new Date(),
        },
      });
    }

    return {
      grupoAtivo: ativo.grupo,
      origem:
        preferidoId && preferidoId === ativo.grupo.id
          ? 'preferencia'
          : 'fallback',
      gruposDisponiveis: vinculos.map((item) => item.grupo),
    };
  }

  async definirGrupoAtivo(usuarioId: string, grupoId: string) {
    const vinculo = await this.prisma.usuarioGrupo.findFirst({
      where: {
        usuario_id: usuarioId,
        grupo_id: grupoId,
        ativo: true,
        grupo: { ativo: true },
      },
      include: {
        grupo: {
          select: {
            id: true,
            codigo: true,
            nome: true,
            tipo: true,
          },
        },
      },
    });

    if (!vinculo) {
      throw new ForbiddenException(
        'Grupo informado nao esta vinculado ao usuario.',
      );
    }

    await this.prisma.preferenciasUsuario.upsert({
      where: {
        usuario_id_chave: {
          usuario_id: usuarioId,
          chave: this.CHAVE_GRUPO_ATIVO,
        },
      },
      create: {
        usuario_id: usuarioId,
        chave: this.CHAVE_GRUPO_ATIVO,
        valor: grupoId,
        ativo: true,
      },
      update: {
        valor: grupoId,
        ativo: true,
        atualizadoEm: new Date(),
      },
    });

    return {
      sucesso: true,
      grupoAtivo: vinculo.grupo,
    };
  }

  async login(usuario: Usuario): Promise<UsuarioToken> {
    const { access_token, refresh_token } = await this.getTokens(usuario);
    return { access_token, refresh_token };
  }

  async refresh(usuario: Usuario) {
    const { access_token, refresh_token } = await this.getTokens(usuario);
    return { access_token, refresh_token };
  }

  async getTokens(usuario: UsuarioJwt) {
    const { id, login, nome, nomeSocial, email, status, avatar, permissao } =
      usuario;
    const payload: UsuarioPayload = {
      sub: id,
      login,
      nome,
      nomeSocial,
      email,
      status,
      avatar,
      permissao,
    };
    const access_token = await this.jwtService.signAsync(payload, {
      expiresIn: '15m',
      secret: process.env.JWT_SECRET,
    });
    const refresh_token = await this.jwtService.signAsync(payload, {
      expiresIn: '7d',
      secret: process.env.RT_SECRET,
    });
    return { access_token, refresh_token };
  }

  async validateUser(login: string, senha: string) {
    console.log(`[AUTH] Tentativa de login: "${login}"`);

    let usuario = await this.usuariosService.buscarPorLogin(login);

    // Verifica se o usuário existe no banco local
    if (!usuario) {
      console.error('❌ Usuário não encontrado no banco de dados:', login);
      throw new UnauthorizedException(
        'Usuário não encontrado no sistema. Entre em contato com o administrador.',
      );
    }

    console.log(`[AUTH] Usuário encontrado no banco: id=${usuario.id}, status=${usuario.status}`);

    // Verifica se o usuário está ativo
    if (usuario.status === false) {
      console.error('❌ Usuário desativado:', login);
      throw new UnauthorizedException('Usuário desativado.');
    }

    // Em ambiente local, pula a validação LDAP
    const environment = process.env.ENVIRONMENT?.replace(/"/g, '').toLowerCase();
    console.log(`[AUTH] Ambiente detectado: "${environment}"`);

    if (environment === 'local') {
      console.log('[AUTH] Ambiente local — pulando validação LDAP');
      return usuario;
    }

    // Validação LDAP em ambiente de produção
    const ldapServer = process.env.LDAP_SERVER?.replace(/"/g, '');
    const ldapDomain = process.env.LDAP_DOMAIN?.replace(/"/g, '');
    const ldapUser = `${login}${ldapDomain}`;

    console.log(`[AUTH] Iniciando conexão LDAP — servidor: "${ldapServer}"`);
    console.log(`[AUTH] Usuário LDAP: "${ldapUser}"`);

    const client: LdapClient = new LdapClient({ url: ldapServer });

    try {
      await client.bind(ldapUser, senha);
      console.log(`[AUTH] ✅ Bind LDAP bem-sucedido para: "${ldapUser}"`);
      await client.unbind();
      return usuario;
    } catch (error) {
      console.error(`[AUTH] ❌ Falha no bind LDAP para "${ldapUser}": ${error.message}`);
      console.error(`[AUTH] Código do erro LDAP:`, error.code ?? 'sem código');
      await client.unbind().catch(() => {});
      throw new UnauthorizedException('Credenciais LDAP incorretas.');
    }
  }
}
