import { ImageResponse } from "next/og";

export type CardTemplate = "2d" | "2e" | "3a";

export interface CardPayload {
  text: string;
  figureName: string;
  figureTitle?: string | null;
  context?: string | null;
  dateLabel: string;
  template: CardTemplate;
}

const COLORS = {
  bg: "#0A0E14",
  bgDeep: "#05080e",
  fg: "#EAF0F7",
  muted: "#8B97A8",
  accent: "#00E0A4",
  accentInk: "#08110d",
  breaking: "#FF5D6C",
  gold: "#C9A227",
  border: "#232C3A",
};

function truncate(text: string, max: number) {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** يبني ImageResponse لبطاقة سوشيال حسب قالب الهوية */
export function renderSocialCard(payload: CardPayload): ImageResponse {
  const template = payload.template;
  const quote = truncate(payload.text, template === "2d" ? 160 : 120);
  const size =
    template === "2d"
      ? { width: 1200, height: 675 }
      : { width: 1080, height: 1080 };

  if (template === "2d") {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            background: `linear-gradient(180deg,#0c1c2e,${COLORS.bgDeep} 55%,#05080e)`,
            color: COLORS.fg,
            fontFamily: "sans-serif",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              left: 0,
              height: 4,
              background: `linear-gradient(90deg,transparent,${COLORS.accent},transparent)`,
              display: "flex",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "40px 52px",
              direction: "rtl",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: COLORS.accent,
                  color: COLORS.accentInk,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                  fontWeight: 700,
                }}
              >
                ؟
              </div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>ماذا قالوا</div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 20,
                fontWeight: 600,
                color: COLORS.breaking,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,93,108,0.35)",
                borderRadius: 999,
                padding: "8px 18px",
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: COLORS.breaking,
                  display: "flex",
                }}
              />
              تصريح جديد
            </div>
          </div>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: "0 72px",
              gap: 20,
              direction: "rtl",
            }}
          >
            <div style={{ fontSize: 64, fontWeight: 700, color: COLORS.accent, lineHeight: 0.5 }}>
              «
            </div>
            <div style={{ fontSize: 42, fontWeight: 600, lineHeight: 1.5 }}>{quote}</div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "36px 52px",
              borderTop: "1px solid rgba(255,255,255,0.08)",
              direction: "rtl",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 26, fontWeight: 700 }}>{payload.figureName}</div>
              <div style={{ fontSize: 20, color: COLORS.muted }}>
                {[payload.figureTitle, payload.context].filter(Boolean).join(" — ") || " "}
              </div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 600, color: COLORS.muted }}>{payload.dateLabel}</div>
          </div>
        </div>
      ),
      { ...size },
    );
  }

  const isBreaking = template === "3a";
  const badge = isBreaking ? "عاجل" : "قيد التحقّق";
  const badgeColor = isBreaking ? COLORS.breaking : COLORS.gold;
  const badgeBg = isBreaking ? COLORS.breaking : "rgba(201,162,39,0.12)";
  const badgeFg = isBreaking ? "#fff" : COLORS.gold;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: COLORS.bg,
          color: COLORS.fg,
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {isBreaking && (
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              left: 0,
              height: 6,
              background: COLORS.breaking,
              display: "flex",
            }}
          />
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "48px 52px",
            direction: "rtl",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: COLORS.accent,
                color: COLORS.accentInk,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                fontWeight: 700,
              }}
            >
              ؟
            </div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>ماذا قالوا</div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 18,
              fontWeight: 700,
              color: badgeFg,
              background: badgeBg,
              border: isBreaking ? "none" : `1px solid ${badgeColor}`,
              borderRadius: 999,
              padding: "8px 16px",
            }}
          >
            {badge}
          </div>
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 56px",
            gap: 24,
            direction: "rtl",
          }}
        >
          <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.5 }}>«{quote}»</div>
          <div style={{ fontSize: 22, color: COLORS.muted }}>
            {payload.figureName}
            {payload.figureTitle ? ` — ${payload.figureTitle}` : ""}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "36px 52px",
            borderTop: `1px solid ${COLORS.border}`,
            direction: "rtl",
          }}
        >
          <div style={{ fontSize: 18, color: COLORS.muted }}>qalu.dev</div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: isBreaking ? COLORS.breaking : COLORS.accent,
            }}
          >
            {payload.dateLabel}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
