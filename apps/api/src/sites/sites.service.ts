import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class SitesService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(domain: string) {
    const record = await this.prisma.siteDomain.findUnique({
      where: { domain },
      include: { site: true },
    });
    if (!record) throw new NotFoundException('Site not found');
    const { id, slug, name, defaultLocale, locales, settings } = record.site;
    return { id, slug, name, defaultLocale, locales, settings };
  }

  async page(siteId: string, slug: string, locale: string) {
    const translation = await this.prisma.pageTranslation.findFirst({
      where: {
        siteId, slug, locale,
        page: { status: 'PUBLISHED', publishedAt: { lte: new Date() }, site: { locales: { has: locale } } },
      },
      include: { page: { include: { site: { select: { locales: true } }, translations: { select: { locale: true, slug: true } } } } },
    });
    if (!translation) throw new NotFoundException('Page not found');
    const { title, seoTitle, seoDescription, content, page } = translation;
    const translations = page.translations.filter((item) => page.site.locales.includes(item.locale)).sort((a, b) => a.locale.localeCompare(b.locale));
    return { title, slug, seoTitle, seoDescription, content, availableLocales: translations.map((item) => item.locale), translations };
  }
}
