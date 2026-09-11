import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';

class HealthDto {
  @ApiProperty({ example: 'ok' }) status!: string;
  @ApiProperty({ example: 12.5 }) uptime!: number;
}

@ApiTags('health')
@Controller('healthz')
export class HealthController {
  @Get()
  @ApiOkResponse({ type: HealthDto })
  health() { return { status: 'ok', uptime: process.uptime() }; }
}
