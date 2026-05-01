import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./NeonButton.module.css";

export interface NeonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant */
  variant?: "primary" | "secondary" | "ghost" | "danger";
  /** Size variant */
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

export function NeonButton({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: NeonButtonProps) {
  return (
    <button
      className={[
        styles.btn,
        styles[`variant-${variant}`],
        styles[`size-${size}`],
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}
