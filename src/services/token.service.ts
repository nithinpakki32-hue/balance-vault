import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { JwtPayload } from '../types/index.js';

export class TokenService {
  static generateToken(payload: JwtPayload): string {
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);
  }

  static verifyToken(token: string): JwtPayload {
    return jwt.verify(token, config.jwt.secret) as JwtPayload;
  }
}
