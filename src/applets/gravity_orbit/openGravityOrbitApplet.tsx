import { OpenAppletOptions, OpenedApplet } from "../../core/host";
import { GravityOrbitCanvas } from "./GravityOrbitCanvas";

export function openGravityOrbitApplet(options?: OpenAppletOptions): OpenedApplet {
  return {
    id: "gravity-orbit",
    title: "Gravity Orbit Playground",
    description:
      "Orbital dynamics lab: Solar System, Earth–Moon–ISS–JWST, Newton’s baseball pitch from Earth’s surface, or a free particle playground.",
    close: () => {
      options?.host?.onClose?.();
    },
    render: () => <GravityOrbitCanvas host={options?.host} />
  };
}
