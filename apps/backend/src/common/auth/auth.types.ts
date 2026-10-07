import { UserRole } from './auth.constants';
import { Request } from 'express';

export interface AuthUser {
  userId: string;
  role: UserRole;
  name: string;
}

export interface RequestWithUser extends Request {
  user?: AuthUser;
}
