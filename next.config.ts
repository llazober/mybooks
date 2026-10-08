import type { NextConfig } from "next";
import { execSync } from "node:child_process";

// Resolve the short commit SHA of the running build so it can be shown in the
// app (see the "About PlainGL.com" modal in Shell.tsx). On Vercel we use the
// build-time env var; locally we fall back to reading it from git.
function getCommitSha(): string {
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  }
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "unknown";
  }
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_COMMIT_SHA: getCommitSha(),
  },
};

export default nextConfig;
