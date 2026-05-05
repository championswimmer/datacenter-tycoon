import { useState, useEffect, useCallback, useRef } from "react";
import { markTutorialSeen } from "../../store/tutorialPersist.js";
import { TUTORIAL_STEPS } from "./tutorialContent.js";
import { TutorialStepPanel } from "./TutorialStepPanel.js";
import { useDialogFocus } from "../dialogFocus.js";
import styles from "./TutorialModal.module.css";

interface TutorialModalProps {
  onClose: () => void;
  initialStep?: number;
}

export function TutorialModal({ onClose, initialStep = 0 }: TutorialModalProps) {
  const [stepIndex, setStepIndex] = useState(initialStep);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useDialogFocus(closeButtonRef);

  const totalSteps = TUTORIAL_STEPS.length;
  const currentStep = TUTORIAL_STEPS[stepIndex]!;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;

  const handleClose = useCallback(() => {
    markTutorialSeen();
    onClose();
  }, [onClose]);

  const handleNext = useCallback(() => {
    if (isLast) {
      handleClose();
    } else {
      setStepIndex((i) => i + 1);
    }
  }, [isLast, handleClose]);

  const handleBack = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  // ESC closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose]);

  return (
    /* Backdrop */
    <div
      className={styles.backdrop}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      role="presentation"
    >
      {/* Panel */}
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
      >
        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h2 id="tutorial-title" className={styles.title}>HOW TO PLAY</h2>
            <span className={styles.stepCounter}>
              {stepIndex + 1} / {totalSteps}
            </span>
          </div>
          <button
            ref={closeButtonRef}
            className={styles.closeBtn}
            onClick={handleClose}
            aria-label="Close tutorial"
          >
            ✕
          </button>
        </div>

        {/* ── Progress bar ── */}
        <div className={styles.progressBar} aria-hidden="true">
          <div
            className={styles.progressFill}
            style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
          />
        </div>

        {/* ── Content ── */}
        <div className={styles.content}>
          <TutorialStepPanel
            step={currentStep}
            stepNumber={stepIndex + 1}
            totalSteps={totalSteps}
          />
        </div>

        {/* ── Footer ── */}
        <div className={styles.footer}>
          <button
            className={styles.skipBtn}
            onClick={handleClose}
          >
            Skip Tutorial
          </button>
          <div className={styles.footerBtns}>
            <button
              className={styles.backBtn}
              onClick={handleBack}
              disabled={isFirst}
            >
              Back
            </button>
            <button
              className={styles.nextBtn}
              onClick={handleNext}
            >
              {isLast ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
