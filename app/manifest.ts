import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ZGadai — Manajemen Usaha Gadai",
    short_name: "ZGadai",
    description: "Kelola gadai: nasabah, taksiran, pinjaman, tebus & perpanjang.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0b1a3a",
    theme_color: "#0b1a3a",
    orientation: "portrait",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
