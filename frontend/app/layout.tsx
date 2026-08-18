import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Property Advisor — Property in Colombo and across Sri Lanka",
  description:
    "AI-guided property search across Sri Lanka's top locations. Tell us what you're looking for and we'll find the right address.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col font-sans text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
