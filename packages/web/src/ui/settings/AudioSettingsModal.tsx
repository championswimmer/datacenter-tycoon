import React from "react";
import { useGameDispatch, useSelector } from "../../store/storeContext.js";
import { selectAudioSettings } from "../../store/selectors.js";
import styles from "./AudioSettingsModal.module.css";

interface AudioSettingsModalProps {
  onClose: () => void;
}

export function AudioSettingsModal({ onClose }: AudioSettingsModalProps) {
  const dispatch = useGameDispatch();
  const settings = useSelector(selectAudioSettings);

  const toggle = (key: keyof typeof settings) => {
    dispatch({
      type: "UpdateAudioSettings",
      settings: { [key]: !settings[key] },
    });
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="audio-settings-title"
      >
        <div className={styles.header}>
          <h2 id="audio-settings-title">Audio Settings</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close settings">
            &times;
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.settingRow}>
            <label htmlFor="master-toggle">Master Audio</label>
            <button
              id="master-toggle"
              className={settings.master ? styles.toggleOn : styles.toggleOff}
              onClick={() => toggle("master")}
            >
              {settings.master ? "ON" : "OFF"}
            </button>
          </div>

          <div className={`${styles.settingRow} ${!settings.master ? styles.disabled : ""}`}>
            <label htmlFor="music-toggle">Background Music</label>
            <button
              id="music-toggle"
              disabled={!settings.master}
              className={settings.music ? styles.toggleOn : styles.toggleOff}
              onClick={() => toggle("music")}
            >
              {settings.music ? "ON" : "OFF"}
            </button>
          </div>

          <div className={`${styles.settingRow} ${!settings.master ? styles.disabled : ""}`}>
            <label htmlFor="sfx-toggle">Datacenter SFX</label>
            <button
              id="sfx-toggle"
              disabled={!settings.master}
              className={settings.sfx ? styles.toggleOn : styles.toggleOff}
              onClick={() => toggle("sfx")}
            >
              {settings.sfx ? "ON" : "OFF"}
            </button>
          </div>

          <div className={`${styles.settingRow} ${!settings.master ? styles.disabled : ""}`}>
            <label htmlFor="money-toggle">Money Events</label>
            <button
              id="money-toggle"
              disabled={!settings.master}
              className={settings.money ? styles.toggleOn : styles.toggleOff}
              onClick={() => toggle("money")}
            >
              {settings.money ? "ON" : "OFF"}
            </button>
          </div>

          <div className={`${styles.settingRow} ${!settings.master ? styles.disabled : ""}`}>
            <label htmlFor="ambient-toggle">Ambient Server Hum</label>
            <button
              id="ambient-toggle"
              disabled={!settings.master}
              className={settings.ambient ? styles.toggleOn : styles.toggleOff}
              onClick={() => toggle("ambient")}
            >
              {settings.ambient ? "ON" : "OFF"}
            </button>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.doneBtn} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
