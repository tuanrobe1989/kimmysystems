import { BadRequestException, Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { z } from 'zod';
import { AccessTokenPayload, AuthService } from './auth.service';
import { AuthSessionDto, UserDto } from './dto';
import { CurrentUser, JwtAuthGuard } from './jwt-auth.guard';

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(8).max(128);
const registerSchema = z.object({ email, password, name: z.string().trim().min(1).max(120) });
const loginSchema = z.object({ email, password: z.string().min(1).max(128) });
const refreshSchema = z.object({ refreshToken: z.string().min(32).max(256) });

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException('Invalid request body');
  return result.data;
}

@ApiTags('auth')
@ApiBadRequestResponse({ description: 'Invalid request body' })
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Create an account with email and password' })
  @ApiCreatedResponse({ type: AuthSessionDto })
  @ApiConflictResponse({ description: 'Email already registered' })
  register(@Body() body: unknown) { return this.auth.register(parse(registerSchema, body)); }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiOkResponse({ type: AuthSessionDto })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  login(@Body() body: unknown) { return this.auth.login(parse(loginSchema, body)); }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Exchange a refresh token for new tokens (single use; replay revokes the whole session family)' })
  @ApiOkResponse({ type: AuthSessionDto })
  @ApiUnauthorizedResponse({ description: 'Invalid refresh token' })
  refresh(@Body() body: unknown) { return this.auth.refresh(parse(refreshSchema, body).refreshToken); }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke the presented refresh token (idempotent)' })
  @ApiNoContentResponse({ description: 'Session revoked or already gone' })
  async logout(@Body() body: unknown) { await this.auth.logout(parse(refreshSchema, body).refreshToken); }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Read the signed-in account' })
  @ApiOkResponse({ type: UserDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  me(@CurrentUser() user: AccessTokenPayload) { return this.auth.me(user.sub); }
}
