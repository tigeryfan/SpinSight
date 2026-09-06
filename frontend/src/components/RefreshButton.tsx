import { useState } from "react";
import { RefreshIcon } from "./RefreshIcon";
import styles from "./RefreshButton.module.css";

interface Props {
  onRefresh: () => void;
}

export function RefreshButton({ onRefresh }: Props) {
  const [spinning, setSpinning] = useState(false);

  const handleClick = () => {
    if (spinning) return;
    setSpinning(true);
    onRefresh();
    window.setTimeout(() => setSpinning(false), 700);
  };

  return (
    <button
      type="button"
      className={styles.btn}
      onClick={handleClick}
      disabled={spinning}
      aria-label="Refresh machine data"
      title="Refresh"
      data-spinning={spinning}
    >
      <RefreshIcon />
    </button>
  );
}
