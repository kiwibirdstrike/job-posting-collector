import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Posting Collector",
  description: "Collected job postings"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
