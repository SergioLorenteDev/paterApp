import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DEV_TOKENS } from './auth.constants';
import { IS_PUBLIC_KEY } from './public.decorator';
import { RequestWithUser } from './auth.types';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Falta token Bearer de autenticacion');
    }

    const token = authHeader.slice('Bearer '.length).trim();
    const user = DEV_TOKENS[token];

    if (!user) {
      throw new UnauthorizedException('Token invalido');
    }

    request.user = user;
    return true;
  }
}
