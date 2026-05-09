import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cho Lab Research Assistant",
  description:
    "Ask questions about Cho Lab publications on snow hydrology and remote sensing.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
