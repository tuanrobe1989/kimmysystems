import Link from 'next/link';
export default function NotFound() {
  return <main className="mx-auto max-w-3xl px-6 py-24"><p className="text-sm text-primary">404</p><h1 className="mt-6 text-4xl font-medium tracking-tight">Không tìm thấy trang</h1><p className="mt-6 text-muted">Trang hoặc bản dịch này chưa được xuất bản.</p><p lang="en" className="mt-2 text-muted">This page or translation is not available.</p><Link href="/" className="mt-10 inline-block py-3 text-primary underline underline-offset-4">Về trang chủ / Home</Link></main>;
}
