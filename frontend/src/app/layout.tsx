import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stock Alert App",
  description: "Stock alert portfolio app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}