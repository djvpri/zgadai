import { ImageResponse } from "next/og";

// Ikon home-screen iOS (PNG). iOS otomatis membulatkan sudutnya.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b1a3a",
        }}
      >
        <div
          style={{
            width: 122,
            height: 122,
            borderRadius: "50%",
            background: "#c99a2e",
            border: "7px solid #e2c268",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 96,
            fontWeight: 700,
            color: "#0b1a3a",
          }}
        >
          Z
        </div>
      </div>
    ),
    { ...size }
  );
}
