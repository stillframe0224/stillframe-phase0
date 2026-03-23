"use client";

import React from "react";

function tw(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}

// --- PrimaryButton ---------------------------------------------------
interface PrimaryButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
}

export const PrimaryButton = React.forwardRef<
  HTMLButtonElement,
  PrimaryButtonProps
>(function PrimaryButton({ children, className, disabled, type = "button", ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      aria-disabled={disabled ? "true" : undefined}
      className={tw(
        "inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-md border-none px-3 text-sm font-semibold text-white disabled:cursor-default disabled:opacity-50 disabled:pointer-events-none",
        // Accessibility: Enhanced keyboard focus indicators
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-600",
        className,
      )}
      style={{ background: disabled ? undefined : "rgb(234,88,12)", ...rest.style }}
      {...rest}
    >
      {children}
    </button>
  );
});
// --- Card ------------------------------------------------------------
interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  body?: React.ReactNode;
  image?: React.ReactNode;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  function Card({ title, body, image, className, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={tw(
          "flex flex-col items-start gap-3 rounded-md border border-solid border-neutral-200 bg-white px-4 py-4 shadow-sm",
          className,
        )}
        {...rest}
      >
        {image ? <div className="flex w-full items-start">{image}</div> : null}
        {title ? (
          <span className="w-full text-base font-semibold text-neutral-900">
            {title}
          </span>
        ) : null}
        {body ? (
          <span className="w-full text-sm text-neutral-500">{body}</span>
        ) : null}
      </div>
    );
  },
);
