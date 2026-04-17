/**
 * SuccessToast - シンプルな成功通知トースト
 * カード作成成功時に表示される一時的な通知
 */

import { useEffect, useState } from "react";

interface SuccessToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
}

export function SuccessToast({ message, onClose, duration = 3000 }: SuccessToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Fade in
    requestAnimationFrame(() => {
      setIsVisible(true);
    });

    // Auto close
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for fade out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      style={{
        position: "fixed",
        bottom: "32px",
        right: "32px",
        backgroundColor: "rgba(16, 185, 129, 0.95)", // green-500
        color: "white",
        padding: "12px 20px",
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        fontSize: "14px",
        fontWeight: "500",
        zIndex: 9999,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(10px)",
        transition: "opacity 0.3s ease, transform 0.3s ease",
        pointerEvents: "none",
        maxWidth: "320px",
      }}
    >
      {message}
    </div>
  );
}

interface ToastQueueItem {
  id: number;
  message: string;
}

interface UseToastReturn {
  showToast: (message: string) => void;
  ToastContainer: () => React.ReactElement | null;
}

/**
 * useToast - トースト表示用のhook
 * 使い方:
 *   const { showToast, ToastContainer } = useToast();
 *   showToast("カードを作成しました");
 *   return <><YourApp /><ToastContainer /></>
 */
export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<ToastQueueItem[]>([]);

  const showToast = (message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message }]);
  };

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const ToastContainer = () => (
    <>
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          style={{
            position: "fixed",
            bottom: `${32 + index * 70}px`,
            right: "32px",
            zIndex: 9999,
          }}
        >
          <SuccessToast message={toast.message} onClose={() => removeToast(toast.id)} />
        </div>
      ))}
    </>
  );

  return { showToast, ToastContainer };
}
