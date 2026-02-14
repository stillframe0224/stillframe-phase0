"use client";

export default function BookmarkletPage() {
  const bookmarkletCode = `javascript:void(window.open('https://stillframe-phase0.vercel.app/app?url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title),'_blank'))`;

  return (
    <div
      style={{
        minHeight: "100vh",
        fontFamily: "var(--font-dm), system-ui, sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 520, width: "100%" }}>
        <a
          href="/"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 600,
            color: "#2a2a2a",
            textDecoration: "none",
            letterSpacing: "-0.01em",
          }}
        >
          SHINEN
        </a>

        <h1
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: "#2a2a2a",
            marginTop: 24,
            marginBottom: 8,
          }}
        >
          Bookmarklet
        </h1>
        <p style={{ fontSize: 14, color: "#777", lineHeight: 1.6, marginBottom: 24 }}>
          Save any page to SHINEN with one click. Drag the link below to your
          bookmark bar, then click it on any page to open SHINEN with the URL
          and title pre-filled.
        </p>

        {/* Bookmarklet drag target */}
        <div
          style={{
            padding: "16px 20px",
            borderRadius: 12,
            background: "#FFF8F0",
            border: "1.5px solid #F5C882",
            marginBottom: 24,
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 12, color: "#999", marginBottom: 10 }}>
            Drag this to your bookmark bar:
          </p>
          <a
            href={bookmarkletCode}
            onClick={(e) => e.preventDefault()}
            style={{
              display: "inline-block",
              padding: "8px 20px",
              borderRadius: 8,
              background: "#D9A441",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
              fontFamily: "var(--font-dm)",
              cursor: "grab",
            }}
          >
            + Save to SHINEN
          </a>
        </div>

        {/* Instructions */}
        <ol style={{ fontSize: 13, color: "#555", lineHeight: 1.8, paddingLeft: 20 }}>
          <li>Drag the button above to your bookmark bar</li>
          <li>Visit any page you want to save</li>
          <li>Click &quot;+ Save to SHINEN&quot; in your bookmarks</li>
          <li>SHINEN opens with the page title and URL pre-filled</li>
          <li>Press Enter to save (or edit the text first)</li>
        </ol>

        <div style={{ marginTop: 32, display: "flex", gap: 16 }}>
          <a
            href="/app"
            style={{
              fontSize: 13,
              color: "#D9A441",
              textDecoration: "none",
              fontFamily: "var(--font-dm)",
            }}
          >
            Back to app
          </a>
        </div>
      </div>
    </div>
  );
}
