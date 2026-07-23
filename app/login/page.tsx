"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const ZONE = process.env.NEXT_PUBLIC_ZONE_URL || "https://zone.zomet.my.id";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr("");
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const d = await r.json();
      if (r.ok) router.replace(d.redirect || "/dashboard");
      else setErr(d.error || "Gagal login");
    } catch {
      setErr("Gagal menghubungi server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center px-4 bg-navy-950">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 text-white text-2xl font-bold">
            <i className="bi bi-safe2-fill text-gold-400" /> ZGadai
          </div>
          <p className="text-navy-200 text-sm mt-1">Manajemen Usaha Gadai</p>
        </div>

        <form onSubmit={submit} className="card p-6 space-y-4">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@usaha.com" required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" required />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "Memproses…" : "Masuk"}
          </button>
        </form>

        <p className="text-center text-navy-300 text-xs mt-4">
          Biasanya kamu masuk lewat{" "}
          <a href={ZONE} className="text-gold-400 hover:underline">Z One</a>.
        </p>
      </div>
    </div>
  );
}
