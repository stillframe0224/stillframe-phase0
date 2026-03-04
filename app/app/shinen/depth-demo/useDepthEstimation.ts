"use client";

import { useState, useCallback, useRef } from "react";

/** Model input resolution for Depth Anything V2 Small */
const MODEL_SIZE = 518;

/** ImageNet normalization constants */
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

export interface DepthResult {
  data: Float32Array;
  width: number;
  height: number;
}

type OrtModule = typeof import("onnxruntime-web");
type OrtSession = import("onnxruntime-web").InferenceSession;

/**
 * Preprocess image for Depth Anything V2:
 * Resize to 518x518, normalize with ImageNet stats, convert to NCHW float32
 */
function preprocessImage(img: HTMLImageElement): Float32Array {
  const canvas = document.createElement("canvas");
  canvas.width = MODEL_SIZE;
  canvas.height = MODEL_SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, MODEL_SIZE, MODEL_SIZE);

  const imageData = ctx.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE);
  const { data } = imageData;
  const pixelCount = MODEL_SIZE * MODEL_SIZE;

  // NCHW format: [1, 3, H, W]
  const float32 = new Float32Array(3 * pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    const r = data[i * 4] / 255;
    const g = data[i * 4 + 1] / 255;
    const b = data[i * 4 + 2] / 255;

    float32[i] = (r - MEAN[0]) / STD[0]; // R channel
    float32[pixelCount + i] = (g - MEAN[1]) / STD[1]; // G channel
    float32[2 * pixelCount + i] = (b - MEAN[2]) / STD[2]; // B channel
  }

  return float32;
}

/**
 * Normalize depth output to [0, 1] range
 */
function normalizeDepth(raw: Float32Array): Float32Array {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] < min) min = raw[i];
    if (raw[i] > max) max = raw[i];
  }

  const range = max - min || 1;
  const normalized = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    normalized[i] = (raw[i] - min) / range;
  }
  return normalized;
}

export function useDepthEstimation() {
  const [depthMap, setDepthMap] = useState<DepthResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<string>("none");

  const sessionRef = useRef<OrtSession | null>(null);
  const ortRef = useRef<OrtModule | null>(null);

  const runEstimation = useCallback(async (img: HTMLImageElement) => {
    setIsLoading(true);
    setError(null);

    try {
      // Dynamic import to avoid SSR issues
      if (!ortRef.current) {
        const ort = await import("onnxruntime-web");
        ortRef.current = ort;

        // Configure WASM paths to CDN
        ort.env.wasm.wasmPaths =
          "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/";
      }

      const ort = ortRef.current;

      // Create session if not exists
      if (!sessionRef.current) {
        // Try WebGPU first, fall back to WASM
        let usedProvider = "wasm";

        try {
          if ("gpu" in navigator) {
            const gpu = (navigator as { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
            if (gpu) {
              const adapter = await gpu.requestAdapter();
              if (adapter) {
                sessionRef.current = await ort.InferenceSession.create(
                  "/models/depth-anything-v2-small-q4.onnx",
                  { executionProviders: ["webgpu"] }
                );
                usedProvider = "webgpu";
              }
            }
          }
        } catch {
          // WebGPU not available or failed, fall through to WASM
        }

        if (!sessionRef.current) {
          sessionRef.current = await ort.InferenceSession.create(
            "/models/depth-anything-v2-small-q4.onnx",
            { executionProviders: ["wasm"] }
          );
          usedProvider = "wasm";
        }

        setProvider(usedProvider);
      }

      const session = sessionRef.current;

      // Preprocess
      const inputData = preprocessImage(img);
      const inputTensor = new ort.Tensor("float32", inputData, [
        1,
        3,
        MODEL_SIZE,
        MODEL_SIZE,
      ]);

      // Detect input name from model
      const inputName = session.inputNames[0] ?? "pixel_values";

      // Run inference
      const results = await session.run({ [inputName]: inputTensor });

      // Get output (first output tensor)
      const outputName = session.outputNames[0] ?? "predicted_depth";
      const outputTensor = results[outputName];

      if (!outputTensor) {
        throw new Error(
          `No output tensor found. Available: ${Object.keys(results).join(", ")}`
        );
      }

      const rawDepth = outputTensor.data as Float32Array;
      const normalized = normalizeDepth(rawDepth);

      // Output shape: [1, 1, H, W] or [1, H, W]
      const dims = outputTensor.dims;
      const outH = dims.length === 4 ? Number(dims[2]) : Number(dims[1]);
      const outW = dims.length === 4 ? Number(dims[3]) : Number(dims[2]);

      setDepthMap({ data: normalized, width: outW, height: outH });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      console.error("Depth estimation failed:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { depthMap, isLoading, error, provider, runEstimation };
}
