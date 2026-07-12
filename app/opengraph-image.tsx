import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "ماذا قالوا؟ — القول الفصل في التصريحات";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          background: "linear-gradient(180deg,#0c1c2e,#05080e)",
          color: "#EAF0F7",
          padding: 72,
          direction: "rtl",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 36 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 14,
              background: "#00E0A4",
              color: "#08110d",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
              fontWeight: 700,
            }}
          >
            ؟
          </div>
          <div style={{ fontSize: 48, fontWeight: 700 }}>ماذا قالوا؟</div>
        </div>
        <div style={{ fontSize: 36, fontWeight: 600, lineHeight: 1.5, maxWidth: 900 }}>
          أرشيف موثق لتصريحات الشخصيات العامة — بالنص الحرفي والمصدر والتاريخ.
        </div>
        <div style={{ marginTop: 40, fontSize: 24, color: "#8B97A8" }}>qalu.dev</div>
      </div>
    ),
    { ...size },
  );
}
