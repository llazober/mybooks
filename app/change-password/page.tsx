"use client";

import { useActionState, useEffect } from "react";
import { changePassword } from "../actions";
import { useRouter } from "next/navigation";

export default function ChangePasswordPage() {
  const [state, formAction, isPending] = useActionState(async (prevState: any, formData: FormData) => {
    return await changePassword(formData);
  }, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      router.push("/dashboard");
    }
  }, [state, router]);

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-teal-900/60 via-neutral-950 to-neutral-950"></div>
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-900/40 via-transparent to-transparent opacity-50 blur-3xl"></div>
      
      <div className="relative z-10 w-full max-w-md p-10 bg-neutral-900/70 backdrop-blur-2xl border border-white/5 rounded-[2rem] shadow-[0_0_50px_-12px_rgba(20,184,166,0.25)]">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-extralight text-white tracking-wider mb-2 bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">VRT Services</h1>
          <p className="text-neutral-400 text-sm font-medium tracking-wide uppercase">Action Required: Change Password</p>
        </div>

        <form action={formAction} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">New Password</label>
            <input 
              type="password" 
              name="newPassword"
              className="w-full bg-neutral-950/50 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="••••••••"
              required
              minLength={6}
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
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
          >
            {isPending ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
