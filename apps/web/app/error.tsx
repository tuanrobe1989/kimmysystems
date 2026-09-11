'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-3xl px-6 py-24"><h1 className="text-3xl">Tạm thời không tải được nội dung</h1><p lang="en" className="mt-4 text-muted">Content is temporarily unavailable.</p><button onClick={reset} className="mt-8 min-h-12 cursor-pointer border border-primary px-6 text-primary hover:bg-primary hover:text-canvas">Thử lại / Retry</button></main>;
}
