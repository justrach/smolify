type SmolifyOpenGraphCardProps = {
  badge?: string;
  description: string;
  eyebrow: string;
  path?: string;
  project: string;
  title: string;
};

function titleSize(title: string) {
  if (title.length > 64) return 54;
  if (title.length > 42) return 62;
  return 72;
}

export function SmolifyOpenGraphCard({
  badge = "Searchable by humans + agents",
  description,
  eyebrow,
  path = "app.smol.ly",
  project,
  title,
}: SmolifyOpenGraphCardProps) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #0b0c10 0%, #111827 58%, #172d57 100%)",
      color: "#f8fafc",
      display: "flex",
      fontFamily: "Arial, Helvetica, sans-serif",
      height: "100%",
      overflow: "hidden",
      padding: "64px 70px",
      position: "relative",
      width: "100%",
    }}>
      <div style={{
        background: "radial-gradient(circle at center, rgba(116,103,240,.48), rgba(116,103,240,0) 68%)",
        display: "flex",
        height: 680,
        position: "absolute",
        right: -120,
        top: -250,
        width: 680,
      }} />
      <div style={{
        background: "radial-gradient(circle at center, rgba(199,255,90,.12), rgba(199,255,90,0) 70%)",
        bottom: -330,
        display: "flex",
        height: 680,
        left: -180,
        position: "absolute",
        width: 680,
      }} />

      <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative", width: 785 }}>
        <div style={{ alignItems: "center", display: "flex" }}>
          <div style={{
            alignItems: "center",
            background: "#c7ff5a",
            borderRadius: 13,
            color: "#111318",
            display: "flex",
            fontSize: 27,
            fontWeight: 900,
            height: 48,
            justifyContent: "center",
            width: 48,
          }}>s</div>
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 15 }}>
            <div style={{ display: "flex", fontSize: 20, fontWeight: 800 }}>Smolify Docs</div>
            <div style={{ color: "#94a3b8", display: "flex", fontSize: 14, marginTop: 3 }}>{project}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 72 }}>
          <div style={{ color: "#91b8ff", display: "flex", fontSize: 18, fontWeight: 700, letterSpacing: ".04em" }}>{eyebrow}</div>
          <div style={{
            display: "flex",
            fontSize: titleSize(title),
            fontWeight: 900,
            letterSpacing: "-3px",
            lineHeight: 1.03,
            marginTop: 14,
            maxWidth: 770,
          }}>{title}</div>
          <div style={{
            color: "#cbd5e1",
            display: "flex",
            fontSize: 25,
            lineHeight: 1.42,
            marginTop: 24,
            maxWidth: 730,
          }}>{description}</div>
        </div>

        <div style={{ alignItems: "center", display: "flex", marginTop: "auto" }}>
          <div style={{
            background: "rgba(199,255,90,.12)",
            border: "1px solid rgba(199,255,90,.32)",
            borderRadius: 999,
            color: "#dfff9f",
            display: "flex",
            fontSize: 15,
            fontWeight: 700,
            padding: "10px 16px",
          }}>{badge}</div>
          <div style={{ color: "#94a3b8", display: "flex", fontFamily: "monospace", fontSize: 15, marginLeft: 18 }}>{path}</div>
        </div>
      </div>

      <div style={{
        background: "rgba(15,23,42,.72)",
        border: "1px solid rgba(148,163,184,.18)",
        borderRadius: 25,
        boxShadow: "0 30px 90px rgba(0,0,0,.35)",
        display: "flex",
        flexDirection: "column",
        height: 462,
        overflow: "hidden",
        position: "absolute",
        right: -76,
        top: 86,
        transform: "rotate(-2deg)",
        width: 380,
      }}>
        <div style={{ alignItems: "center", borderBottom: "1px solid rgba(148,163,184,.16)", display: "flex", height: 58, padding: "0 22px" }}>
          <div style={{ background: "#fb7185", borderRadius: 99, display: "flex", height: 8, width: 8 }} />
          <div style={{ background: "#facc15", borderRadius: 99, display: "flex", height: 8, marginLeft: 8, width: 8 }} />
          <div style={{ background: "#4ade80", borderRadius: 99, display: "flex", height: 8, marginLeft: 8, width: 8 }} />
          <div style={{ color: "#94a3b8", display: "flex", fontSize: 12, marginLeft: 18 }}>documentation</div>
        </div>
        <div style={{ display: "flex", flex: 1 }}>
          <div style={{ borderRight: "1px solid rgba(148,163,184,.13)", display: "flex", flexDirection: "column", padding: "26px 18px", width: 116 }}>
            {[66, 48, 72, 56, 62].map((width, index) => (
              <div key={width + index} style={{ background: index === 1 ? "rgba(199,255,90,.34)" : "rgba(148,163,184,.18)", borderRadius: 99, display: "flex", height: 7, marginBottom: 18, width }} />
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", padding: "34px 28px", width: 264 }}>
            <div style={{ background: "#60a5fa", borderRadius: 99, display: "flex", height: 7, width: 70 }} />
            <div style={{ background: "rgba(248,250,252,.9)", borderRadius: 6, display: "flex", height: 15, marginTop: 18, width: 196 }} />
            <div style={{ background: "rgba(248,250,252,.9)", borderRadius: 6, display: "flex", height: 15, marginTop: 10, width: 148 }} />
            <div style={{ background: "rgba(148,163,184,.28)", borderRadius: 4, display: "flex", height: 8, marginTop: 25, width: 208 }} />
            <div style={{ background: "rgba(148,163,184,.28)", borderRadius: 4, display: "flex", height: 8, marginTop: 10, width: 184 }} />
            <div style={{ background: "rgba(148,163,184,.28)", borderRadius: 4, display: "flex", height: 8, marginTop: 10, width: 202 }} />
            <div style={{ background: "rgba(96,165,250,.12)", border: "1px solid rgba(96,165,250,.22)", borderRadius: 11, display: "flex", flexDirection: "column", height: 94, marginTop: 28, padding: "18px", width: 214 }}>
              <div style={{ background: "rgba(96,165,250,.7)", borderRadius: 4, display: "flex", height: 7, width: 92 }} />
              <div style={{ background: "rgba(148,163,184,.28)", borderRadius: 4, display: "flex", height: 7, marginTop: 14, width: 170 }} />
              <div style={{ background: "rgba(148,163,184,.28)", borderRadius: 4, display: "flex", height: 7, marginTop: 9, width: 132 }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
