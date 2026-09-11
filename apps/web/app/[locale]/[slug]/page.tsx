import { ContentPage, pageMetadata } from '@/components/content-page';
type Props = { params: Promise<{ locale: string; slug: string }> };
export async function generateMetadata({ params }: Props) { const { locale, slug } = await params; return pageMetadata(locale, slug); }
export default async function Page({ params }: Props) { const { locale, slug } = await params; return <ContentPage locale={locale} slug={slug} />; }
