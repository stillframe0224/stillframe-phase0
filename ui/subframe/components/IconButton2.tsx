"use client";
/*
 * Documentation:
 * IconButton 2 — https://app.subframe.com/76e74bd1bd62/library?component=IconButton+2_af1e0122-94fe-43c7-9dc5-ba5b7f92475b
 */

import React from "react";
import { FeatherPlus } from "@subframe/core";
import * as SubframeCore from "@subframe/core";
import * as SubframeUtils from "../utils";

interface IconButton2RootProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  disabled?: boolean;
  icon?: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}

const IconButton2Root = React.forwardRef<
  HTMLButtonElement,
  IconButton2RootProps
>(function IconButton2Root(
  {
    disabled = false,
    icon = <FeatherPlus />,
    className,
    type = "button",
    ...otherProps
  }: IconButton2RootProps,
  ref
) {
  return (
    <button
      className={SubframeUtils.twClassNames(
        "group/af1e0122 flex h-10 w-10 cursor-pointer items-center justify-center gap-2 rounded-lg border-none bg-transparent text-left hover:bg-neutral-100 active:bg-neutral-50 disabled:cursor-default disabled:opacity-50 disabled:pointer-events-none",
        className
      )}
      ref={ref}
      type={type}
      disabled={disabled}
      {...otherProps}
    >
      {icon ? (
        <SubframeCore.IconWrapper className="text-heading-2 font-heading-2 text-default-font group-disabled/af1e0122:text-neutral-400">
          {icon}
        </SubframeCore.IconWrapper>
      ) : null}
    </button>
  );
});

export const IconButton2 = IconButton2Root;
