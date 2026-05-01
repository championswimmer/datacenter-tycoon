import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InsufficientFunds } from "./InsufficientFunds.js";

describe("InsufficientFunds", () => {
  it("renders the shortfall amount in compact form", () => {
    render(<InsufficientFunds shortfall={1_500_000} />);
    expect(screen.getByText(/1\.50M/)).toBeTruthy();
  });

  it("formats thousands with K suffix", () => {
    render(<InsufficientFunds shortfall={42_500} />);
    expect(screen.getByText(/42\.5K/)).toBeTruthy();
  });

  it("formats small amounts as plain dollars", () => {
    render(<InsufficientFunds shortfall={999} />);
    expect(screen.getByText(/999/)).toBeTruthy();
  });

  it("has role=status for accessibility", () => {
    render(<InsufficientFunds shortfall={5_000} />);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("renders in md size without error", () => {
    const { container } = render(<InsufficientFunds shortfall={100_000} size="md" />);
    expect(container.firstChild).toBeTruthy();
  });
});
