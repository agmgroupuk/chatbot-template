'use client';
import Link from 'next/link';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <section className="m-auto max-w-lg p-6 text-stone-900">
    <h1 className="text-2xl">Something went wrong</h1>
    <p className="my-4">We could not load this page. Please try again or contact the site administrator.</p>
    <button onClick={reset} className="rounded-xl border p-3">Try again</button>
    <Link href="/" className="ml-4 underline">Home</Link>
  </section>;
}
