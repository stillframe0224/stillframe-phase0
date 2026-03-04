"use client";

import { useState, useRef, useCallback } from "react";
import { useDepthEstimation } from "./useDepthEstimation";
import { ParallaxCanvas } from "./ParallaxCanvas";

export default function DepthDemoPage() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [strength, setStrength] = useState(0.03);
  const fileRef = useRef<HTMLInputElement>(null);
  const { depthMap, isLoading, error, provider, runEstimation } =
    useDepthEstimation();

  const handleFile = useCallback(
    (file: File) => {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);

      const img = new Image();
      img.onload = () => {
        setImage(img);
        runEstimation(img);
      };
      img.src = url;
    },
    [runEstimation]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file?.type.startsWith("image/")) handleFile(file);
    },
    [handleFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#e0e0e0",
        fontFamily: "system-ui, sans-serif",
        padding: "24px 16px",
      }}
    >
      <div style={{ maxWidth: 840, margin: "0 auto" }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            marginBottom: 8,
            background: "linear-gradient(135deg, #7c3aed, #06b6d4)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Depth 3D Parallax Demo
        </h1>
        <p style={{ color: "#888", marginBottom: 24, fontSize: 14 }}>
          Upload an image to generate a depth map using Depth Anything V2
          (ONNX), then hover over the result to see the 3D parallax effect.
        </p>

        {/* Upload area */}
        {!image && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            style={{
              border: "2px dashed #333",
              borderRadius: 16,
              padding: "64px 32px",
              textAlign: "center",
              cursor: "pointer",
              transition: "border-color 0.2s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.borderColor = "#7c3aed")
            }
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#333")}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>📷</div>
            <p style={{ fontSize: 18, fontWeight: 500 }}>
              Drop an image here or click to upload
            </p>
            <p style={{ color: "#666", fontSize: 13, marginTop: 8 }}>
              Supports JPG, PNG, WebP
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleChange}
              style={{ display: "none" }}
            />
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div
            style={{
              textAlign: "center",
              padding: "48px 0",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                border: "3px solid #333",
                borderTopColor: "#7c3aed",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 16px",
              }}
            />
            <p style={{ fontSize: 16, fontWeight: 500 }}>
              Generating depth map...
            </p>
            <p style={{ color: "#666", fontSize: 13, marginTop: 4 }}>
              Running Depth Anything V2 in your browser
            </p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              background: "#1a0000",
              border: "1px solid #5c0000",
              borderRadius: 8,
              padding: 16,
              marginTop: 16,
              color: "#ff6b6b",
              fontSize: 14,
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Parallax result */}
        {image && depthMap && !isLoading && (
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                marginBottom: 16,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: "#666",
                  background: "#1a1a1a",
                  padding: "4px 10px",
                  borderRadius: 6,
                }}
              >
                Provider: {provider.toUpperCase()}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: "#666",
                  background: "#1a1a1a",
                  padding: "4px 10px",
                  borderRadius: 6,
                }}
              >
                Depth: {depthMap.width}x{depthMap.height}
              </span>
              <label
                style={{
                  fontSize: 12,
                  color: "#888",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                Strength:
                <input
                  type="range"
                  min="0.005"
                  max="0.1"
                  step="0.005"
                  value={strength}
                  onChange={(e) => setStrength(parseFloat(e.target.value))}
                  style={{ width: 100 }}
                />
                <span style={{ minWidth: 40 }}>{strength.toFixed(3)}</span>
              </label>
            </div>

            {/* Main parallax view */}
            <div style={{ marginBottom: 24 }}>
              <p
                style={{
                  fontSize: 13,
                  color: "#666",
                  marginBottom: 8,
                }}
              >
                Hover over the image (or tilt your device) to see the 3D effect:
              </p>
              <ParallaxCanvas
                image={image}
                depthData={depthMap.data}
                depthWidth={depthMap.width}
                depthHeight={depthMap.height}
                strength={strength}
              />
            </div>

            {/* Side by side: original + depth map */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: 12,
                    color: "#666",
                    marginBottom: 4,
                  }}
                >
                  Original
                </p>
                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt="Original"
                    style={{
                      width: "100%",
                      borderRadius: 8,
                    }}
                  />
                )}
              </div>
              <div>
                <p
                  style={{
                    fontSize: 12,
                    color: "#666",
                    marginBottom: 4,
                  }}
                >
                  Depth Map
                </p>
                <DepthMapPreview
                  data={depthMap.data}
                  width={depthMap.width}
                  height={depthMap.height}
                />
              </div>
            </div>

            {/* Try another button */}
            <button
              onClick={() => {
                setImage(null);
                setPreviewUrl(null);
              }}
              style={{
                marginTop: 24,
                padding: "10px 24px",
                background: "#1a1a1a",
                border: "1px solid #333",
                borderRadius: 8,
                color: "#e0e0e0",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Try another image
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Renders depth map as a grayscale canvas */
function DepthMapPreview({
  data,
  width,
  height,
}: {
  data: Float32Array;
  width: number;
  height: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const setCanvas = useCallback(
    (el: HTMLCanvasElement | null) => {
      if (!el) return;
      (canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current =
        el;
      el.width = width;
      el.height = height;
      const ctx = el.getContext("2d")!;
      const imgData = ctx.createImageData(width, height);
      for (let i = 0; i < data.length; i++) {
        const v = Math.round(data[i] * 255);
        imgData.data[i * 4] = v;
        imgData.data[i * 4 + 1] = v;
        imgData.data[i * 4 + 2] = v;
        imgData.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);
    },
    [data, width, height]
  );

  return (
    <canvas
      ref={setCanvas}
      style={{ width: "100%", borderRadius: 8 }}
    />
  );
}
