export default function AppLoading() {
  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#fdfdfd",
        fontFamily: "'DM Sans',sans-serif",
        gap: "24px",
      }}
    >
      <div
        style={{
          width: "40px",
          height: "40px",
          border: "2.5px solid rgba(217,164,65,0.18)",
          borderTop: "2.5px solid #D9A441",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <div
        style={{
          color: "rgba(0,0,0,0.28)",
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: "0.12em",
          textTransform: "uppercase" as const,
        }}
      >
        SHINEN
      </div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
