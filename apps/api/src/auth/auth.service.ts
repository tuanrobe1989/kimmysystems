import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma.service';

export interface AccessTokenPayload {
  sub: string;
  email: string;
}

const toUserDto = ({ id, email, name, createdAt }: User) => ({ id, email, name, createdAt });
const hashRefreshToken = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(input: { email: string; password: string; name: string }) {
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    try {
      const user = await this.prisma.user.create({ data: { email: input.email, passwordHash, name: input.name } });
      return this.createSession(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Email already registered');
      throw error;
    }
  }

  async login(input: { email: string; password: string }) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    // Always run one argon2 verification so unknown emails cost the same time as wrong passwords.
    const valid = await argon2.verify(user?.passwordHash ?? (await this.dummyHash), input.password).catch(() => false);
    if (!user || !valid) throw new UnauthorizedException('Invalid email or password');
    return this.createSession(user);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Account no longer exists');
    return toUserDto(user);
  }

  // Every failure below returns the same 401 body so responses never reveal
  // whether a token exists, expired, or triggered the reuse alarm.
  async refresh(refreshToken: string) {
    const session = await this.prisma.session.findUnique({ where: { refreshTokenHash: hashRefreshToken(refreshToken) }, include: { user: true } });
    if (!session) throw new UnauthorizedException('Invalid refresh token');
    if (session.revokedAt) {
      // A rotated-out token coming back means it leaked or was replayed: kill the whole chain.
      await this.revokeFamily(session.familyId);
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (session.expiresAt <= new Date()) {
      await this.revokeFamily(session.familyId);
      throw new UnauthorizedException('Invalid refresh token');
    }
    const rotated = await this.prisma.session.updateMany({ where: { id: session.id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (rotated.count === 0) {
      // Lost a race: the token was consumed concurrently, which is itself a replay.
      await this.revokeFamily(session.familyId);
      throw new UnauthorizedException('Invalid refresh token');
    }
    return this.createSession(session.user, session.familyId);
  }

  // Idempotent and silent on unknown tokens, so logout cannot be used to probe for valid ones.
  async logout(refreshToken: string) {
    await this.prisma.session.updateMany({ where: { refreshTokenHash: hashRefreshToken(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
  }

  private revokeFamily(familyId: string) {
    return this.prisma.session.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  private async createSession(user: User, familyId?: string) {
    const refreshToken = randomBytes(48).toString('base64url');
    const days = this.config.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS');
    await this.prisma.session.create({
      data: { userId: user.id, ...(familyId ? { familyId } : {}), refreshTokenHash: hashRefreshToken(refreshToken), expiresAt: new Date(Date.now() + days * 86_400_000) },
    });
    const payload: AccessTokenPayload = { sub: user.id, email: user.email };
    return {
      user: toUserDto(user),
      accessToken: await this.jwt.signAsync(payload),
      refreshToken,
      expiresIn: this.config.getOrThrow<number>('ACCESS_TOKEN_TTL_SECONDS'),
    };
  }

  // Hash of a random throwaway value, verified for unknown emails so login timing stays uniform.
  private readonly dummyHash = argon2.hash(randomBytes(16).toString('hex'), { type: argon2.argon2id });
}
