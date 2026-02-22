interface HintOverlayProps {
  isIdle: boolean;
}

export default function HintOverlay({ isIdle }: HintOverlayProps) {
  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%,-50%)",
        zIndex: 8,
        pointerEvents: "none",
        opacity: isIdle ? 0.1 : 0,
        transition: "opacity 0.5s",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "rgba(0,0,0,0.2)",
          fontWeight: 300,
          letterSpacing: "0.1em",
        }}
      >
        drag cards · scroll depth · shift+drag orbit · [A] arrange · [R] reset
      </div>
    </div>
  );
}
