import { OpenAppletOptions, OpenedApplet } from "../../core/host";
import { GravityOrbitCanvas } from "./GravityOrbitCanvas";

export function openGravityOrbitApplet(options?: OpenAppletOptions): OpenedApplet {
  return {
    id: "gravity-orbit",
    title: "Gravity Orbits & The Solar System",
    description:
      "Explore orbits: Solar System, historic models (Ptolemy → Kepler), Earth–Moon–ISS–JWST, Newton’s baseball pitch, or a free particle sandbox.",
    close: () => {
      options?.host?.onClose?.();
    },
    render: () => <GravityOrbitCanvas host={options?.host} />
  };
}
