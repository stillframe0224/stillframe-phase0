"use client";
/*
 * Documentation:
 * Secondary Button — https://app.subframe.com/76e74bd1bd62/library?component=Secondary+Button_f2b41560-3461-4d98-bf4d-25f2b9159f32
 */

import React from "react";
import * as SubframeUtils from "../utils";

interface SecondaryButtonRootProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  disabled?: boolean;
  children?: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}

const SecondaryButtonRoot = React.forwardRef<
  HTMLButtonElement,
  SecondaryButtonRootProps
>(function SecondaryButtonRoot(
  {
    disabled = false,
    children,
    className,
    type = "button",
    ...otherProps
  }: SecondaryButtonRootProps,
  ref
) {
  return (
    <button
      className={SubframeUtils.twClassNames(
        "group/f2b41560 flex h-8 cursor-pointer items-center justify-center gap-2 rounded-md border border-solid border-brand-600 bg-transparent px-3 text-left hover:bg-brand-50 active:bg-brand-100 disabled:cursor-default disabled:opacity-50 disabled:pointer-events-none",
        className
      )}
      ref={ref}
      type={type}
      disabled={disabled}
      {...otherProps}
    >
      {children ? (
        <span className="whitespace-nowrap text-body font-body text-brand-600">
          {children}
        </span>
      ) : null}
    </button>
  );
});

export const SecondaryButton = SecondaryButtonRoot;
