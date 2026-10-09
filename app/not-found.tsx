import Link from 'next/link';
export default function NotFound() {
  return <section className="m-auto p-6 text-stone-900"><h1 className="text-2xl">Page not found</h1><Link href="/" className="mt-4 block underline">Return home</Link></section>;
}
