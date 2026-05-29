import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';

export type JwtPayload = { sub: string; email: string };

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  private get secret(): string {
    return process.env.JWT_SECRET ?? 'dev-jwt-secret-replace-in-prod';
  }

  private get expiresIn(): string {
    return process.env.JWT_EXPIRES_IN ?? '1h';
  }

  // Pre-computed bcrypt hash of a string the user can never produce. Used
  // to keep the missing-user path the same shape (and roughly the same
  // duration) as the wrong-password path, so response time can't be used
  // to enumerate which emails exist.
  private static readonly DUMMY_HASH =
    '$2b$10$CwTycUXWue0Thq9StjUM0uJ8eXgC.O4QYqu5UfFv1A2qhqJSqLfVy';

  async validate(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const hash = user?.passwordHash ?? AuthService.DUMMY_HASH;
    const ok = await bcrypt.compare(password, hash);
    if (!user || !ok) throw new UnauthorizedException('Invalid credentials');
    return user;
  }

  sign(user: { id: string; email: string }): string {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return jwt.sign(payload, this.secret, { expiresIn: this.expiresIn } as jwt.SignOptions);
  }

  verify(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.secret) as JwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
