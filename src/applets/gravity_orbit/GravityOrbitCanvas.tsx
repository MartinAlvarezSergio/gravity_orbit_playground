import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AppletHostAdapter } from "../../core/host";
import { ControlCard } from "../../ui/ControlCard";
import {
  clampZoom,
  defaultCamera,
  screenToWorld,
  zoomForBodyRadius,
  type CameraView
} from "./camera";
import {
  PITCH_DEFAULT_ZOOM,
  PITCH_MAX_ZOOM,
  PITCH_PRESETS,
  PITCH_SPEED_DEFAULT,
  PITCH_SPEED_MAX,
  PITCH_SPEED_MIN,
  earthPitchCameraFocus,
  formatPitchSpeedFraction,
  pitchRegimeLabel,
  type PitchPresetId,
  type PitchRegime
} from "./earthPitch";
import {
  DEFAULT_HISTORIC_MODEL,
  HISTORIC_MODEL_OPTIONS,
  type HistoricModelId
} from "./historicModels";
import {
  AU_KM,
  NEAR_EARTH_VIEW_DEFAULT_KM,
  NEAR_EARTH_VIEW_MAX_KM,
  NEAR_EARTH_VIEW_MIN_KM,
  SCENARIOS,
  SCENARIO_OPTIONS,
  formatDistance
} from "./scenarios";
import { createGravityOrbitSim } from "./sim";
import { renderGravityOrbit } from "./render";
import { GravityCanvasTheme, ScenarioId, SelectedBodyInfo } from "./types";

const MASS_MIN = 20;
const MASS_MAX = 320;
const MASS_DEFAULT = 120;
const BINARY_MASS_MIN = 0.2;
const BINARY_MASS_MAX = 12;
const BINARY_MASS_STEP = 0.1;
const BINARY_BODY_A_DEFAULT = 3;
const BINARY_BODY_B_DEFAULT = 1;
const BINARY_ECCENTRICITY_MIN = 0;
const BINARY_ECCENTRICITY_MAX = 0.8;
const BINARY_ECCENTRICITY_STEP = 0.01;
const BINARY_ECCENTRICITY_DEFAULT = 0.35;
const PARTICLE_MIN = 20;
const PARTICLE_MAX = 450;
const PARTICLE_DEFAULT = 140;
const CANVAS_W = 900;
const CANVAS_H = 620;

type GravityOrbitCanvasProps = {
  host?: AppletHostAdapter;
};

function formatNumber(value: number): string {
  return Number(value).toFixed(1);
}

function kmToSlider(km: number): number {
  const min = Math.log10(NEAR_EARTH_VIEW_MIN_KM);
  const max = Math.log10(NEAR_EARTH_VIEW_MAX_KM);
  return ((Math.log10(km) - min) / (max - min)) * 100;
}

function sliderToKm(slider: number): number {
  const min = Math.log10(NEAR_EARTH_VIEW_MIN_KM);
  const max = Math.log10(NEAR_EARTH_VIEW_MAX_KM);
  const t = Math.min(100, Math.max(0, slider)) / 100;
  return 10 ** (min + t * (max - min));
}

function clampNearEarthViewForBody(distanceKm: number): number {
  if (distanceKm <= 0) {
    return 2.5e4;
  }
  // Fit the body at ~40% of the half-width so it sits clearly inside the frame.
  return Math.min(
    NEAR_EARTH_VIEW_MAX_KM,
    Math.max(NEAR_EARTH_VIEW_MIN_KM, distanceKm * 2.4)
  );
}

function currentCanvasTheme(): GravityCanvasTheme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

/** View scale that fits each near-Earth target without flipping the heliocentric frame. */
function nearEarthViewForBody(bodyId: string, distanceKm: number): number {
  if (bodyId === "sun") {
    // Wide enough to see Earth's yearly orbit around the Sun.
    return clampNearEarthViewForBody(AU_KM);
  }
  if (bodyId === "earth") {
    // Neighborhood that includes Moon + JWST while staying on Earth.
    return clampNearEarthViewForBody(1.5e6);
  }
  return clampNearEarthViewForBody(distanceKm);
}

