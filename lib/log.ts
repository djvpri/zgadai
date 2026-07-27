// lib/log.ts — catat aktivitas (audit log). Best-effort: gagal log TIDAK menggagalkan aksi utama.
import { dbRun } from "./db";

export interface Pelaku { tenant_id: number; user_id: number; nama: string }

export async function logAktivitas(
  s: Pelaku,
  aksi: string,
  ringkasan: string,
  entitas: string | null = null,
  refId: number | null = null,
): Promise<void> {
  try {
    await dbRun(
      `INSERT INTO aktivitas (tenant_id, user_id, user_nama, aksi, entitas, ref_id, ringkasan)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [s.tenant_id, s.user_id, s.nama, aksi, entitas, refId, ringkasan]
    );
  } catch {
    // abaikan — jangan sampai audit log merusak transaksi bisnis
  }
}

// Format rupiah ringkas untuk teks ringkasan (server-side, tanpa import lib/gadai).
export function rp(n: number): string {
  return "Rp" + Math.round(Number(n) || 0).toLocaleString("id-ID");
}
