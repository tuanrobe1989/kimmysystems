import { notFound } from 'next/navigation';
export const metadata = { title: 'Không tìm thấy website' };
export default function UnknownSite() { notFound(); }
