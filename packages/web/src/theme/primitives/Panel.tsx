import type { ReactNode, HTMLAttributes } from "react";
import styles from "./Panel.module.css";

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  /** Visual variant. Default = "default" */
  variant?: "default" | "raised" | "ghost";
  /** Neon accent along the top border. Default = "cyan" */
  accent?: "cyan" | "amber" | "lime" | "magenta" | "red" | "none";
  children: ReactNode;
}

export function Panel({
  variant = "default",
  accent = "cyan",
  className,
  children,
  ...rest
}: PanelProps) {
  return (
    <div
      className={[
        styles.panel,
        styles[`variant-${variant}`],
        accent !== "none" ? styles[`accent-${accent}`] : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}
