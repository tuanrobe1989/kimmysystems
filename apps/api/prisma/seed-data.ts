import { Prisma, PrismaClient } from '@prisma/client';

const seeds = [
  {
    slug: 'kimmyphungmakeup', name: 'Kimmy Phùng Makeup', locales: ['vi', 'en'],
    domains: ['kimmyphungmakeup.localhost', 'localhost'],
    settings: { theme: 'rose', descriptor: 'Makeup studio', navigation: { vi: [{ label: 'Về Kimmy', slug: 'gioi-thieu' }], en: [{ label: 'About Kimmy', slug: 'about' }] } },
    pages: [
      { key: 'home', translations: [
        { locale: 'vi', slug: 'home', title: 'Vẻ đẹp mang dấu ấn riêng.', seoTitle: 'Kimmy Phùng Makeup | Trang điểm tôn nét riêng', seoDescription: 'Khám phá phong cách trang điểm tự nhiên, tinh tế tại Kimmy Phùng Makeup.', content: [{ type: 'paragraph', text: 'Tôn vinh những đường nét vốn có, để bạn tự tin trong từng khoảnh khắc. Cùng Kimmy tìm phong cách trang điểm dành riêng cho bạn.' }] },
        { locale: 'en', slug: 'home', title: 'Beauty that feels like you.', seoTitle: 'Kimmy Phùng Makeup | Beauty that feels like you', seoDescription: 'Discover natural, thoughtful makeup at Kimmy Phùng Makeup.', content: [{ type: 'paragraph', text: 'Thoughtful makeup that celebrates your features. Find a look that feels personal, comfortable, and completely yours.' }] },
      ] },
      { key: 'about', translations: [
        { locale: 'vi', slug: 'gioi-thieu', title: 'Bắt đầu từ chính bạn.', seoTitle: 'Giới thiệu | Kimmy Phùng Makeup', seoDescription: 'Tìm hiểu tinh thần và phong cách của Kimmy Phùng Makeup.', content: [{ type: 'paragraph', text: 'Kimmy Phùng Makeup hướng đến vẻ đẹp tự nhiên và sự hài hòa. Mỗi phong cách bắt đầu bằng việc lắng nghe mong muốn của bạn.' }] },
        { locale: 'en', slug: 'about', title: 'It starts with you.', seoTitle: 'About | Kimmy Phùng Makeup', seoDescription: 'Get to know the approach behind Kimmy Phùng Makeup.', content: [{ type: 'paragraph', text: 'Natural beauty and balance guide our approach. Every look begins with listening to you and understanding what makes you feel at home in your own skin.' }] },
      ] },
    ],
  },
  {
    slug: 'demo', name: 'Demo Studio', locales: ['vi', 'en'], domains: ['demo.localhost'],
    settings: { theme: 'forest', descriptor: 'Không gian sáng tạo' },
    pages: [{ key: 'home', translations: [{ locale: 'vi', slug: 'home', title: 'Một không gian. Nhiều ý tưởng.', seoTitle: 'Demo Studio | Không gian sáng tạo', seoDescription: 'Trang mẫu độc lập của Demo Studio.', content: [{ type: 'paragraph', text: 'Chào mừng đến với Demo Studio. Đây là trang mẫu của một thương hiệu riêng, với nội dung và phong cách riêng.' }] }] }],
  },
];

export async function seedDatabase(prisma: PrismaClient) {
  for (const seed of seeds) {
    await prisma.$transaction(async (tx) => {
      const data = { name: seed.name, defaultLocale: 'vi', locales: seed.locales, settings: seed.settings };
      const site = await tx.site.upsert({ where: { slug: seed.slug }, update: data, create: { slug: seed.slug, ...data } });
      for (const [index, domain] of seed.domains.entries()) {
        await tx.siteDomain.upsert({ where: { domain }, update: { siteId: site.id, isPrimary: index === 0 }, create: { domain, siteId: site.id, isPrimary: index === 0 } });
      }
      for (const item of seed.pages) {
        const published = { status: 'PUBLISHED' as const, publishedAt: new Date('2026-01-01T00:00:00Z') };
        const page = await tx.page.upsert({ where: { siteId_key: { siteId: site.id, key: item.key } }, update: published, create: { siteId: site.id, key: item.key, ...published } });
        for (const translation of item.translations) {
          const data = { ...translation, siteId: site.id, content: translation.content as Prisma.InputJsonValue };
          await tx.pageTranslation.upsert({ where: { pageId_locale: { pageId: page.id, locale: translation.locale } }, update: data, create: { pageId: page.id, ...data } });
        }
      }
    });
  }
}
