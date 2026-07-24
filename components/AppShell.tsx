"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const OPS = ["admin", "kasir", "mitra"]; // peran operasional
const NAV: { href: string; label: string; short: string; icon: string; roles: string[] }[] = [
  { href: "/dashboard", label: "Dashboard", short: "Home", icon: "bi-speedometer2", roles: ["admin", "kasir", "mitra", "investor"] },
  { href: "/nasabah", label: "Nasabah", short: "Nasabah", icon: "bi-people", roles: OPS },
  { href: "/gadai/baru", label: "Gadai Baru", short: "Gadai", icon: "bi-plus-square", roles: OPS },
  { href: "/transaksi", label: "Transaksi", short: "Transaksi", icon: "bi-list-check", roles: OPS },
  { href: "/laporan", label: "Laporan", short: "Laporan", icon: "bi-bar-chart", roles: ["admin", "kasir", "mitra", "investor"] },
  { href: "/mitra", label: "Fee Mitra", short: "Fee", icon: "bi-percent", roles: ["admin", "mitra"] },
  { href: "/investor", label: "Investor", short: "Return", icon: "bi-graph-up-arrow", roles: ["admin", "investor"] },
  { href: "/staf", label: "Kelola Staf", short: "Staf", icon: "bi-person-badge", roles: ["admin"] },
  { href: "/pengaturan", label: "Pengaturan", short: "Atur", icon: "bi-gear", roles: ["admin"] },
];
const CORE = ["/dashboard", "/nasabah", "/gadai/baru", "/transaksi", "/laporan"];

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
      .then((data) => {
        if (data.kind === "nasabah") { router.replace("/saya"); return; }
        setMe(data);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  const active = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  const role = me?.user.role;
  const roleLabel = me ? ({ admin: "Admin", mitra: "Mitra", investor: "Investor", kasir: "Marketing" } as any)[role || ""] || "Marketing" : "";
  const nav = NAV.filter((n) => !!role && n.roles.includes(role));
  const bottomNav = nav.filter((n) => CORE.includes(n.href));
  const topExtra = nav.filter((n) => !CORE.includes(n.href)); // menu khusus → ikon top bar mobile
  const navLabel = (n: { href: string; label: string }) =>
    n.href === "/mitra" && role === "mitra" ? "Fee Saya"
    : n.href === "/investor" && role === "investor" ? "Return Saya"
    : n.label;

  return (
    <div className="min-h-dvh md:flex">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex md:w-60 shrink-0 flex-col bg-navy-900 text-white min-h-dvh sticky top-0 no-print">
        <div className="px-5 py-5 flex items-center gap-2 text-xl font-bold border-b border-white/10">
          <i className="bi bi-safe2-fill text-gold-400" /> ZGadai
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((n) => (
            <Link key={n.href} href={n.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active(n.href) ? "bg-white/10 text-white" : "text-navy-200 hover:bg-white/5 hover:text-white"
              }`}>
              <i className={`bi ${n.icon} text-lg`} /> {navLabel(n)}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <div className="px-2 py-1 text-xs text-navy-300 truncate">{me?.tenant.nama_usaha}</div>
          <div className="px-2 pb-2 text-sm text-white truncate">{me?.user.nama} · <span className="text-navy-300">{roleLabel}</span></div>
          <button onClick={logout} className="w-full text-left px-3 py-2 rounded-lg text-sm text-navy-200 hover:bg-white/5 hover:text-white">
            <i className="bi bi-box-arrow-right me-2" /> Keluar
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-30 bg-navy-900 text-white flex items-center justify-between px-4 py-3 no-print"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <span className="font-bold flex items-center gap-2"><i className="bi bi-safe2-fill text-gold-400" /> ZGadai</span>
        <div className="flex items-center gap-4">
          {topExtra.map((n) => (
            <Link key={n.href} href={n.href} title={navLabel(n)}
              className={`text-lg ${active(n.href) ? "text-gold-400" : "text-navy-200"}`}><i className={`bi ${n.icon}`} /></Link>
          ))}
          <button onClick={logout} className="text-navy-200 text-lg" aria-label="Keluar"><i className="bi bi-box-arrow-right" /></button>
        </div>
      </div>

      <main className="flex-1 min-w-0 p-4 md:p-8 pb-24 md:pb-8 max-w-6xl">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 no-print"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex">
          {bottomNav.map((n) => {
            const on = active(n.href);
            const center = n.href === "/gadai/baru";
            return (
              <Link key={n.href} href={n.href}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${on ? "text-navy-800" : "text-slate-400"}`}>
                <span className={center ? "w-9 h-9 -mt-3 rounded-full bg-navy-800 text-white grid place-items-center shadow-pop" : ""}>
                  <i className={`bi ${n.icon} text-lg`} />
                </span>
                {n.short}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
