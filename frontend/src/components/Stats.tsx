import type { Machine, MachineKind } from "../data/types";
import styles from "./Stats.module.css";

interface Props {
  machines: Machine[];
}

function aggregate(machines: Machine[], kind: MachineKind) {
  const filtered = machines.filter((m) => m.kind === kind);
  return {
    total: filtered.length,
    available: filtered.filter((m) => m.status === "available").length,
  };
}

export function Stats({ machines }: Props) {
  const washers = aggregate(machines, "washer");
  const dryers = aggregate(machines, "dryer");
  return (
    <dl className={styles.row} aria-label="Live availability">
      <Tile kind="washer" label="Washers available" value={washers.available} total={washers.total} />
      <Tile kind="dryer" label="Dryers available" value={dryers.available} total={dryers.total} />
    </dl>
  );
}

function Tile({
  label,
  value,
  total,
  kind,
}: {
  label: string;
  value: number;
  total: number;
  kind: MachineKind;
}) {
  return (
    <div className={styles.tile} data-kind={kind}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>
        <span className={`num ${styles.num}`}>{value}</span>
        <span className={styles.total}>
          <span aria-hidden="true">/</span>
          <span className="num">{total}</span>
        </span>
      </dd>
    </div>
  );
}
