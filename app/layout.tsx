import type { Metadata } from "next";
import "./app.css";

const SITE_URL = "https://mybooks.vrtservices12.com";
const DESC =
  "Plain-text general ledger accounting — professional P&L, P&L Detail, and Balance Sheet you fully own.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "VRT Services",
  description: DESC,
  openGraph: {
    title: "VRT Services",
    description: DESC,
    url: SITE_URL,
    siteName: "VRT Services",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "VRT Services",
    description: DESC,
  },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
