import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    if (err || !user) {
      const errorMessage =
        err?.message || info?.message || 'Não foi possível realizar login';
      console.error('❌ Erro no LocalAuthGuard:', errorMessage);
      throw new UnauthorizedException(errorMessage);
    }
    return user;
  }
}
