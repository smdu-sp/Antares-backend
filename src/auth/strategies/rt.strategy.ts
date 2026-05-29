import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsuarioPayload } from '../models/UsuarioPayload';
import { UsuariosService } from 'src/usuarios/usuarios.service';
import { Usuario } from '@prisma/client';

@Injectable()
export class RtStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private usuariosService: UsuariosService) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField("refresh_token"),
      ignoreExpiration: false,
      secretOrKey: process.env.RT_SECRET,
    });
  }

  async validate(payload: UsuarioPayload) {
    const usuario = await this.usuariosService.buscarPorId(payload.sub);
    if (!usuario) throw new UnauthorizedException('Usuário não encontrado');
    await this.usuariosService.atualizarUltimoLogin(payload.sub);
    return usuario;
  }
}
