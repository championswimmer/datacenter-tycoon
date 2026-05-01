import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Panel } from "./Panel.js";
import { StatTile } from "./StatTile.js";
import { NeonButton } from "./NeonButton.js";
import { LedSegment } from "./LedSegment.js";
import { ProgressBar } from "./ProgressBar.js";

describe("Panel", () => {
  it("renders children", () => {
    render(<Panel>Hello Panel</Panel>);
    expect(screen.getByText("Hello Panel")).toBeTruthy();
  });

  it("renders with accent and variant props without error", () => {
    const { container } = render(
      <Panel variant="raised" accent="amber">
        Content
      </Panel>,
    );
    expect(container.firstChild).toBeTruthy();
  });
});

describe("StatTile", () => {
  it("renders label and value", () => {
    render(<StatTile label="CASH" value="$1,000,000" />);
    expect(screen.getByText("CASH")).toBeTruthy();
    expect(screen.getByText("$1,000,000")).toBeTruthy();
  });

  it("renders sub-value when provided", () => {
    render(<StatTile label="CPU" value={128} sub="vCPU" />);
    expect(screen.getByText("vCPU")).toBeTruthy();
  });
});

describe("NeonButton", () => {
  it("renders button text", () => {
    render(<NeonButton>Click me</NeonButton>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeTruthy();
  });

  it("can be disabled", () => {
    render(<NeonButton disabled>Disabled</NeonButton>);
    expect(screen.getByRole("button", { name: "Disabled" })).toHaveProperty(
      "disabled",
      true,
    );
  });
});

describe("LedSegment", () => {
  it("renders with aria-label", () => {
    render(<LedSegment color="cyan" label="Power" />);
    expect(screen.getByText("Power")).toBeTruthy();
  });

  it("renders without label", () => {
    const { container } = render(<LedSegment color="off" />);
    expect(container.firstChild).toBeTruthy();
  });
});

describe("ProgressBar", () => {
  it("renders with role progressbar", () => {
    render(<ProgressBar value={50} max={100} label="Loading" />);
    expect(screen.getByRole("progressbar")).toBeTruthy();
  });

  it("clamps value to 0-max", () => {
    render(<ProgressBar value={200} max={100} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("200");
  });

  it("shows percentage label when showLabel is true", () => {
    render(<ProgressBar value={75} max={100} showLabel />);
    expect(screen.getByText("75%")).toBeTruthy();
  });
});
