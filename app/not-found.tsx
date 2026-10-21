import Link from "next/link";

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        background: "#faf8f4",
        color: "#1a1a1a",
        fontFamily: "Georgia, serif",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <p style={{ margin: 0, letterSpacing: "0.2em", textTransform: "uppercase", fontSize: "0.75rem", opacity: 0.6 }}>
        404 — Page not found
      </p>
      <h1 style={{ margin: 0, fontSize: "clamp(1.75rem, 5vw, 3rem)", fontWeight: 500 }}>
        This story hasn&rsquo;t been captured yet.
      </h1>
      <Link
        href="/"
        style={{
          marginTop: "0.5rem",
          padding: "0.75rem 1.75rem",
          border: "1px solid #1a1a1a",
          borderRadius: "999px",
          color: "inherit",
          textDecoration: "none",
          fontSize: "0.9rem",
          letterSpacing: "0.05em",
        }}
      >
        Back to the homepage
      </Link>
    </main>
  );
}
