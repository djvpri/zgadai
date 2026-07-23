"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function SsoInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [msg, setMsg] = useState("Memverifikasi akses…");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setMsg("Token tidak ditemukan.");
      return;
    }
    fetch("/api/auth/sso-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (r) => {
        const d = await r.json();
        if (r.ok) {
          router.replace(d.redirect || "/dashboard");
        } else {
          setMsg(d.error || "Gagal masuk lewat SSO.");
        }
      })
      .catch(() => setMsg("Gagal menghubungi server."));
  }, [params, router]);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-4 text-center px-6">
      <div className="w-10 h-10 rounded-full border-2 border-navy-200 border-t-navy-700 animate-spin" />
      <p className="text-slate-500 text-sm">{msg}</p>
    </div>
  );
}

export default function SsoPage() {
  return (
    <Suspense fallback={null}>
      <SsoInner />
    </Suspense>
  );
}
