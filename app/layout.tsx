import type { Metadata } from "next";
import "./app.css";

const SITE_URL = "https://booking.vrtservices12.com";
const DESC =
  "Plain-text general ledger accounting — professional P&L, P&L Detail, and Balance Sheet you fully own.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "booking.vrtservices12.com",
  description: DESC,
  openGraph: {
    title: "booking.vrtservices12.com",
    description: DESC,
    url: SITE_URL,
    siteName: "booking.vrtservices12.com",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "booking.vrtservices12.com",
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
