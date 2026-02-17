"use client";
/*
 * Documentation:
 * Card — https://app.subframe.com/76e74bd1bd62/library?component=Card_ef49f699-479e-46fc-9a4a-3211f874146a
 */

import React from "react";
import * as SubframeUtils from "../utils";

interface CardRootProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  body?: React.ReactNode;
  image?: React.ReactNode;
  className?: string;
}

const CardRoot = React.forwardRef<HTMLDivElement, CardRootProps>(
  function CardRoot(
    { title, body, image, className, ...otherProps }: CardRootProps,
    ref
  ) {
    return (
      <div
        className={SubframeUtils.twClassNames(
          "flex flex-col items-start gap-3 rounded-md border border-solid border-neutral-border bg-default-background px-4 py-4 shadow-sm",
          className
        )}
        ref={ref}
        {...otherProps}
      >
        {image ? <div className="flex w-full items-start">{image}</div> : null}
        {title ? (
          <span className="w-full text-heading-3 font-heading-3 text-default-font">
            {title}
          </span>
        ) : null}
        {body ? (
          <span className="w-full text-body font-body text-subtext-color">
            {body}
          </span>
        ) : null}
      </div>
    );
  }
);

export const Card = CardRoot;
