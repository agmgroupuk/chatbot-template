"use client";

import { signInAction } from "@/app/actions";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Eye, AlertCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";

export default function SignIn() {
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check for error query parameter
    const error = searchParams.get("error");
    if (error) {
      if (error.includes("Invalid login credentials")) {
        setErrorMessage("Account not found. Please check your email or sign up.");
      } else {
        setErrorMessage(error);
      }
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
          <span className="font-bold text-2xl text-zinc-900 cursor-default">One Fin</span>
        </div>
        <div className="w-full px-4 sm:px-0 sm:max-w-[400px] -mt-16">
          <form
            className="w-full space-y-6"
            action={showPassword ? signInAction : handleContinue}
          >
            <div className="space-y-2 text-center">
              <h1 className="text-[32px] font-normal tracking-tight text-center">
                {showPassword ? 'Enter your password' : 'Welcome back'}
              </h1>
            </div>

            {searchParams.get("success") && <p role="status" className="rounded-lg bg-green-50 p-4 text-sm text-green-800">{searchParams.get("success")}</p>}
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
                <div className="space-y-2">
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
                  <div className="text-right">
                    <Link href="/forgot-password" className="text-sm text-gray-500 hover:text-gray-700">
                      Forgot password?
                    </Link>
                  </div>
                </div>
              )}

              <Button 
                type="submit"
                className={`${buttonStyles} bg-zinc-900 hover:bg-zinc-800 text-white`}
              >
                {showPassword ? 'Sign in' : 'Continue'}
              </Button>
            </div>

            <div className="text-center text-sm">
              <span className="text-gray-600">Don&apos;t have an account? </span>
              <Link href="/sign-up" className="text-zinc-900 hover:underline font-normal">
                Sign up
              </Link>
            </div>

          </form>
        </div>
      </div>
    </>
  );
}
