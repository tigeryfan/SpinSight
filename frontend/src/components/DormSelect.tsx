import { useId } from "react";
import type { Dorm } from "../data/types";
import styles from "./DormSelect.module.css";

interface Props {
  dorms: Dorm[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function DormSelect({ dorms, selectedId, onSelect }: Props) {
  const id = useId();
  return (
    <div className={styles.wrap}>
      <label htmlFor={id} className={styles.label}>
        Your dorm
      </label>
      <div className={styles.fieldWrap}>
        <select
          id={id}
          className={styles.field}
          value={selectedId}
          onChange={(e) => onSelect(e.target.value)}
        >
          {dorms.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <Caret />
      </div>
    </div>
  );
}

function Caret() {
  return (
    <svg
      className={styles.caret}
      width="10"
      height="6"
      viewBox="0 0 10 6"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M1 1 L5 5 L9 1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}
