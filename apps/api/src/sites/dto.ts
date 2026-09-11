import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SiteDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'kimmyphungmakeup' }) slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ example: 'vi' }) defaultLocale!: string;
  @ApiProperty({ type: [String], example: ['vi', 'en'] }) locales!: string[];
  @ApiProperty({ type: Object, additionalProperties: true }) settings!: object;
}
export class TranslationLinkDto {
  @ApiProperty() locale!: string;
  @ApiProperty() slug!: string;
}
export class PageDto {
  @ApiProperty() title!: string;
  @ApiProperty() slug!: string;
  @ApiPropertyOptional({ nullable: true, type: String }) seoTitle!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) seoDescription!: string | null;
  @ApiProperty({ type: 'array', items: { type: 'object', additionalProperties: true } }) content!: unknown[];
  @ApiProperty({ type: [String] }) availableLocales!: string[];
  @ApiProperty({ type: [TranslationLinkDto] }) translations!: TranslationLinkDto[];
}
