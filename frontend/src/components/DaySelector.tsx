import styles from "./DaySelector.module.css";

// Weekday keys: "7d" for the full-week aggregate, otherwise Mon..Sun.
const WEEKDAYS: { id: WeekdayKey; label: string }[] = [
  { id: "mon", label: "Mon" },
  { id: "tue", label: "Tue" },
  { id: "wed", label: "Wed" },
  { id: "thu", label: "Thu" },
  { id: "fri", label: "Fri" },
  { id: "sat", label: "Sat" },
  { id: "sun", label: "Sun" },
];

export type WeekdayKey = "7d" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

interface Props {
  selected: WeekdayKey;
  onSelect: (key: WeekdayKey) => void;
}

export function DaySelector({ selected, onSelect }: Props) {
  return (
    <div className={styles.row} role="radiogroup" aria-label="Time range">
      <button
        type="button"
        role="radio"
        aria-checked={selected === "7d"}
        className={`${styles.pill} ${selected === "7d" ? styles.selected : ""}`}
        onClick={() => onSelect("7d")}
      >
        <span className={styles.label}>7d</span>
      </button>
      {WEEKDAYS.map((d) => {
        const isSelected = d.id === selected;
        return (
          <button
            key={d.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            className={`${styles.pill} ${isSelected ? styles.selected : ""}`}
            onClick={() => onSelect(d.id)}
          >
            <span className={styles.label}>{d.label}</span>
          </button>
        );
      })}
    </div>
  );
}
