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
    <div className="min-h-screen bg-white flex items-center justify-center relative overflow-hidden">
      
      <div className="relative z-10 w-full max-w-md p-10 bg-[#487FD5] border border-white/5 rounded-[2rem] shadow-[0_0_50px_-12px_rgba(20,184,166,0.25)]">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-extralight text-white tracking-wider mb-2 bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">VRT Services</h1>
          <p className="text-[#CDBE7C] text-sm font-medium tracking-wide uppercase">Action Required: Change Password</p>
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
            className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-semibold tracking-wide py-4 px-4 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center shadow-lg shadow-teal-900/50 hover:shadow-teal-800/80 hover:-translate-y-0.5"
          >
            {isPending ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
