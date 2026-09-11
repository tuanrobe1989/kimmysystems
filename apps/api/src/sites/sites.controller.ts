import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { SiteDto, PageDto } from './dto';
import { SitesService } from './sites.service';

const domainSchema = z.string().trim().toLowerCase().max(253).regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/);
const slugSchema = z.string().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException('Invalid request parameters');
  return result.data;
}

@ApiTags('sites')
@ApiBadRequestResponse({ description: 'Invalid request parameters' })
@ApiNotFoundResponse({ description: 'Site or published translation not found' })
@Controller('sites')
export class SitesController {
  constructor(private readonly sites: SitesService) {}

  @Get('resolve')
  @ApiOperation({ summary: 'Resolve a registered hostname' })
  @ApiQuery({ name: 'domain', example: 'kimmyphungmakeup.localhost' })
  @ApiOkResponse({ type: SiteDto })
  resolve(@Query('domain') domain: unknown) { return this.sites.resolve(parse(domainSchema, domain)); }

  @Get(':siteId/pages/:slug')
  @ApiOperation({ summary: 'Read a published page translation within a site' })
  @ApiQuery({ name: 'locale', example: 'vi' })
  @ApiOkResponse({ type: PageDto })
  page(@Param('siteId') siteId: string, @Param('slug') slug: string, @Query('locale') locale: unknown) {
    return this.sites.page(parse(z.string().cuid(), siteId), parse(slugSchema, slug), parse(z.enum(['vi', 'en']), locale));
  }
}
