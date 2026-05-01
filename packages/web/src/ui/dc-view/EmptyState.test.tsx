import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmptyState } from "./EmptyState.js";

describe("EmptyState", () => {
  it("renders the heading", () => {
    render(<EmptyState />);
    expect(screen.getByText("NO FACILITIES ONLINE")).toBeTruthy();
  });

  it("renders the CTA button", () => {
    render(<EmptyState />);
    expect(screen.getByText("+ BUILD FIRST DATACENTER")).toBeTruthy();
  });

  it("calls onNewDatacenter when CTA is clicked", () => {
    const handler = vi.fn();
    render(<EmptyState onNewDatacenter={handler} />);
    fireEvent.click(screen.getByText("+ BUILD FIRST DATACENTER"));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("renders without onNewDatacenter prop (no crash)", () => {
    const { container } = render(<EmptyState />);
    expect(container.firstChild).toBeTruthy();
  });
});
