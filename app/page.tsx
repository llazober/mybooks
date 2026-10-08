"use client";

import { useActionState, useEffect, useState } from "react";
import { loginUser, forgotPassword } from "./actions";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(async (prevState: any, formData: FormData) => {
    return await loginUser(formData);
  }, null);
  
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotStatus, setForgotStatus] = useState("");
  const [isForgotPending, setIsForgotPending] = useState(false);

  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      if (state.requiresPasswordChange) {
        router.push("/change-password");
      } else {
        router.push("/dashboard");
      }
    }
  }, [state, router]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setIsForgotPending(true);
    setForgotStatus("");
    const res = await forgotPassword(forgotEmail);
    if (res.ok) {
      setForgotStatus("✅ A temporary password has been sent to your email.");
      setForgotEmail("");
    } else {
      setForgotStatus(`❌ ${res.error}`);
    }
    setIsForgotPending(false);
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-teal-900/60 via-neutral-950 to-neutral-950"></div>
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-900/40 via-transparent to-transparent opacity-50 blur-3xl"></div>
      
      <div className="relative z-10 w-full max-w-md p-10 bg-neutral-900/70 backdrop-blur-2xl border border-white/5 rounded-[2rem] shadow-[0_0_50px_-12px_rgba(20,184,166,0.25)]">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-extralight text-white tracking-wider mb-2 bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">VRT Services</h1>
          <p className="text-neutral-400 text-sm font-medium tracking-wide uppercase">Sign in to your dashboard</p>
        </div>

        {isForgotMode ? (
          <form onSubmit={handleForgotPassword} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Email Address</label>
              <input 
                type="email" 
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="w-full bg-neutral-950/50 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                placeholder="admin@example.com"
                required
              />
            </div>
            
            {forgotStatus && (
              <div className={`text-sm p-3 rounded-lg ${forgotStatus.startsWith("✅") ? "bg-teal-900/20 text-teal-400 border border-teal-900/50" : "bg-red-900/20 text-red-400 border border-red-900/50"}`}>
                {forgotStatus}
              </div>
            )}

            <button 
              type="submit" 
              disabled={isForgotPending}
              className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-semibold tracking-wide py-4 px-4 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center shadow-lg shadow-teal-900/50 hover:shadow-teal-800/80 hover:-translate-y-0.5"
            >
              {isForgotPending ? "Sending..." : "Send Temporary Password"}
            </button>

            <div className="text-center">
              <button 
                type="button" 
                onClick={() => { setIsForgotMode(false); setForgotStatus(""); }}
                className="text-teal-400 hover:text-teal-300 text-sm font-medium"
              >
                Back to Sign In
              </button>
            </div>
          </form>
        ) : (
          <form action={formAction} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Email Address</label>
              <input 
                type="email" 
                name="email"
                className="w-full bg-neutral-950/50 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                placeholder="admin@example.com"
                required
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-neutral-300">Password</label>
                <button 
                  type="button"
                  onClick={() => setIsForgotMode(true)}
                  className="text-teal-400 hover:text-teal-300 text-sm font-medium"
                >
                  Forgot password?
                </button>
              </div>
              <input 
                type="password" 
                name="password"
                className="w-full bg-neutral-950/50 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            {state?.error && (
              <div className="text-red-400 text-sm bg-red-900/20 border border-red-900/50 p-3 rounded-lg">
                {state.error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={isPending}
              className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-semibold tracking-wide py-4 px-4 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center shadow-lg shadow-teal-900/50 hover:shadow-teal-800/80 hover:-translate-y-0.5"
            >
              {isPending ? "Authenticating..." : "Sign In"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
