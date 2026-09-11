import { ApiProperty } from '@nestjs/swagger';

export class UserDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'kimmy@example.com' }) email!: string;
  @ApiProperty({ example: 'Kimmy Phùng' }) name!: string;
  @ApiProperty() createdAt!: Date;
}
export class AuthSessionDto {
  @ApiProperty({ type: UserDto }) user!: UserDto;
  @ApiProperty({ description: 'Short-lived bearer token for Authorization headers' }) accessToken!: string;
  @ApiProperty({ description: 'Single-use long-lived token; exchange flow lands in T1.2' }) refreshToken!: string;
  @ApiProperty({ description: 'Access token lifetime in seconds', example: 900 }) expiresIn!: number;
}
