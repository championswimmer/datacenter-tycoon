import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TutorialModal } from "./TutorialModal.js";
import { resetTutorialSeen } from "../../store/tutorialPersist.js";

beforeEach(() => {
  vi.stubGlobal("localStorage", {
    getItem: vi.fn(() => null),
    setItem: vi.fn(() => {}),
    removeItem: vi.fn(() => {}),
  });
  resetTutorialSeen();
});

function renderModal(props: Partial<React.ComponentProps<typeof TutorialModal>> = {}) {
  const onClose = vi.fn();
  const utils = render(
    <TutorialModal onClose={onClose} {...props} />,
  );
  return { ...utils, onClose };
}

describe("TutorialModal", () => {
  it("renders first step by default", () => {
    renderModal();
    expect(screen.getByText("Types of Racks")).toBeTruthy();
    expect(screen.getByText("1 / 4")).toBeTruthy();
  });

  it("clicking Next advances to step 2", () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: /Next/i }));
    expect(screen.getByText("Contracts")).toBeTruthy();
    expect(screen.getByText("2 / 4")).toBeTruthy();
  });

  it("clicking Back returns to step 1", () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: /Next/i }));
    fireEvent.click(screen.getByRole("button", { name: /Back/i }));
    expect(screen.getByText("Types of Racks")).toBeTruthy();
    expect(screen.getByText("1 / 4")).toBeTruthy();
  });

  it("Back is disabled on step 1", () => {
    renderModal();
    const backBtn = screen.getByRole("button", { name: /Back/i });
    expect(backBtn).toHaveProperty("disabled", true);
  });

  it("clicking Skip calls onClose", () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: /Skip Tutorial/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("clicking Finish on last step calls onClose", () => {
    const { onClose } = renderModal();
    // Advance to last step
    fireEvent.click(screen.getByRole("button", { name: /Next/i }));
    fireEvent.click(screen.getByRole("button", { name: /Next/i }));
    fireEvent.click(screen.getByRole("button", { name: /Next/i }));
    expect(screen.getByText("Making Money")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Finish/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("clicking backdrop calls onClose", () => {
    const { onClose, container } = renderModal();
    const backdrop = container.querySelector("[role='presentation']")!;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("clicking ✕ calls onClose", () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByLabelText("Close tutorial"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("progress indicator updates", () => {
    renderModal();
    expect(screen.getByText("1 / 4")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Next/i }));
    expect(screen.getByText("2 / 4")).toBeTruthy();
  });

  it("has role=dialog on the panel", () => {
    renderModal();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("starts from initialStep when provided", () => {
    renderModal({ initialStep: 2 });
    expect(screen.getByText("Datacenter Resources")).toBeTruthy();
    expect(screen.getByText("3 / 4")).toBeTruthy();
  });
});
