import { useCallback, useMemo, useState } from "react";
import { getDashboard, listDorms } from "./data/api";
import { DormSelect } from "./components/DormSelect";
import { Stats } from "./components/Stats";
import { UsageGraph } from "./components/UsageGraph";
import { MachineList } from "./components/MachineList";
import { RefreshButton } from "./components/RefreshButton";
import type { WeekdayKey } from "./components/DaySelector";
import styles from "./App.module.css";

export default function App() {
  const dorms = useMemo(() => listDorms(), []);
  const [dormId, setDormId] = useState(dorms[0].id);
  const [selected, setSelected] = useState<WeekdayKey>("7d");
  const [refreshKey, setRefreshKey] = useState(0);

  const dashboard = useMemo(
    () => getDashboard(dormId, refreshKey),
    [dormId, refreshKey]
  );

  const handleDormChange = useCallback((id: string) => {
    setDormId(id);
    setSelected("7d");
    setRefreshKey((k) => k + 1);
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const lastUpdatedLabel = useMemo(() => {
    const d = new Date(dashboard.generatedAt);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }, [dashboard.generatedAt]);

  return (
    <div className={styles.app}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <BrandMark />
          <span className={styles.brandName}>SpinSight</span>
          <span className={styles.brandTag}>Laundry status</span>
        </div>
        <div className={styles.dormWrap}>
          <DormSelect
            dorms={dorms}
            selectedId={dormId}
            onSelect={handleDormChange}
          />
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.statsSection} aria-label="Current availability">
          <Stats machines={dashboard.machines} />
        </section>

        <section aria-label="Usage trend">
          <UsageGraph
            weekdayDaily={dashboard.usage.weekdayDaily}
            weekdayHalfHour={dashboard.usage.weekdayHalfHour}
            selected={selected}
            onSelect={setSelected}
          />
        </section>

        <section aria-label="Machines in this dorm">
          <header className={styles.listHead}>
            <h2 className={styles.listTitle}>Machines</h2>
            <span className={styles.listMeta}>
              <RefreshButton onRefresh={handleRefresh} />
              <span>
                Updated <span className="mono">{lastUpdatedLabel}</span>
              </span>
            </span>
          </header>
          <MachineList machines={dashboard.machines} />
        </section>
      </main>
    </div>
  );
}

function BrandMark() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      aria-hidden="true"
      focusable="false"
      className={styles.brandMark}
    >
      <circle cx="11" cy="11" r="9" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="11" cy="11" r="3.2" fill="currentColor" />
      <line x1="11" y1="2" x2="11" y2="6" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
