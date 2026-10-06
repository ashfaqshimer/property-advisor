import { ImageResponse } from "next/og";

export const alt = "Property Advisor — Real Estate in Colombo and across Sri Lanka";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          height: "100%",
          width: "100%",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#19352b",
          padding: "64px 80px",
          color: "#ffffff",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              backgroundColor: "#2e5c4d",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "22px",
              fontWeight: 700,
              color: "#ffffff",
            }}
          >
            PA
          </div>
          <span
            style={{
              fontSize: "26px",
              fontWeight: 700,
              letterSpacing: "2px",
              color: "#e2ece6",
            }}
          >
            PROPERTY ADVISOR
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div
            style={{
              fontSize: "54px",
              fontWeight: 800,
              lineHeight: 1.15,
              maxWidth: "920px",
              letterSpacing: "-0.5px",
            }}
          >
            Property in Colombo and across Sri Lanka
          </div>
          <div
            style={{
              fontSize: "24px",
              color: "#9ebd9f",
              fontWeight: 400,
            }}
          >
            Prime listings • AI-guided recommendations • Colombo-focused
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid #284c3f",
            paddingTop: "24px",
            fontSize: "18px",
            color: "#7e9c8e",
          }}
        >
          <span>propertyadvisor.lk</span>
          <span>Powered by Amaya AI</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
