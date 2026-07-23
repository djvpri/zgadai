// lib/img.ts — util gambar sisi-klien (kompresi & capture frame).

/** Kompres File gambar -> data URL JPEG kecil. */
export function compressImage(file: File, max = 640, q = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d")?.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", q));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/** Ambil frame dari <video> -> data URL JPEG (opsional dikecilkan). */
export function frameToDataUrl(v: HTMLVideoElement, max?: number, q = 0.85): string {
  let w = v.videoWidth, h = v.videoHeight;
  if (max) { const s = Math.min(1, max / Math.max(w, h)); w = Math.round(w * s); h = Math.round(h * s); }
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d")?.drawImage(v, 0, 0, w, h);
  return c.toDataURL("image/jpeg", q);
}

/** Ambil bagian base64 dari data URL (buang prefix "data:...;base64,"). */
export function stripDataUrl(dataUrl: string): string {
  return dataUrl.split(",")[1] || "";
}
