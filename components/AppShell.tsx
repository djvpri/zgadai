"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "bi-speedometer2" },
  { href: "/nasabah", label: "Nasabah", icon: "bi-people" },
  { href: "/gadai/baru", label: "Gadai Baru", icon: "bi-plus-square" },
  { href: "/transaksi", label: "Transaksi", icon: "bi-list-check" },
  { href: "/pengaturan", label: "Pengaturan", icon: "bi-gear" },
];

interface Me {
  user: { nama: string; email: string; role: string };
  tenant: { nama_usaha: string };
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setMe)
      .catch(() => router.replace("/login"));
  }, [router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  const active = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <div className="min-h-dvh md:flex">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex md:w-60 shrink-0 flex-col bg-navy-900 text-white min-h-dvh sticky top-0 no-print">
        <div className="px-5 py-5 flex items-center gap-2 text-xl font-bold border-b border-white/10">
          <i className="bi bi-safe2-fill text-gold-400" /> ZGadai
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active(n.href) ? "bg-white/10 text-white" : "text-navy-200 hover:bg-white/5 hover:text-white"
              }`}>
              <i className={`bi ${n.icon} text-lg`} /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <div className="px-2 py-1 text-xs text-navy-300 truncate">{me?.tenant.nama_usaha}</div>
          <div className="px-2 pb-2 text-sm text-white truncate">{me?.user.nama} · <span className="text-navy-300 capitalize">{me?.user.role}</span></div>
          <button onClick={logout} className="w-full text-left px-3 py-2 rounded-lg text-sm text-navy-200 hover:bg-white/5 hover:text-white">
            <i className="bi bi-box-arrow-right me-2" /> Keluar
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-30 bg-navy-900 text-white no-print">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-bold flex items-center gap-2"><i className="bi bi-safe2-fill text-gold-400" /> ZGadai</span>
          <button onClick={logout} className="text-navy-200 text-sm"><i className="bi bi-box-arrow-right" /></button>
        </div>
        <nav className="flex gap-1 px-2 pb-2 overflow-x-auto">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium ${
                active(n.href) ? "bg-white/15 text-white" : "text-navy-200"
              }`}>
              <i className={`bi ${n.icon} me-1`} />{n.label}
            </Link>
          ))}
        </nav>
      </div>

      <main className="flex-1 min-w-0 p-4 md:p-8 max-w-6xl">{children}</main>
    </div>
  );
}
