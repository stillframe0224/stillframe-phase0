"use client";

import { useRef, useEffect, useCallback } from "react";

// Vertex shader: simple full-screen quad
const VERT_SRC = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    // Flip Y for WebGL texture coordinate convention
    v_uv.y = 1.0 - v_uv.y;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

// Fragment shader: UV displacement based on depth + mouse offset
const FRAG_SRC = `
  precision mediump float;
  varying vec2 v_uv;
  uniform sampler2D u_image;
  uniform sampler2D u_depth;
  uniform vec2 u_mouse; // normalized [-1, 1]
  uniform float u_strength;

  void main() {
    float depth = texture2D(u_depth, v_uv).r;
    // Displace UV based on depth and mouse position
    // Closer objects (depth ~ 1) move more, farther (depth ~ 0) move less
    vec2 offset = u_mouse * depth * u_strength;
    vec2 displaced_uv = v_uv + offset;
    // Clamp to avoid sampling outside texture
    displaced_uv = clamp(displaced_uv, 0.0, 1.0);
    gl_FragColor = texture2D(u_image, displaced_uv);
  }
`;

function createShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info}`);
  }
  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  vert: WebGLShader,
  frag: WebGLShader
): WebGLProgram {
  const program = gl.createProgram()!;
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link error: ${info}`);
  }
  return program;
}

function createTexture(
  gl: WebGLRenderingContext,
  source: TexImageSource
): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  return tex;
}

interface ParallaxCanvasProps {
  image: HTMLImageElement;
  depthData: Float32Array;
  depthWidth: number;
  depthHeight: number;
  strength?: number;
}

export function ParallaxCanvas({
  image,
  depthData,
  depthWidth,
  depthHeight,
  strength = 0.03,
}: ParallaxCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const targetRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);
  const glRef = useRef<{
    gl: WebGLRenderingContext;
    program: WebGLProgram;
    uMouse: WebGLUniformLocation;
    uStrength: WebGLUniformLocation;
  } | null>(null);

  // Convert depth Float32Array to an RGBA ImageData for texture upload
  const createDepthTexture = useCallback(
    (gl: WebGLRenderingContext) => {
      const canvas = document.createElement("canvas");
      canvas.width = depthWidth;
      canvas.height = depthHeight;
      const ctx = canvas.getContext("2d")!;
      const imgData = ctx.createImageData(depthWidth, depthHeight);

      for (let i = 0; i < depthData.length; i++) {
        const v = Math.round(depthData[i] * 255);
        imgData.data[i * 4] = v;
        imgData.data[i * 4 + 1] = v;
        imgData.data[i * 4 + 2] = v;
        imgData.data[i * 4 + 3] = 255;
      }

      ctx.putImageData(imgData, 0, 0);
      return createTexture(gl, canvas);
    },
    [depthData, depthWidth, depthHeight]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Size canvas to image aspect ratio
    const maxW = Math.min(800, window.innerWidth - 32);
    const aspect = image.naturalHeight / image.naturalWidth;
    canvas.width = maxW;
    canvas.height = Math.round(maxW * aspect);

    const gl = canvas.getContext("webgl", { antialias: false });
    if (!gl) return;

    const vert = createShader(gl, gl.VERTEX_SHADER, VERT_SRC);
    const frag = createShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
    const program = createProgram(gl, vert, frag);
    gl.useProgram(program);

    // Full-screen quad (2 triangles)
    const posBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const aPos = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    // Upload textures
    const uImage = gl.getUniformLocation(program, "u_image")!;
    const uDepth = gl.getUniformLocation(program, "u_depth")!;
    const uMouse = gl.getUniformLocation(program, "u_mouse")!;
    const uStrength = gl.getUniformLocation(program, "u_strength")!;

    gl.activeTexture(gl.TEXTURE0);
    createTexture(gl, image);
    gl.uniform1i(uImage, 0);

    gl.activeTexture(gl.TEXTURE1);
    createDepthTexture(gl);
    gl.uniform1i(uDepth, 1);

    gl.uniform1f(uStrength, strength);
    gl.uniform2f(uMouse, 0, 0);

    glRef.current = { gl, program, uMouse, uStrength };

    // Render loop
    const render = () => {
      // Smooth interpolation toward target
      mouseRef.current.x += (targetRef.current.x - mouseRef.current.x) * 0.08;
      mouseRef.current.y += (targetRef.current.y - mouseRef.current.y) * 0.08;

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uMouse, mouseRef.current.x, mouseRef.current.y);
      gl.uniform1f(uStrength, strength);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      rafRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(rafRef.current);
      gl.deleteProgram(program);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
    };
  }, [image, depthData, depthWidth, depthHeight, strength, createDepthTexture]);

  // Mouse tracking
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      targetRef.current = {
        x: ((e.clientX - rect.left) / rect.width - 0.5) * 2,
        y: ((e.clientY - rect.top) / rect.height - 0.5) * 2,
      };
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    targetRef.current = { x: 0, y: 0 };
  }, []);

  // Touch tracking for mobile
  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      const touch = e.touches[0];
      const rect = e.currentTarget.getBoundingClientRect();
      targetRef.current = {
        x: ((touch.clientX - rect.left) / rect.width - 0.5) * 2,
        y: ((touch.clientY - rect.top) / rect.height - 0.5) * 2,
      };
    },
    []
  );

  // DeviceOrientation for gyroscope on mobile
  useEffect(() => {
    const handler = (e: DeviceOrientationEvent) => {
      const gamma = (e.gamma ?? 0) / 45; // left-right tilt, normalized to ~[-1, 1]
      const beta = ((e.beta ?? 0) - 45) / 45; // front-back tilt, offset for holding angle
      targetRef.current = {
        x: Math.max(-1, Math.min(1, gamma)),
        y: Math.max(-1, Math.min(1, beta)),
      };
    };

    window.addEventListener("deviceorientation", handler);
    return () => window.removeEventListener("deviceorientation", handler);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchMove={handleTouchMove}
      style={{
        maxWidth: "100%",
        borderRadius: 12,
        cursor: "crosshair",
        touchAction: "none",
      }}
    />
  );
}
