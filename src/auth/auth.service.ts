import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsuariosService } from 'src/usuarios/usuarios.service';
import { Usuario } from '@prisma/client';
import { UsuarioPayload } from './models/UsuarioPayload';
import { JwtService } from '@nestjs/jwt';
import { UsuarioToken } from './models/UsuarioToken';
import { UsuarioJwt } from './models/UsuarioJwt';
import { Client as LdapClient } from 'ldapts';

@Injectable()
export class AuthService {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService,
  ) {}

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
    let usuario = await this.usuariosService.buscarPorLogin(login);

    // Verifica se o usuário existe no banco local
    if (!usuario) {
      console.error('❌ Usuário não encontrado no banco de dados:', login);
      throw new UnauthorizedException(
        'Usuário não encontrado no sistema. Entre em contato com o administrador.',
      );
    }

    // Verifica se o usuário está ativo
    if (usuario.status === false) {
      console.error('❌ Usuário desativado:', login);
      throw new UnauthorizedException('Usuário desativado.');
    }

    // Em ambiente local, pula a validação LDAP
    const environment = process.env.ENVIRONMENT?.replace(
      /"/g,
      '',
    ).toLowerCase();

    if (environment === 'local') {
      return usuario;
    }

    // Validação LDAP em ambiente de produção

    const client: LdapClient = new LdapClient({
      url: process.env.LDAP_SERVER?.replace(/"/g, ''),
    });

    try {
      const ldapDomain = process.env.LDAP_DOMAIN?.replace(/"/g, '');
      const ldapUser = `${login}${ldapDomain}`;

      await client.bind(ldapUser, senha);

      await client.unbind();

      return usuario;
    } catch (error) {
      console.error('❌ Erro na autenticação LDAP:', error.message);
      await client.unbind().catch(() => {});
      throw new UnauthorizedException('Credenciais LDAP incorretas.');
    }
  }
}
