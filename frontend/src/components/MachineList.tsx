import type { Machine, MachineKind } from "../data/types";
import styles from "./MachineList.module.css";

interface Props {
  machines: Machine[];
}

interface Section {
  kind: MachineKind;
  items: Machine[];
}

export function MachineList({ machines }: Props) {
  const washers = machines.filter((m) => m.kind === "washer");
  const dryers = machines.filter((m) => m.kind === "dryer");

  const sections: Section[] = [
    { kind: "washer", items: washers },
    { kind: "dryer", items: dryers },
  ];

  return (
    <div className={styles.wrap}>
      {sections.map((section) => (
        <section
          key={section.kind}
          className={styles.section}
          data-kind={section.kind}
          aria-labelledby={`${section.kind}-heading`}
        >
          <header className={styles.sectionHead}>
            <h3 id={`${section.kind}-heading`} className={styles.sectionTitle}>
              <span className={styles.swatch} data-kind={section.kind} aria-hidden="true" />
              {section.kind === "washer" ? "Washers" : "Dryers"}
            </h3>
            <span className={styles.sectionCount}>
              <span className="num">{section.items.length}</span>
              <span aria-hidden="true"> machines</span>
            </span>
          </header>
          <ol className={styles.list}>
            {section.items.map((m) => (
              <Row key={m.id} machine={m} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function Row({ machine }: { machine: Machine }) {
  const progress = machineProgress(machine);
  const isFilling =
    machine.status === "running" || machine.status === "almost_done";

  // Status is carried by the lit indicator's color and the ETA value;
  // there's no need to also stamp a status word on the row.
  return (
    <li className={styles.row} data-status={machine.status}>
      <span
        className={styles.fill}
        style={
          isFilling
            ? { width: `${progress * 100}%` }
            : undefined
        }
        aria-hidden="true"
      />
      <span className={styles.id}>
        <StatusLight status={machine.status} />
        <span className={styles.idLabel}>{machine.label}</span>
      </span>
      <span className={`num ${styles.eta}`}>
        {machine.status === "available"
          ? "Available"
          : machine.status === "out_of_order"
          ? "—"
          : `${machine.etaMinutes}m`}
      </span>
    </li>
  );
}

function machineProgress(machine: Machine): number {
  if (machine.status === "available" || machine.status === "out_of_order") return 0;
  return Math.min(1, machine.elapsedMinutes / machine.cycleMinutes);
}

function StatusLight({ status }: { status: Machine["status"] }) {
  return (
    <span className={styles.light} data-status={status} aria-hidden="true" />
  );
}
