import type { Metadata, Viewport } from "next";
import "./globals.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import PWARegister from "@/components/PWARegister";

export const metadata: Metadata = {
  title: "ZGadai — Manajemen Usaha Gadai",
  description: "Kelola gadai: nasabah, taksiran, pinjaman, tebus & perpanjang.",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "ZGadai" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0b1a3a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <PWARegister />
        {children}
      </body>
    </html>
  );
}
