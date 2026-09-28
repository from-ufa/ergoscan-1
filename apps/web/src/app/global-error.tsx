"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#1c1b22",
          color: "#fff",
          fontFamily: "Commissioner, IBM Plex Sans, sans-serif",
        }}
      >
        <div style={{ maxWidth: 520, padding: "48px 24px" }}>
          <h1 style={{ fontSize: 28, margin: 0 }}>This page failed</h1>
          <p style={{ color: "rgba(255,255,255,.58)", lineHeight: 1.5 }}>
            Something broke while rendering. You can try again.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 16,
              border: 0,
              borderRadius: 10,
              padding: "8px 14px",
              background: "rgba(255,255,255,.06)",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <style>{`button:active{box-shadow:inset 0 1px 1px rgba(0,0,0,.55),inset 0 4px 12px rgba(0,0,0,.38)}`}</style>
        </div>
      </body>
    </html>
  );
}
