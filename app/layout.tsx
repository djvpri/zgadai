import type { Metadata, Viewport } from "next";
import "./globals.css";
import "bootstrap-icons/font/bootstrap-icons.css";

export const metadata: Metadata = {
  title: "ZGadai — Manajemen Usaha Gadai",
  description: "Kelola gadai: nasabah, taksiran, pinjaman, tebus & perpanjang.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
