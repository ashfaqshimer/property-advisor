import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Sign In | Property Advisor",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
