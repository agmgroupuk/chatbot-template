import { resetPasswordAction } from '@/app/auth-actions';

export default async function ResetPassword({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return <main className="m-auto w-full max-w-md p-6 text-stone-900">
    <h1 className="mb-6 text-3xl">Choose a new password</h1>
    {params.error && <p role="alert" className="mb-4 text-red-700">{params.error}</p>}
    <form action={resetPasswordAction} className="space-y-4">
      <label className="block">New password<input name="password" type="password" autoComplete="new-password" minLength={8} required className="mt-2 w-full rounded-xl border p-3" /></label>
      <label className="block">Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required className="mt-2 w-full rounded-xl border p-3" /></label>
      <button className="w-full rounded-xl bg-zinc-900 p-3 text-white">Update password</button>
    </form>
  </main>;
}
