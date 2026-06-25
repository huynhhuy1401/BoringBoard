import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import styles from '../../styles/components/SettingsPanel.module.css';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const { settings, updateSettings } = useSettingsStore();
  const [theme, setTheme] = useState(settings.theme);
  const [fontSize, setFontSize] = useState(settings.editor_font_size);
  const [wordWrap, setWordWrap] = useState(settings.editor_word_wrap);

  useEffect(() => {
    if (isOpen) {
      setTheme(settings.theme);
      setFontSize(settings.editor_font_size);
      setWordWrap(settings.editor_word_wrap);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSave = async () => {
    await updateSettings({
      theme,
      editor_font_size: fontSize,
      editor_word_wrap: wordWrap,
    });
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Settings</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>General</h3>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Theme</span>
              <div className={styles.radioGroup}>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="theme"
                    value="light"
                    checked={theme === 'light'}
                    onChange={() => setTheme('light')}
                  />
                  Light
                </label>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="theme"
                    value="dark"
                    checked={theme === 'dark'}
                    onChange={() => setTheme('dark')}
                  />
                  Dark
                </label>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Editor</h3>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Font Size</span>
              <input
                type="number"
                className={styles.numberInput}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                min={10}
                max={24}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={wordWrap}
                  onChange={(e) => setWordWrap(e.target.checked)}
                />
                Word Wrap
              </label>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={`${styles.btn} ${styles.cancelBtn}`} onClick={onClose}>
            Cancel
          </button>
          <button className={`${styles.btn} ${styles.saveBtn}`} onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