export function GravityOrbitCanvas({ host }: GravityOrbitCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasShellRef = useRef<HTMLDivElement | null>(null);
  const controlsPopupRef = useRef<Window | null>(null);
  const controlsPopupCleanupRef = useRef<(() => void) | null>(null);
  const dragRef = useRef(false);
  const cameraRef = useRef<CameraView>(defaultCamera(CANVAS_W, CANVAS_H));
  const followRef = useRef(false);

  const [scenario, setScenario] = useState<ScenarioId>("solar-system");
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [centralMass, setCentralMass] = useState(MASS_DEFAULT);
  const [binaryBodyAMass, setBinaryBodyAMass] = useState(BINARY_BODY_A_DEFAULT);
  const [binaryBodyBMass, setBinaryBodyBMass] = useState(BINARY_BODY_B_DEFAULT);
  const [binaryEccentricity, setBinaryEccentricity] = useState(
    BINARY_ECCENTRICITY_DEFAULT
  );
  const [particleCount, setParticleCount] = useState(PARTICLE_DEFAULT);
  const [selfGravity, setSelfGravity] = useState(false);
  const [showVelocityVectors, setShowVelocityVectors] = useState(false);
  const [showForceVectors, setShowForceVectors] = useState(false);
  const [showTrails, setShowTrails] = useState(true);
  const [showSweptArea, setShowSweptArea] = useState(false);
  const [viewHalfWidthKm, setViewHalfWidthKm] = useState(NEAR_EARTH_VIEW_DEFAULT_KM);
  const [timeScale, setTimeScale] = useState(1);
  const [cameraZoom, setCameraZoom] = useState(1);
  const [followSelected, setFollowSelected] = useState(false);
  const [pitchSpeed, setPitchSpeed] = useState(PITCH_SPEED_DEFAULT);
  const [pitchRegime, setPitchRegime] = useState<PitchRegime>("suborbital");
  const [avgSpeed, setAvgSpeed] = useState(0);
  const [kineticEnergy, setKineticEnergy] = useState(0);
  const [selected, setSelected] = useState<SelectedBodyInfo | null>(null);
  const [scenarioNote, setScenarioNote] = useState(SCENARIOS["solar-system"].note);
  const [historicModel, setHistoricModel] = useState<HistoricModelId>(DEFAULT_HISTORIC_MODEL);
  const [isCanvasFullscreen, setIsCanvasFullscreen] = useState(false);
  const [controlsPortalTarget, setControlsPortalTarget] = useState<HTMLElement | null>(null);
  const [displayNotice, setDisplayNotice] = useState("");
  const [canvasTheme, setCanvasTheme] = useState<GravityCanvasTheme>(currentCanvasTheme);

  const reducedMotion = host?.readReducedMotion?.() ?? false;
  const sim = useMemo(() => {
    const created = createGravityOrbitSim({
      centralMass: MASS_DEFAULT,
      selfGravity: false,
      showTrails: true,
      showVectors: false
    });
    created.setScenario("solar-system");
    return created;
  }, []);

  useEffect(() => {
    followRef.current = followSelected;
  }, [followSelected]);

  useEffect(() => {
    const observer = new MutationObserver(() => setCanvasTheme(currentCanvasTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"]
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function onFullscreenChange(): void {
      setIsCanvasFullscreen(document.fullscreenElement === canvasShellRef.current);
    }

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(
    () => () => {
      controlsPopupCleanupRef.current?.();
      const popup = controlsPopupRef.current;
      if (popup && !popup.closed) {
        popup.close();
      }
    },
    []
  );

  useEffect(() => {
    const maxZoom = scenario === "earth-pitch" ? PITCH_MAX_ZOOM : 16;
    cameraRef.current = {
      ...cameraRef.current,
      zoom: clampZoom(cameraZoom, maxZoom),
      width: CANVAS_W,
      height: CANVAS_H
    };
  }, [cameraZoom, scenario]);

  useEffect(() => {
    sim.setScenario(scenario);
    setScenarioNote(SCENARIOS[scenario].note);
    setSelected(sim.getSelectedInfo());
    setPaused(false);
    setFollowSelected(false);
    setCameraZoom(scenario === "earth-pitch" ? PITCH_DEFAULT_ZOOM : 1);
    cameraRef.current = defaultCamera(CANVAS_W, CANVAS_H);
    if (scenario === "earth-pitch") {
      const pitch = sim.getEarthPitch();
      if (pitch) {
        setPitchSpeed(pitch.speedFraction);
        setPitchRegime(pitch.regime);
        setScenarioNote(pitch.note);
        const zoom = PITCH_DEFAULT_ZOOM;
        setCameraZoom(zoom);
        cameraRef.current = {
          ...cameraRef.current,
          zoom,
          focus: earthPitchCameraFocus(pitch, zoom)
        };
      }
      setRunning(true);
    } else if (scenario === "binary-system") {
      sim.selectBody("binary-a");
      setSelected(sim.getSelectedInfo());
      setRunning(true);
    } else if (scenario === "near-earth") {
      // Sun-centered stage: Earth visibly orbits; slider only opens the neighborhood.
      setViewHalfWidthKm(NEAR_EARTH_VIEW_DEFAULT_KM);
      sim.setViewHalfWidthKm(NEAR_EARTH_VIEW_DEFAULT_KM);
      sim.selectBody("earth");
      setSelected(sim.getSelectedInfo());
      setFollowSelected(false);
      setCameraZoom(1);
      cameraRef.current = defaultCamera(CANVAS_W, CANVAS_H);
      setRunning(true);
    } else if (scenario === "historic-models") {
      setHistoricModel(DEFAULT_HISTORIC_MODEL);
      sim.setHistoricModel(DEFAULT_HISTORIC_MODEL);
      setScenarioNote(sim.getSnapshot().note);
      setSelected(sim.getSelectedInfo());
      setFollowSelected(false);
      setShowTrails(true);
      setRunning(true);
    }
  }, [scenario, sim]);

  useEffect(() => {
    if (scenario !== "historic-models") {
      return;
    }
    sim.setHistoricModel(historicModel);
    setScenarioNote(sim.getSnapshot().note);
    setSelected(sim.getSelectedInfo());
    cameraRef.current = defaultCamera(CANVAS_W, CANVAS_H);
    setCameraZoom(1);
    setFollowSelected(false);
  }, [historicModel, scenario, sim]);

  useEffect(() => {
    sim.setCenterMass(centralMass);
  }, [centralMass, sim]);

  useEffect(() => {
    sim.setBinaryMasses(binaryBodyAMass, binaryBodyBMass);
  }, [binaryBodyAMass, binaryBodyBMass, sim]);

  useEffect(() => {
    sim.setBinaryEccentricity(binaryEccentricity);
  }, [binaryEccentricity, sim]);

  useEffect(() => {
    sim.setParticleCount(particleCount);
  }, [particleCount, sim]);

  useEffect(() => {
    sim.setSelfGravity(selfGravity);
  }, [selfGravity, sim]);

  useEffect(() => {
    sim.setViewHalfWidthKm(viewHalfWidthKm);
    if (scenario !== "near-earth") {
      return;
    }
    // Keep the default portrait Sun-centered so Earth keeps orbiting on screen.
    if (!followSelected) {
      cameraRef.current = {
        ...defaultCamera(CANVAS_W, CANVAS_H),
        zoom: cameraRef.current.zoom
      };
      return;
    }
    const body = sim.getSelectedBody();
    if (body) {
      cameraRef.current = {
        ...cameraRef.current,
        focus: { x: body.position.x, y: body.position.y }
      };
    }
  }, [viewHalfWidthKm, sim, scenario, followSelected]);

  useEffect(() => {
    sim.setTimeScale(timeScale);
  }, [timeScale, sim]);

  useEffect(() => {
    if (scenario === "earth-pitch") {
      sim.setPitchViewZoom(cameraZoom);
    }
  }, [cameraZoom, scenario, sim]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    let last = performance.now();
    let raf = 0;
    const tick = (time: number): void => {
      const dt = (time - last) / 1000;
      last = time;
      if (running && !paused) {
        sim.step(dt);
      }

      const snapshot = sim.getSnapshot();
      const selectedBody = sim.getSelectedBody();
      if (snapshot.scenario === "earth-pitch" && snapshot.earthPitch) {
        const pitch = snapshot.earthPitch;
        if (followRef.current && pitch.ball.flying) {
          cameraRef.current = {
            ...cameraRef.current,
            focus: { x: pitch.ball.position.x, y: pitch.ball.position.y }
          };
        } else {
          cameraRef.current = {
            ...cameraRef.current,
            focus: earthPitchCameraFocus(pitch, cameraRef.current.zoom)
          };
        }
      } else if (snapshot.scenario === "near-earth") {
        const sun = snapshot.bodies.find((b) => b.id === "sun");
        const followBody = followRef.current ? selectedBody : null;
        if (followBody) {
          cameraRef.current = {
            ...cameraRef.current,
            focus: { x: followBody.position.x, y: followBody.position.y }
          };
        } else if (sun) {
          cameraRef.current = {
            ...cameraRef.current,
            focus: { x: sun.position.x, y: sun.position.y }
          };
        }
      } else if (followRef.current && selectedBody) {
        cameraRef.current = {
          ...cameraRef.current,
          focus: { x: selectedBody.position.x, y: selectedBody.position.y }
        };
      }

      renderGravityOrbit(ctx, snapshot, {
        theme: canvasTheme,
        showTrails,
        showVelocityVectors,
        showForceVectors,
        showSweptArea,
        camera: cameraRef.current
      });
      setAvgSpeed(snapshot.averageSpeed);
      setKineticEnergy(snapshot.totalKineticEnergy);
      if (snapshot.scenario !== "earth-pitch") {
        setSelected(sim.getSelectedInfo());
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [
    canvasTheme,
    paused,
    running,
    showTrails,
    showVelocityVectors,
    showForceVectors,
    showSweptArea,
    sim
  ]);

  useEffect(() => {
    if (reducedMotion) {
      setShowTrails(false);
      setShowVelocityVectors(false);
      setShowForceVectors(false);
    }
  }, [reducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const el = canvas;

    function canvasPoint(event: PointerEvent): { x: number; y: number } {
      const rect = el.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * el.width;
      const y = ((event.clientY - rect.top) / rect.height) * el.height;
      return { x, y };
    }

    function onPointerDown(event: PointerEvent): void {
      const screen = canvasPoint(event);
      if (scenario === "playground") {
        dragRef.current = true;
        sim.setCenterPosition(screenToWorld(cameraRef.current, screen));
        return;
      }
      const world = screenToWorld(cameraRef.current, screen);
      const id = sim.pickBodyAt(world, cameraRef.current.zoom);
      if (id) {
        sim.selectBody(id);
        setSelected(sim.getSelectedInfo());
        if (followRef.current) {
          const body = sim.getSelectedBody();
          if (body) {
            cameraRef.current = {
              ...cameraRef.current,
              focus: { x: body.position.x, y: body.position.y }
            };
          }
        }
      }
    }

    function onPointerMove(event: PointerEvent): void {
      if (!dragRef.current || scenario !== "playground") {
        return;
      }
      sim.setCenterPosition(screenToWorld(cameraRef.current, canvasPoint(event)));
    }

    function onPointerUp(): void {
      dragRef.current = false;
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [sim, scenario]);

  function focusOnSelected(options?: { zoomIn?: boolean; enableFollow?: boolean }): void {
    const body = sim.getSelectedBody();
    if (!body) {
      return;
    }
    if (scenario === "near-earth") {
      const nextView = nearEarthViewForBody(body.id, body.distanceValue);
      setViewHalfWidthKm(nextView);
      sim.setViewHalfWidthKm(nextView);
    }
    const refreshed = sim.getSelectedBody() ?? body;
    cameraRef.current = {
      ...cameraRef.current,
      focus: { x: refreshed.position.x, y: refreshed.position.y }
    };
    if (options?.zoomIn) {
      setCameraZoom(zoomForBodyRadius(refreshed.drawRadius, refreshed.isCenter ? 70 : 52));
    }
    if (options?.enableFollow) {
      setFollowSelected(true);
    }
  }

  function resetCamera(): void {
    setFollowSelected(false);
    if (scenario === "earth-pitch") {
      const zoom = PITCH_DEFAULT_ZOOM;
      setCameraZoom(zoom);
      const pitch = sim.getEarthPitch();
      cameraRef.current = {
        ...defaultCamera(CANVAS_W, CANVAS_H),
        zoom,
        focus: pitch ? earthPitchCameraFocus(pitch, zoom) : defaultCamera(CANVAS_W, CANVAS_H).focus
      };
      return;
    }
    if (scenario === "near-earth") {
      setCameraZoom(1);
      setFollowSelected(false);
      sim.selectBody("earth");
      setSelected(sim.getSelectedInfo());
      cameraRef.current = defaultCamera(CANVAS_W, CANVAS_H);
      return;
    }
    setCameraZoom(1);
    cameraRef.current = defaultCamera(CANVAS_W, CANVAS_H);
  }

  function onReset(): void {
    sim.reset();
    setSelected(sim.getSelectedInfo());
    resetCamera();
    host?.onResult?.({
      event: "reset",
      scenario,
      centralMass,
      binaryBodyAMass,
      binaryBodyBMass,
      binaryEccentricity,
      showSweptArea,
      particleCount,
      selfGravity,
      viewHalfWidthKm
    });
  }

  function selectBodyById(id: string): void {
    sim.selectBody(id);
    setSelected(sim.getSelectedInfo());
    if (followSelected) {
      focusOnSelected({ enableFollow: true });
    }
  }

  function applyPitchPreset(presetId: PitchPresetId): void {
    sim.applyPitchPreset(presetId);
    const pitch = sim.getEarthPitch();
    if (pitch) {
      setPitchSpeed(pitch.speedFraction);
      setPitchRegime(pitch.regime);
      setScenarioNote(pitch.note);
    }
    setRunning(true);
    setPaused(false);
  }

  function onPitchSpeedChange(fraction: number): void {
    setPitchSpeed(fraction);
    sim.setPitchSpeedFraction(fraction);
    const pitch = sim.getEarthPitch();
    if (pitch) {
      setPitchRegime(pitch.regime);
      setScenarioNote(pitch.note);
    }
    setRunning(true);
    setPaused(false);
  }

  function onThrow(): void {
    if (isEarthPitch) {
      sim.resetPitch();
      setRunning(true);
      setPaused(false);
      return;
    }
    setRunning(true);
    setPaused(false);
  }

  function onNextPreset(): void {
    if (!isEarthPitch) {
      return;
    }
    const idx = PITCH_PRESETS.findIndex((p) => Math.abs(p.speedFraction - pitchSpeed) < 0.02);
    const next = PITCH_PRESETS[(idx + 1) % PITCH_PRESETS.length] ?? PITCH_PRESETS[0];
    applyPitchPreset(next.id);
  }

  function onStart(): void {
    setRunning(true);
    setPaused(false);
  }

  function onPauseToggle(): void {
    if (!running) {
      setRunning(true);
      setPaused(false);
      return;
    }
    setPaused((v) => !v);
  }

  async function toggleCanvasFullscreen(): Promise<void> {
    const shell = canvasShellRef.current;
    if (!shell) {
      return;
    }

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await shell.requestFullscreen();
      }
      setDisplayNotice("");
    } catch {
      setDisplayNotice("Fullscreen could not be opened in this browser.");
    }
  }

  function dockControls(): void {
    const popup = controlsPopupRef.current;
    controlsPopupCleanupRef.current?.();
    controlsPopupCleanupRef.current = null;
    controlsPopupRef.current = null;
    setControlsPortalTarget(null);
    if (popup && !popup.closed) {
      popup.close();
    }
  }

  function openControlsPopup(): void {
    const existingPopup = controlsPopupRef.current;
    if (existingPopup && !existingPopup.closed) {
      existingPopup.focus();
      return;
    }

    const popup = window.open(
      "",
      "gravity-orbit-controls",
      "popup=yes,width=420,height=900,resizable=yes,scrollbars=yes"
    );
    if (!popup) {
      setDisplayNotice("The controls pop-up was blocked. Allow pop-ups, then try again.");
      return;
    }

    const popupDocument = popup.document;
    popupDocument.documentElement.lang = document.documentElement.lang || "en";
    popupDocument.documentElement.dataset.theme =
      document.documentElement.dataset.theme ?? "dark";
    popupDocument.head.replaceChildren();
    popupDocument.body.replaceChildren();

    const title = popupDocument.createElement("title");
    title.textContent = "Gravity Orbit Controls";
    popupDocument.head.appendChild(title);

    const viewport = popupDocument.createElement("meta");
    viewport.name = "viewport";
    viewport.content = "width=device-width, initial-scale=1";
    popupDocument.head.appendChild(viewport);

    document
      .querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style')
      .forEach((source) => {
        const clone = source.cloneNode(true) as HTMLLinkElement | HTMLStyleElement;
        if (source instanceof HTMLLinkElement && clone instanceof HTMLLinkElement) {
          clone.href = source.href;
        }
        popupDocument.head.appendChild(clone);
      });

    popupDocument.body.className = "gravity-controls-popup-body";
    const portalRoot = popupDocument.createElement("div");
    portalRoot.className = "gravity-controls-popup-root";
    popupDocument.body.appendChild(portalRoot);

    function handlePopupClosed(): void {
      if (controlsPopupRef.current !== popup) {
        return;
      }
      controlsPopupCleanupRef.current?.();
      controlsPopupCleanupRef.current = null;
      controlsPopupRef.current = null;
      setControlsPortalTarget(null);
    }

    const themeObserver = new MutationObserver(() => {
      popupDocument.documentElement.dataset.theme =
        document.documentElement.dataset.theme ?? "dark";
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"]
    });

    const cleanup = (): void => {
      popup.removeEventListener("beforeunload", handlePopupClosed);
      popup.removeEventListener("pagehide", handlePopupClosed);
      themeObserver.disconnect();
    };
    popup.addEventListener("beforeunload", handlePopupClosed);
    popup.addEventListener("pagehide", handlePopupClosed);
    controlsPopupRef.current = popup;
    controlsPopupCleanupRef.current = cleanup;
    setControlsPortalTarget(portalRoot);
    setDisplayNotice("");
    popup.focus();
  }

  const isPlayground = scenario === "playground";
  const isBinary = scenario === "binary-system";
  const isNearEarth = scenario === "near-earth";
  const isEarthPitch = scenario === "earth-pitch";
  const isHistoric = scenario === "historic-models";
  const isNamedOrbit =
    isBinary || scenario === "solar-system" || scenario === "near-earth" || isHistoric;
  const scenarioMeta = SCENARIOS[scenario];
  const binarySnapshot = isBinary ? sim.getSnapshot().binarySystem : null;
  const historicMeta =
    HISTORIC_MODEL_OPTIONS.find((m) => m.id === historicModel) ?? HISTORIC_MODEL_OPTIONS[0];

  const overlayControls = (
    <div className="gravity-canvas-toolbar" role="toolbar" aria-label="Playback and display controls">
      <button type="button" onClick={onStart}>
        Start
      </button>
      <button type="button" onClick={onThrow}>
        {isEarthPitch ? "Throw" : "Run"}
      </button>
      <button type="button" onClick={onPauseToggle}>
        {running && !paused ? "Pause" : "Resume"}
      </button>
      <button type="button" onClick={onNextPreset} disabled={!isEarthPitch} title="Next pitch preset">
        Next
      </button>
      <button type="button" onClick={onReset}>
        Reset
      </button>
      <span className="gravity-toolbar-divider" aria-hidden="true" />
      <button
        type="button"
        className="gravity-display-button"
        onClick={() => void toggleCanvasFullscreen()}
        aria-label={isCanvasFullscreen ? "Exit full screen motion display" : "Maximise motion display"}
        title={isCanvasFullscreen ? "Exit full screen" : "Make the motion display full screen"}
      >
        <span aria-hidden="true">{isCanvasFullscreen ? "↙" : "⛶"}</span>{" "}
        {isCanvasFullscreen ? "Exit" : "Maximise"}
      </button>
      <button
        type="button"
        className="gravity-display-button"
        onClick={controlsPortalTarget ? dockControls : openControlsPopup}
        title={
          controlsPortalTarget
            ? "Return the controls to this page"
            : "Open the live controls in a movable window"
        }
      >
        <span aria-hidden="true">{controlsPortalTarget ? "↩" : "↗"}</span>{" "}
        {controlsPortalTarget ? "Dock controls" : "Pop out controls"}
      </button>
    </div>
  );

  const controlsPanel = (
      <ControlCard title="Gravity Orbits & The Solar System" subtitle={scenarioMeta.summary}>
        <div className="control-grid">
          <label className="control-span-2">
            What do you want to explore?
            <select
              value={scenario}
              onChange={(event) => setScenario(event.target.value as ScenarioId)}
              aria-label="Orbital scenario"
            >
              {SCENARIO_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <p className="gravity-scenario-note control-span-2">{scenarioNote}</p>

          {isPlayground ? (
            <>
              <label className="control-span-2">
                <span className="slider-label">
                  <span>Central mass</span>
                  <strong>{Math.round(centralMass)}</strong>
                </span>
                <input
                  type="range"
                  min={MASS_MIN}
                  max={MASS_MAX}
                  value={centralMass}
                  onChange={(event) => setCentralMass(Number(event.target.value))}
                />
              </label>

              <label className="control-span-2">
                <span className="slider-label">
                  <span>Number of particles</span>
                  <strong>{Math.round(particleCount)}</strong>
                </span>
                <input
                  type="range"
                  min={PARTICLE_MIN}
                  max={PARTICLE_MAX}
                  step={5}
                  value={particleCount}
                  onChange={(event) => setParticleCount(Number(event.target.value))}
                />
              </label>

              <label className="checkbox control-span-2">
                <input
                  type="checkbox"
                  checked={selfGravity}
                  onChange={(event) => setSelfGravity(event.target.checked)}
                />
                Let particles attract each other
              </label>
            </>
          ) : null}

          {isEarthPitch ? (
            <>
              <div className="gravity-selection control-span-2">
                <div className="gravity-selection-title">Newton’s pitch</div>
                <div className="gravity-selection-meta">
                  <span>
                    Regime: <strong>{pitchRegimeLabel(pitchRegime)}</strong>
                  </span>
                  <span>
                    Speed: <strong>{formatPitchSpeedFraction(pitchSpeed)}</strong>
                  </span>
                </div>
                <p>
                  Start zoomed in with a hard throw: the ground looks flat and the ball falls.
                  Zoom out to see the globe, then raise the speed toward circular (~1×) and escape
                  (~1.41×).
                </p>
              </div>

              <label className="control-span-2">
                <span className="slider-label">
                  <span>Pitch speed</span>
                  <strong>{formatPitchSpeedFraction(pitchSpeed)}</strong>
                </span>
                <input
                  type="range"
                  min={PITCH_SPEED_MIN}
                  max={PITCH_SPEED_MAX}
                  step={0.005}
                  value={pitchSpeed}
                  onChange={(event) => onPitchSpeedChange(Number(event.target.value))}
                />
                <span className="gravity-distance-hints">
                  Handy markers: hard throw ≈ 0.05× · circular 1.00× · escape ≈ 1.41×
                </span>
              </label>

              <div className="gravity-pitch-presets control-span-2" role="group" aria-label="Pitch presets">
                {PITCH_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    title={preset.blurb}
                    className={
                      Math.abs(pitchSpeed - preset.speedFraction) < 0.02
                        ? "gravity-pitch-preset is-selected"
                        : "gravity-pitch-preset"
                    }
                    onClick={() => applyPitchPreset(preset.id)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <label className="control-span-2">
                <span className="slider-label">
                  <span>Time scale</span>
                  <strong>{timeScale.toFixed(1)}×</strong>
                </span>
                <input
                  type="range"
                  min={0.2}
                  max={4}
                  step={0.1}
                  value={timeScale}
                  onChange={(event) => setTimeScale(Number(event.target.value))}
                />
              </label>

              <label className="control-span-2">
                <span className="slider-label">
                  <span>Camera zoom</span>
                  <strong>{cameraZoom.toFixed(1)}×</strong>
                </span>
                <input
                  type="range"
                  min={1}
                  max={PITCH_MAX_ZOOM}
                  step={0.5}
                  value={cameraZoom}
                  onChange={(event) =>
                    setCameraZoom(clampZoom(Number(event.target.value), PITCH_MAX_ZOOM))
                  }
                />
                <span className="gravity-distance-hints">
                  Zoom in for a flat “local” horizon; zoom out to see Earth as a globe again.
                </span>
              </label>

              <label className="checkbox control-span-2">
                <input
                  type="checkbox"
                  checked={followSelected}
                  onChange={(event) => setFollowSelected(event.target.checked)}
                />
                Follow the baseball
              </label>

              <div className="button-row control-span-2">
                <button
                  type="button"
                  onClick={onThrow}
                >
                  Throw
                </button>
                <button type="button" onClick={resetCamera}>
                  Reset camera
                </button>
              </div>
            </>
          ) : null}

          {isNamedOrbit ? (
            <>
              {isBinary ? (
                <>
                  <label className="control-span-2">
                    <span className="slider-label">
                      <span>Planet A mass</span>
                      <strong>{binaryBodyAMass.toFixed(1)} relative units</strong>
                    </span>
                    <input
                      type="range"
                      min={BINARY_MASS_MIN}
                      max={BINARY_MASS_MAX}
                      step={BINARY_MASS_STEP}
                      value={binaryBodyAMass}
                      onChange={(event) => setBinaryBodyAMass(Number(event.target.value))}
                    />
                  </label>

                  <label className="control-span-2">
                    <span className="slider-label">
                      <span>Planet B mass</span>
                      <strong>{binaryBodyBMass.toFixed(1)} relative units</strong>
                    </span>
                    <input
                      type="range"
                      min={BINARY_MASS_MIN}
                      max={BINARY_MASS_MAX}
                      step={BINARY_MASS_STEP}
                      value={binaryBodyBMass}
                      onChange={(event) => setBinaryBodyBMass(Number(event.target.value))}
                    />
                  </label>

                  <label className="control-span-2">
                    <span className="slider-label">
                      <span>Orbital eccentricity</span>
                      <strong>{binaryEccentricity.toFixed(2)}</strong>
                    </span>
                    <input
                      type="range"
                      min={BINARY_ECCENTRICITY_MIN}
                      max={BINARY_ECCENTRICITY_MAX}
                      step={BINARY_ECCENTRICITY_STEP}
                      value={binaryEccentricity}
                      onChange={(event) => setBinaryEccentricity(Number(event.target.value))}
                    />
                    <span className="gravity-distance-hints">
                      0 is circular · higher values make a more elongated orbit and a stronger
                      closest-approach speed-up
                    </span>
                  </label>

                  {binarySnapshot ? (
                    <div className="gravity-selection control-span-2" aria-live="polite">
                      <div className="gravity-selection-title">Shared center of mass</div>
                      <div className="gravity-selection-meta">
                        <span>
                          A semimajor radius:{" "}
                          <strong>
                            {(
                              (binarySnapshot.bodyAOrbitRadiusPx /
                                binarySnapshot.separationPx) *
                              100
                            ).toFixed(1)}%
                          </strong>
                        </span>
                        <span>
                          B semimajor radius:{" "}
                          <strong>
                            {(
                              (binarySnapshot.bodyBOrbitRadiusPx /
                                binarySnapshot.separationPx) *
                              100
                            ).toFixed(1)}%
                          </strong>
                        </span>
                        <span>
                          Separation now:{" "}
                          <strong>
                            {(
                              (binarySnapshot.currentSeparationPx /
                                binarySnapshot.separationPx) *
                              100
                            ).toFixed(0)}%
                          </strong>
                        </span>
                      </div>
                      <p>
                        The cross is the barycenter and the shared focus of both ellipses. At every
                        moment, m<sub>A</sub>r<sub>A</sub> = m<sub>B</sub>r<sub>B</sub>, so the
                        heavier planet stays closer. Closest-to-farthest separation runs from{" "}
                        <strong>
                          {(
                            (binarySnapshot.periapsisSeparationPx /
                              binarySnapshot.separationPx) *
                            100
                          ).toFixed(0)}%
                        </strong>{" "}
                        to{" "}
                        <strong>
                          {(
                            (binarySnapshot.apoapsisSeparationPx /
                              binarySnapshot.separationPx) *
                            100
                          ).toFixed(0)}%
                        </strong>{" "}
                        of the semimajor axis.
                      </p>
                    </div>
                  ) : null}

                  <label
                    className={`checkbox gravity-kepler-toggle control-span-2${
                      showSweptArea ? " is-active" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={showSweptArea}
                      onChange={(event) => setShowSweptArea(event.target.checked)}
                    />
                    <span>Kepler’s 2nd law · show equal-time area</span>
                  </label>
                  {showSweptArea ? (
                    <span className="gravity-distance-hints control-span-2">
                      Each shaded wedge spans the previous 10% of a period. Its shape changes
                      around the ellipse, but its swept area stays constant.
                    </span>
                  ) : null}
                </>
              ) : null}

              <label className="control-span-2">
                <span className="slider-label">
                  <span>Time scale</span>
                  <strong>{timeScale.toFixed(1)}×</strong>
                </span>
                <input
                  type="range"
                  min={0.2}
                  max={8}
                  step={0.1}
                  value={timeScale}
                  onChange={(event) => setTimeScale(Number(event.target.value))}
                />
              </label>

              {isHistoric ? (
                <div className="control-span-2">
                  <label>
                    Historical model
                    <select
                      value={historicModel}
                      onChange={(event) => setHistoricModel(event.target.value as HistoricModelId)}
                      aria-label="Historical Solar System model"
                    >
                      {HISTORIC_MODEL_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label} ({opt.yearHint})
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="gravity-distance-hints" style={{ marginTop: "0.45rem" }}>
                    <strong>{historicMeta.bizarreHook}</strong> {historicMeta.summary} Leave trails
                    on; in Ptolemy, keep Mars selected to watch the epicycle loops.
                  </p>
                </div>
              ) : null}

              {isNearEarth ? (
                <label className="control-span-2">
                  <span className="slider-label">
                    <span>How much space is in view?</span>
                    <strong>{formatDistance(viewHalfWidthKm, "km")}</strong>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={0.1}
                    value={kmToSlider(viewHalfWidthKm)}
                    onChange={(event) => setViewHalfWidthKm(sliderToKm(Number(event.target.value)))}
                  />
                  <span className="gravity-distance-hints">
                    Opens the neighborhood around Earth (ISS → Moon → JWST). The Sun stays on
                    stage and Earth keeps orbiting it — the Earth–Sun gap is compressed when
                    you zoom in so the year orbit remains visible.
                  </span>
                </label>
              ) : null}

              <label className="control-span-2">
                <span className="slider-label">
                  <span>Camera zoom</span>
                  <strong>{cameraZoom.toFixed(1)}×</strong>
                </span>
                <input
                  type="range"
                  min={1}
                  max={12}
                  step={0.1}
                  value={cameraZoom}
                  onChange={(event) => setCameraZoom(clampZoom(Number(event.target.value), 16))}
                />
              </label>

              <label className="checkbox control-span-2">
                <input
                  type="checkbox"
                  checked={followSelected}
                  onChange={(event) => {
                    const next = event.target.checked;
                    setFollowSelected(next);
                    if (next) {
                      focusOnSelected({ enableFollow: true });
                    }
                  }}
                />
                Keep the camera on the selected body
              </label>

              <div className="button-row control-span-2">
                <button
                  type="button"
                  disabled={!selected}
                  onClick={() => focusOnSelected({ zoomIn: true, enableFollow: true })}
                >
                  Zoom & follow
                </button>
                <button type="button" onClick={resetCamera}>
                  Reset camera
                </button>
              </div>

              {selected ? (
                <div className="gravity-selection control-span-2" aria-live="polite">
                  <div className="gravity-selection-title">{selected.name}</div>
                  <div className="gravity-selection-meta">
                    {selected.massLabel ? (
                      <span>
                        Mass: <strong>{selected.massLabel}</strong>
                      </span>
                    ) : null}
                    <span>
                      Distance: <strong>{selected.distanceLabel}</strong>
                    </span>
                    <span>
                      Period: <strong>{selected.periodLabel}</strong>
                    </span>
                  </div>
                  <p>{selected.description}</p>
                </div>
              ) : (
                <p className="subtle control-span-2">
                  Click a body (or a chip below) to select it, then try Follow or Zoom & follow.
                </p>
              )}

              <div className="gravity-body-list control-span-2" role="list">
                {(scenario === "solar-system"
                  ? SCENARIOS["solar-system"].bodies
                  : scenario === "near-earth"
                    ? SCENARIOS["near-earth"].bodies
                    : sim.getSnapshot().bodies.map((b) => ({
                        id: b.id,
                        shortLabel: b.shortLabel
                      }))
                ).map((body) => (
                  <button
                    key={body.id}
                    type="button"
                    role="listitem"
                    className={
                      selected?.id === body.id ? "gravity-body-chip is-selected" : "gravity-body-chip"
                    }
                    onClick={() => selectBodyById(body.id)}
                  >
                    {body.shortLabel}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          <label className="checkbox">
            <input
              type="checkbox"
              checked={showTrails}
              onChange={(event) => setShowTrails(event.target.checked)}
            />
            Show trails
          </label>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={showVelocityVectors}
              onChange={(event) => setShowVelocityVectors(event.target.checked)}
            />
            Show velocity (green)
          </label>

          <label className="checkbox control-span-2">
            <input
              type="checkbox"
              checked={showForceVectors}
              onChange={(event) => setShowForceVectors(event.target.checked)}
            />
            Show gravitational pull (orange)
          </label>

          <div className="button-row control-span-2">
            <button type="button" onClick={onStart}>
              Start
            </button>
            <button type="button" onClick={onThrow}>
              {isEarthPitch ? "Throw" : "Run"}
            </button>
            <button type="button" onClick={onPauseToggle}>
              {running && !paused ? "Pause" : "Resume"}
            </button>
            <button type="button" onClick={onNextPreset} disabled={!isEarthPitch}>
              Next
            </button>
            <button type="button" onClick={onReset}>
              Reset
            </button>
          </div>

          <div className="stats control-span-2">
            {isPlayground ? (
              <>
                <div>
                  Particles: <strong>{Math.round(particleCount)}</strong>
                </div>
                <div>
                  Avg speed: <strong>{formatNumber(avgSpeed)}</strong>
                </div>
                <div>
                  Kinetic energy: <strong>{Math.round(kineticEnergy)}</strong>
                </div>
              </>
            ) : isEarthPitch ? (
              <>
                <div>
                  Regime: <strong>{pitchRegimeLabel(pitchRegime)}</strong>
                </div>
                <div>
                  Camera:{" "}
                  <strong>
                    {followSelected ? "following ball" : "scene"} · {cameraZoom.toFixed(1)}×
                  </strong>
                </div>
              </>
            ) : isBinary && binarySnapshot ? (
              <>
                <div>
                  Total mass:{" "}
                  <strong>{(binarySnapshot.bodyAMass + binarySnapshot.bodyBMass).toFixed(1)}</strong>
                </div>
                <div>
                  Orbit period: <strong>{binarySnapshot.orbitalPeriodSeconds.toFixed(1)} sim s</strong>
                </div>
                <div>
                  Eccentricity: <strong>{binarySnapshot.eccentricity.toFixed(2)}</strong>
                </div>
                <div>
                  Barycenter: <strong>fixed at the shared focus</strong>
                </div>
              </>
            ) : (
              <>
                <div>
                  Scenario: <strong>{scenarioMeta.title}</strong>
                </div>
                <div>
                  Camera:{" "}
                  <strong>
                    {followSelected ? "following" : "free"} · {cameraZoom.toFixed(1)}×
                  </strong>
                </div>
              </>
            )}
          </div>
        </div>
      </ControlCard>
  );

  const renderedControls = controlsPortalTarget
    ? createPortal(
        <div className="gravity-controls-popup-content">
          <div className="gravity-controls-popup-toolbar">
            <span>Live controls</span>
            <button type="button" onClick={dockControls}>
              Return controls
            </button>
          </div>
          {controlsPanel}
        </div>,
        controlsPortalTarget
      )
    : controlsPanel;

  return (
    <div className={`gravity-layout${controlsPortalTarget ? " has-detached-controls" : ""}`}>
      {renderedControls}

      <div ref={canvasShellRef} className="canvas-shell card gravity-canvas-shell">
        <div className="gravity-canvas-frame">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            style={{ cursor: isPlayground ? "grab" : "pointer" }}
          />
          {overlayControls}
        </div>
        {displayNotice ? (
          <p className="gravity-display-notice" role="status">
            {displayNotice}
          </p>
        ) : null}
      </div>
    </div>
  );
}
