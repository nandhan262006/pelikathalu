"use client";

export default function SiteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ minHeight: "60vh", display: "grid", placeItems: "center", fontFamily: "system-ui" }}>
      <div style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
        <h2 style={{ fontFamily: "serif", marginBottom: 8 }}>The studio database hiccuped</h2>
        <p style={{ color: "#6d7a68", fontSize: 14, marginBottom: 16 }}>
          Content couldn&apos;t be loaded from Turso right now. This is usually a momentary network blip.
        </p>
        <button
          onClick={reset}
          style={{
            background: "#22331f",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "10px 18px",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
