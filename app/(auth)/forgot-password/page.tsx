import { forgotPasswordAction } from '@/app/auth-actions';
import Link from 'next/link';

export default async function ForgotPassword({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const params = await searchParams;
  return <main className="m-auto w-full max-w-md p-6 text-stone-900">
    <h1 className="mb-6 text-3xl">Reset your password</h1>
    {params.error && <p role="alert" className="mb-4 text-red-700">{params.error}</p>}
    {params.success && <p role="status" className="mb-4">{params.success}</p>}
    <form action={forgotPasswordAction} className="space-y-4">
      <label className="block">Email<input name="email" type="email" autoComplete="email" required className="mt-2 w-full rounded-xl border p-3" /></label>
      <button className="w-full rounded-xl bg-zinc-900 p-3 text-white">Send reset link</button>
    </form><Link className="mt-6 block underline" href="/sign-in">Back to sign in</Link>
  </main>;
}
