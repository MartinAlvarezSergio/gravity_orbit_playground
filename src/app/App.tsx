import { useMemo } from "react";
import { AppletHostAdapter } from "../core/host";
import { GravityOrbitCanvas } from "../applets/gravity_orbit/GravityOrbitCanvas";
import { ThemeToggle } from "../ui/ThemeToggle";

export function App(): JSX.Element {
  const host: AppletHostAdapter = useMemo(
    () => ({
      onClose: () => {},
      readReducedMotion: () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
    }),
    []
  );

  return (
    <div className="app-shell">
      <div className="applet-appearance-bar">
        <ThemeToggle />
      </div>
      <main>
        <section className="modal card">
          <GravityOrbitCanvas host={host} />
        </section>
      </main>
    </div>
  );
}
