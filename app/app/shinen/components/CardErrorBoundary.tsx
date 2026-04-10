"use client";

import React, { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary for ThoughtCard components
 * Prevents entire app crash when a single card fails to render
 */
export class CardErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[CardErrorBoundary] Card render error:", error, errorInfo);
    
    // Call optional error handler
    this.props.onError?.(error, errorInfo);
    
    // Log to diagnostic system if available
    if (typeof window !== "undefined" && (window as any).logDiagEvent) {
      (window as any).logDiagEvent({
        type: "card_error_boundary",
        error: error.message,
        stack: error.stack?.slice(0, 500),
        componentStack: errorInfo.componentStack?.slice(0, 500),
      });
    }
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided, otherwise show default
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div 
          style={{
            padding: "1rem",
            background: "rgba(255, 100, 100, 0.1)",
            border: "1px solid rgba(255, 100, 100, 0.3)",
            borderRadius: "8px",
            color: "#ff6b6b",
            fontSize: "0.875rem",
            fontFamily: "monospace",
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>
            ⚠️ Card Render Error
          </div>
          <div style={{ opacity: 0.8 }}>
            {this.state.error?.message || "Unknown error"}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
