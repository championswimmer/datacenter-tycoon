import { useEffect, useRef } from "react";
import { clearAllSaves } from "../../store/persist.js";
import { resetTutorialSeen } from "../../store/tutorialPersist.js";
import { useDialogFocus } from "../dialogFocus.js";
import styles from "./ResetGameModal.module.css";

interface ResetGameModalProps {
  onClose: () => void;
}

export function ResetGameModal({ onClose }: ResetGameModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useDialogFocus(closeButtonRef);

  // ESC closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleConfirm = () => {
    clearAllSaves();
    resetTutorialSeen();
    
    // Redirect to home path and reload to start fresh
    // Using origin + pathname ensures we drop any existing hash completely
    window.location.href = window.location.origin + window.location.pathname + "#/";
    window.location.reload();
  };

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-game-title"
      >
        <div className={styles.header}>
          <h2 id="reset-game-title" className={styles.title}>
            RESET GAME
          </h2>
          <button ref={closeButtonRef} className={styles.closeBtn} onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        <div className={styles.content}>
          <p>Are you sure you want to reset your game?</p>
          <p className={styles.warning}>
            This will permanently delete your current save. This action cannot be undone.
          </p>
        </div>

        <div className={styles.footer}>
          <div className={styles.footerBtns}>
            <button className={styles.cancelBtn} onClick={onClose}>
              CANCEL
            </button>
            <button className={styles.confirmBtn} onClick={handleConfirm}>
              YES, RESET
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
