import type { TutorialStep } from "./tutorialContent.js";
import styles from "./TutorialModal.module.css";

interface TutorialStepPanelProps {
  step: TutorialStep;
  stepNumber: number;
  totalSteps: number;
}

const ILLUSTRATION_EMOJI: Record<NonNullable<TutorialStep["illustration"]>, string> = {
  racks: "🖥",
  contract: "📋",
  resources: "⚡",
  money: "💰",
  maintenance: "🛠️",
};

export function TutorialStepPanel({ step, stepNumber, totalSteps }: TutorialStepPanelProps) {
  const illustrationVariantClass = step.illustration
    ? styles[`illustration-${step.illustration}`]
    : undefined;
  const illustrationClass = [styles.illustration, illustrationVariantClass]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      <h3 className={styles.stepTitle}>{step.title}</h3>
      <p className={styles.stepBody}>{step.body}</p>
      {step.illustration && (
        <div className={illustrationClass} aria-hidden="true">
          {ILLUSTRATION_EMOJI[step.illustration] ?? "❓"}
        </div>
      )}
      <div className={styles.progressBar} aria-hidden="true">
        <div
          className={styles.progressFill}
          style={{ width: `${(stepNumber / totalSteps) * 100}%` }}
        />
      </div>
      <span className="sr-only">
        Step {stepNumber} of {totalSteps}
      </span>
    </div>
  );
}
