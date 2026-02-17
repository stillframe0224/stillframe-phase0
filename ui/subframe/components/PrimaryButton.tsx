"use client";
/*
 * Documentation:
 * Primary Button — https://app.subframe.com/76e74bd1bd62/library?component=Primary+Button_ac2eb0f6-cdc2-43b6-9b64-fa971cc8cea1
 */

import React from "react";
import * as SubframeUtils from "../utils";

interface PrimaryButtonRootProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  disabled?: boolean;
  children?: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}

const PrimaryButtonRoot = React.forwardRef<
  HTMLButtonElement,
  PrimaryButtonRootProps
>(function PrimaryButtonRoot(
  {
    disabled = false,
    children,
    className,
    type = "button",
    ...otherProps
  }: PrimaryButtonRootProps,
  ref
) {
  return (
    <button
      className={SubframeUtils.twClassNames(
        "group/ac2eb0f6 flex h-8 cursor-pointer items-center justify-center gap-2 rounded-md border-none bg-brand-primary px-3 text-left hover:bg-brand-700 active:bg-brand-primary disabled:cursor-default disabled:opacity-50 disabled:pointer-events-none",
        className
      )}
      ref={ref}
      type={type}
      disabled={disabled}
      {...otherProps}
    >
      {children ? (
        <span className="whitespace-nowrap text-body-bold font-body-bold text-white">
          {children}
        </span>
      ) : null}
    </button>
  );
});

export const PrimaryButton = PrimaryButtonRoot;
