import { ContentPage, pageMetadata } from '@/components/content-page';
type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props) { return pageMetadata((await params).locale, 'home'); }
export default async function Home({ params }: Props) { return <ContentPage locale={(await params).locale} slug="home" />; }
