import styles from './RangeSlider.module.css';

interface RangeSliderProps {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
}

export const RangeSlider = ({ label, min, max, step = 1, value, onChange }: RangeSliderProps) => (
  <label className={styles.slider}>
    <div className={styles.header}>
      <span>{label}</span>
      <span className={styles.value}>{value}</span>
    </div>
    <input
      className={styles.input}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    />
    <div className={styles.scale}>
      <span>{min}</span>
      <span>{max}</span>
    </div>
  </label>
);
