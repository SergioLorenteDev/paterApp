import { Controller, Get, Req } from '@nestjs/common';
import { DEV_TOKENS } from '../../common/auth/auth.constants';
import { Public } from '../../common/auth/public.decorator';
import { RequestWithUser } from '../../common/auth/auth.types';

@Controller('auth')
export class AuthController {
  @Public()
  @Get('tokens')
  listTokens() {
    return {
      message: 'Tokens de desarrollo para pruebas locales',
      tokens: Object.entries(DEV_TOKENS).map(([token, user]) => ({
        token,
        userId: user.userId,
        role: user.role,
        name: user.name,
      })),
    };
  }

  @Get('me')
  me(@Req() request: RequestWithUser) {
    return {
      user: request.user,
    };
  }
}
