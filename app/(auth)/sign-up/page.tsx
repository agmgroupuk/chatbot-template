"use client";

import { signUpAction } from "@/app/actions";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Eye, AlertCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";

export default function SignUp() {
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check for error query parameter
    const error = searchParams.get("error");
    if (error) {
      setErrorMessage(error);
    }
  }, [searchParams]);

  const handleContinue = (formData: FormData) => {
    const emailValue = formData.get("email") as string;
    if (emailValue) {
      setEmail(emailValue);
      setShowPassword(true);
      setErrorMessage(null);
    }
  };

  const inputStyles = "h-14 w-full bg-white text-black border-gray-200 focus:border-zinc-900 focus:ring-zinc-900 rounded-xl placeholder:text-gray-500 px-4 [&:-webkit-autofill]:!bg-white [&:-webkit-autofill]:!text-black [&:-webkit-autofill]:shadow-[inset_0_0_0_9999px_white]";
  const buttonStyles = "h-14 w-full rounded-xl shadow-none font-normal";

  return (
    <>
      <div className="fixed inset-0 bg-white" />
      <Link 
        href="/"
        className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
        aria-label="Close and return to homepage"
      >
        <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </Link>
      <div className="min-h-screen w-full grid place-items-center relative">
        <div className="absolute top-4 left-4 pl-2">
          <span className="font-bold text-2xl text-zinc-900 cursor-default">start</span>
        </div>
        <div className="w-full px-4 sm:px-0 sm:max-w-[400px] -mt-16">
          <form
            className="w-full space-y-6"
            action={showPassword ? signUpAction : handleContinue}
          >
            <div className="space-y-2 text-center">
              <h1 className="text-[32px] font-normal tracking-tight text-center">
                {showPassword ? 'Create a password' : 'Create your account'}
              </h1>
            </div>

            {errorMessage && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-600 flex items-start gap-2">
                <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <p>{errorMessage}</p>
              </div>
            )}

            <div className="space-y-4">
              <div className="relative">
                <Input 
                  id="email"
                  name="email" 
                  type="email"
                  placeholder="Email address" 
                  required
                  defaultValue={email}
                  readOnly={showPassword}
                  className={inputStyles}
                  style={{ WebkitTextFillColor: 'black' }}
                />
                {showPassword && (
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    onClick={() => setShowPassword(false)}
                  >
                    Edit
                  </button>
                )}
              </div>

              {showPassword && (
                <div className="relative">
                  <Input 
                    id="password"
                    name="password" 
                    type={showPasswordText ? "text" : "password"}
                    placeholder="Password" 
                    required
                    className={`${inputStyles} pr-10`}
                    style={{ WebkitTextFillColor: 'black' }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordText(!showPasswordText)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    <Eye size={20} />
                  </button>
                </div>
              )}

              <Button 
                type="submit"
                className={`${buttonStyles} bg-zinc-900 hover:bg-zinc-800 text-white`}
              >
                {showPassword ? 'Sign up' : 'Continue'}
              </Button>
            </div>

            <div className="text-center text-sm">
              <span className="text-gray-600">Already have an account? </span>
              <Link href="/sign-in" className="text-zinc-900 hover:underline font-normal">
                Sign in
              </Link>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">OR</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className={`${buttonStyles} border border-gray-300 hover:bg-gray-50 flex items-center justify-center gap-3`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/><path d="M1 1h22v22H1z" fill="none"/></svg>
              Continue with Google
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
