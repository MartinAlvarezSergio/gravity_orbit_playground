import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { logicalPointer, setLogicalTransform } from "../../core/canvasScale";
import { AppletHostAdapter } from "../../core/host";
import { AppletStage } from "../../ui/stage/AppletStage";
import {
  StageDivider,
  StageHero,
  StageIconButton,
  StagePillButton,
  StagePills,
  StageReadout,
  StageSection,
  StageSelect,
  StageSlider,
  StageToggle
} from "../../ui/stage/StageControls";
import "./gravityStage.css";
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

/** Pitch speed without the unit, for the large readout (the label carries "× v_circ"). */
function pitchSpeedNumber(fraction: number): string {
  return formatPitchSpeedFraction(fraction).replace(/\s*×\s*v_circ$/, "×");
}

const TIP = {
  scenario: "What do you want to explore?",
  play: "Start / Run the motion, or pause and resume it.",
  throwBall: "Throw the ball again from the pitcher at the current pitch speed.",
  next: "Next pitch preset",
  reset: "Restart the motion from its starting positions and reset the camera.",
  popOut: "Open the live controls in a movable window",
  dock: "Return the controls to this page",
  centralMass: "Mass of the central “star”. Drag the star on the canvas to move it.",
  particles: "Number of particles orbiting the central mass.",
  selfGravity: "Particle–particle gravity (softened). Off: each particle feels only the central mass.",
  pitchSpeed:
    "Launch speed as a multiple of circular-orbit speed (v_circ).\nHandy markers: hard throw ≈ 0.05× · circular 1.00× · escape ≈ 1.41×",
  timeScale: "How fast simulated time runs.",
  pitchZoom: "Zoom in for a flat “local” horizon; zoom out to see Earth as a globe again.",
  cameraZoom: "Magnify the view around the camera’s focus.",
  followBall: "Keep the camera on the ball while it flies.",
  resetCamera: "Return to the starting view.",
  massA: "Mass of planet A, in relative units.",
  massB: "Mass of planet B, in relative units.",
  eccentricity:
    "0 is circular · higher values make a more elongated orbit and a stronger closest-approach speed-up",
  nearEarthView:
    "Opens the neighborhood around Earth (ISS → Moon → JWST). The Sun stays on stage and Earth keeps orbiting it — the Earth–Sun gap is compressed when you zoom in so the year orbit remains visible.",
  followSelected: "The camera tracks the selected body as it moves.",
  zoomFollow: "Zoom in on the selected body and keep the camera on it.",
  noSelection: "Click a body (or a chip under Bodies) to select it, then try Follow or Zoom & follow.",
  trails: "Draw each body’s recent path.",
  velocity: "Green arrows: velocity of each moving body.",
  force: "Orange arrows: gravitational pull on each moving body.",
  forceHistoric: "Orange arrows: gravitational pull. Historic models are kinematic, so they show none.",
  regime: "What this launch speed does: falls back, circles, stays bound on an ellipse, or escapes.",
  semimajorA: "Size of A’s ellipse around the barycenter, as a share of the relative semimajor axis.",
  semimajorB: "Size of B’s ellipse around the barycenter, as a share of the relative semimajor axis.",
  separationNow: "Current A–B distance, as a share of the semimajor axis.",
  separationRange: "Closest-to-farthest separation over one orbit, as a share of the semimajor axis.",
  barycenter: "Fixed at the shared focus of both ellipses.",
  avgSpeed: "Mean particle speed (simulation units).",
  kineticEnergy: "Total kinetic energy of the particles (simulation units).",
  gapCompressed: "1 AU is drawn shorter than the slider scale so Earth’s year orbit stays on screen."
} as const;

export function GravityOrbitCanvas({ host }: GravityOrbitCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
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
  const [ballFlying, setBallFlying] = useState(true);
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

      // The backing store is at device resolution; draw in the logical 900 × 620 units.
      setLogicalTransform(ctx, CANVAS_W);
      renderGravityOrbit(ctx, snapshot, {
        theme: canvasTheme,
        showTrails,
        showVelocityVectors,
        showForceVectors,
        showSweptArea,
        camera: cameraRef.current,
        // The stage readouts carry the HUD's numbers; its arrow key is in the info panel.
        showHud: false
      });
      setAvgSpeed(snapshot.averageSpeed);
      setKineticEnergy(snapshot.totalKineticEnergy);
      if (snapshot.earthPitch) {
        setBallFlying(snapshot.earthPitch.ball.flying);
      }
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
      return logicalPointer(event, el, CANVAS_W, CANVAS_H);
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

  const moving = running && !paused;
  const playLabel = !running ? "Start" : paused ? "Resume" : "Pause";
  const onPlay = running ? onPauseToggle : onStart;
  const popped = controlsPortalTarget !== null;
  const lightSurface = canvasTheme === "light";
  const pct = (value: number, digits: number): string => `${(value * 100).toFixed(digits)}%`;
  const binaryShare = (px: number): number => (binarySnapshot ? px / binarySnapshot.separationPx : 0);
  const sweptPercent = binarySnapshot ? (binarySnapshot.sweepPeriodFraction * 100).toFixed(0) : "10";
  const historicHint = `${historicMeta.bizarreHook} ${historicMeta.summary} Leave trails on; in Ptolemy, keep Mars selected to watch the epicycle loops.`;
  const keplerHint = `Each shaded wedge spans the previous ${sweptPercent}% of a period. Its shape changes around the ellipse, but its swept area stays constant.`;
  const gapCompressed = isNearEarth && viewHalfWidthKm < AU_KM * 0.85;
  const selectedBody = isBinary && selected ? sim.getSelectedBody() : null;
  const bodyChips: { id: string; shortLabel: string; name: string }[] = !isNamedOrbit
    ? []
    : scenario === "solar-system"
      ? SCENARIOS["solar-system"].bodies
      : scenario === "near-earth"
        ? SCENARIOS["near-earth"].bodies
        : sim.getSnapshot().bodies.map((b) => ({ id: b.id, shortLabel: b.shortLabel, name: b.name }));

  /** Scenario switch and transport: the stage top bar, repeated in the pop-out window. */
  const transport = (
    <>
      <StageSelect
        ariaLabel="Orbital scenario"
        tip={`${TIP.scenario}\n${scenarioMeta.summary}`}
        value={scenario}
        options={SCENARIO_OPTIONS.map((opt) => ({ value: opt.id, label: opt.label }))}
        onChange={setScenario}
      />
      <StageDivider />
      <StageIconButton icon={moving ? "pause" : "play"} label={playLabel} tip={TIP.play} onClick={onPlay} />
      {isEarthPitch ? (
        <>
          <StagePillButton label="Throw" tip={TIP.throwBall} onClick={onThrow} />
          <StageIconButton icon="step" label="Next" tip={TIP.next} onClick={onNextPreset} />
        </>
      ) : null}
      <StageIconButton icon="reset" label="Reset" tip={TIP.reset} onClick={onReset} />
    </>
  );

  const toolbar = (
    <>
      {transport}
      <StageDivider />
      <StageIconButton
        icon="popout"
        label={popped ? "Dock controls" : "Pop out controls"}
        tip={popped ? TIP.dock : TIP.popOut}
        pressed={popped}
        onClick={popped ? dockControls : openControlsPopup}
      />
    </>
  );

  const displayToggles = (
    <StageSection title="Display">
      <div className="stage-pills gravity-long-pills">
        <StageToggle label="Show trails" on={showTrails} tip={TIP.trails} onChange={setShowTrails} />
        <StageToggle
          label="Show velocity (green)"
          on={showVelocityVectors}
          tip={TIP.velocity}
          onChange={setShowVelocityVectors}
        />
        <StageToggle
          label="Show gravitational pull (orange)"
          on={showForceVectors}
          tip={isHistoric ? TIP.forceHistoric : TIP.force}
          onChange={setShowForceVectors}
        />
      </div>
    </StageSection>
  );

  const controls = (
    <>
      {displayNotice ? (
        <p className="gravity-notice" role="status">
          {displayNotice}
        </p>
      ) : null}

      {isPlayground ? (
        <>
          <StageSlider
            label="Central mass"
            display={String(Math.round(centralMass))}
            value={centralMass}
            min={MASS_MIN}
            max={MASS_MAX}
            step={1}
            tip={TIP.centralMass}
            onChange={setCentralMass}
          />
          <StageSlider
            label="Number of particles"
            display={String(Math.round(particleCount))}
            value={particleCount}
            min={PARTICLE_MIN}
            max={PARTICLE_MAX}
            step={5}
            tip={TIP.particles}
            onChange={setParticleCount}
          />
          <div className="stage-pills gravity-long-pills">
            <StageToggle
              label="Let particles attract each other"
              on={selfGravity}
              tip={TIP.selfGravity}
              onChange={setSelfGravity}
            />
          </div>
        </>
      ) : null}

      {isEarthPitch ? (
        <>
          <StageSlider
            label="Pitch speed"
            display={formatPitchSpeedFraction(pitchSpeed)}
            value={pitchSpeed}
            min={PITCH_SPEED_MIN}
            max={PITCH_SPEED_MAX}
            step={0.005}
            tip={TIP.pitchSpeed}
            onChange={onPitchSpeedChange}
          />
          <div className="stage-pills stage-presets gravity-long-pills" role="group" aria-label="Pitch presets">
            {PITCH_PRESETS.map((preset) => (
              <StageToggle
                key={preset.id}
                label={preset.label}
                tip={preset.blurb}
                on={Math.abs(pitchSpeed - preset.speedFraction) < 0.02}
                onChange={() => applyPitchPreset(preset.id)}
              />
            ))}
          </div>
          <StageSlider
            label="Time scale"
            display={`${timeScale.toFixed(1)}×`}
            value={timeScale}
            min={0.2}
            max={4}
            step={0.1}
            tip={TIP.timeScale}
            onChange={setTimeScale}
          />
          <StageSection title="Camera">
            <StageSlider
              label="Camera zoom"
              display={`${cameraZoom.toFixed(1)}×`}
              value={cameraZoom}
              min={1}
              max={PITCH_MAX_ZOOM}
              step={0.5}
              tip={TIP.pitchZoom}
              onChange={(value) => setCameraZoom(clampZoom(value, PITCH_MAX_ZOOM))}
            />
            <StagePills>
              <StageToggle
                label="Follow the baseball"
                on={followSelected}
                tip={TIP.followBall}
                onChange={setFollowSelected}
              />
              <StagePillButton label="Reset camera" tip={TIP.resetCamera} onClick={resetCamera} />
            </StagePills>
          </StageSection>
        </>
      ) : null}

      {isNamedOrbit ? (
        <>
          {isBinary ? (
            <StageSection title="Two bodies">
              <StageSlider
                label="Planet A mass"
                display={`${binaryBodyAMass.toFixed(1)} relative units`}
                value={binaryBodyAMass}
                min={BINARY_MASS_MIN}
                max={BINARY_MASS_MAX}
                step={BINARY_MASS_STEP}
                tip={TIP.massA}
                onChange={setBinaryBodyAMass}
              />
              <StageSlider
                label="Planet B mass"
                display={`${binaryBodyBMass.toFixed(1)} relative units`}
                value={binaryBodyBMass}
                min={BINARY_MASS_MIN}
                max={BINARY_MASS_MAX}
                step={BINARY_MASS_STEP}
                tip={TIP.massB}
                onChange={setBinaryBodyBMass}
              />
              <StageSlider
                label="Orbital eccentricity"
                display={binaryEccentricity.toFixed(2)}
                value={binaryEccentricity}
                min={BINARY_ECCENTRICITY_MIN}
                max={BINARY_ECCENTRICITY_MAX}
                step={BINARY_ECCENTRICITY_STEP}
                tip={TIP.eccentricity}
                onChange={setBinaryEccentricity}
              />
              <div className="stage-pills gravity-long-pills">
                <StageToggle
                  label="Kepler’s 2nd law · show equal-time area"
                  on={showSweptArea}
                  tip={keplerHint}
                  onChange={setShowSweptArea}
                />
              </div>
            </StageSection>
          ) : null}

          {isHistoric ? (
            <StageSelect
              label="Historical model"
              ariaLabel="Historical Solar System model"
              tip={historicHint}
              value={historicModel}
              options={HISTORIC_MODEL_OPTIONS.map((opt) => ({
                value: opt.id,
                label: `${opt.label} (${opt.yearHint})`
              }))}
              onChange={setHistoricModel}
            />
          ) : null}

          <StageSlider
            label="Time scale"
            display={`${timeScale.toFixed(1)}×`}
            value={timeScale}
            min={0.2}
            max={8}
            step={0.1}
            tip={TIP.timeScale}
            onChange={setTimeScale}
          />

          <StageSection title="Camera">
            {isNearEarth ? (
              <StageSlider
                label="How much space is in view?"
                display={formatDistance(viewHalfWidthKm, "km")}
                value={kmToSlider(viewHalfWidthKm)}
                min={0}
                max={100}
                step={0.1}
                tip={TIP.nearEarthView}
                onChange={(value) => setViewHalfWidthKm(sliderToKm(value))}
              />
            ) : null}
            <StageSlider
              label="Camera zoom"
              display={`${cameraZoom.toFixed(1)}×`}
              value={cameraZoom}
              min={1}
              max={12}
              step={0.1}
              tip={TIP.cameraZoom}
              onChange={(value) => setCameraZoom(clampZoom(value, 16))}
            />
            <div className="stage-pills gravity-long-pills">
              <StageToggle
                label="Keep the camera on the selected body"
                on={followSelected}
                tip={TIP.followSelected}
                onChange={(next) => {
                  setFollowSelected(next);
                  if (next) {
                    focusOnSelected({ enableFollow: true });
                  }
                }}
              />
            </div>
            <div className="stage-pills gravity-pill-pair">
              <StagePillButton
                label="Zoom & follow"
                tip={TIP.zoomFollow}
                disabled={!selected}
                onClick={() => focusOnSelected({ zoomIn: true, enableFollow: true })}
              />
              <StagePillButton label="Reset camera" tip={TIP.resetCamera} onClick={resetCamera} />
            </div>
          </StageSection>

          <StageSection title="Bodies">
            <div className="stage-pills" role="list">
              {bodyChips.map((body) => (
                <span key={body.id} role="listitem">
                  <StageToggle
                    label={body.shortLabel}
                    tip={body.name}
                    on={selected?.id === body.id}
                    onChange={() => selectBodyById(body.id)}
                  />
                </span>
              ))}
            </div>
          </StageSection>
        </>
      ) : null}

      {displayToggles}
    </>
  );

  const cameraReadout = isEarthPitch
    ? `${followSelected ? "following ball" : "scene"} · ${cameraZoom.toFixed(1)}×`
    : `${followSelected ? "following" : "free"} · ${cameraZoom.toFixed(1)}×`;

  const selectedReadouts = !isNamedOrbit ? null : selected ? (
    <div className="gravity-readout-wrap" aria-live="polite">
      <StageReadout label="Selected" value={selected.name} tip={selected.description} />
      {selected.massLabel ? <StageReadout label="Mass" value={selected.massLabel} /> : null}
      <StageReadout
        label="Distance"
        value={selectedBody && !selectedBody.isCenter ? pct(selectedBody.distanceValue, 1) : selected.distanceLabel}
        tip={selectedBody ? selected.distanceLabel : undefined}
      />
      <StageReadout label="Period" value={selected.periodLabel} />
    </div>
  ) : (
    <StageReadout label="Selected" value="none" muted tip={TIP.noSelection} />
  );

  const readouts = (
    <>
      {isPlayground ? (
        <>
          <StageReadout label="Particles" value={String(Math.round(particleCount))} />
          <StageReadout label="Avg speed" value={formatNumber(avgSpeed)} tip={TIP.avgSpeed} />
          <StageReadout label="Kinetic energy" value={String(Math.round(kineticEnergy))} tip={TIP.kineticEnergy} />
        </>
      ) : null}

      {isEarthPitch ? (
        <>
          <StageHero label="Speed" value={pitchSpeedNumber(pitchSpeed)} tip={TIP.pitchSpeed} />
          <div className="gravity-readout-wrap">
            <StageReadout label="Regime" value={pitchRegimeLabel(pitchRegime)} tip={TIP.regime} />
          </div>
          <StageReadout label="Ball" value={ballFlying ? "in flight" : "impact"} />
        </>
      ) : null}

      {isBinary && binarySnapshot ? (
        <>
          <StageHero
            label="Separation now"
            value={pct(binaryShare(binarySnapshot.currentSeparationPx), 0)}
            tip={TIP.separationNow}
          />
          <StageReadout
            label="Closest-to-farthest"
            value={`${pct(binaryShare(binarySnapshot.periapsisSeparationPx), 0)}–${pct(
              binaryShare(binarySnapshot.apoapsisSeparationPx),
              0
            )}`}
            tip={TIP.separationRange}
          />
          <StageReadout
            label="A semimajor radius"
            value={pct(binaryShare(binarySnapshot.bodyAOrbitRadiusPx), 1)}
            tip={TIP.semimajorA}
          />
          <StageReadout
            label="B semimajor radius"
            value={pct(binaryShare(binarySnapshot.bodyBOrbitRadiusPx), 1)}
            tip={TIP.semimajorB}
          />
          <StageReadout label="Total mass" value={(binarySnapshot.bodyAMass + binarySnapshot.bodyBMass).toFixed(1)} />
          <StageReadout label="Orbit period" value={`${binarySnapshot.orbitalPeriodSeconds.toFixed(1)} sim s`} />
          <StageReadout label="Eccentricity" value={binarySnapshot.eccentricity.toFixed(2)} />
          <StageReadout label="Barycenter" value="fixed" muted tip={TIP.barycenter} />
          <span className="gravity-readout-sep" aria-hidden="true" />
        </>
      ) : null}

      {selectedReadouts}
      {gapCompressed ? <StageReadout label="Earth–Sun gap" value="compressed" muted tip={TIP.gapCompressed} /> : null}
      {isPlayground ? null : <StageReadout label="Camera" value={cameraReadout} muted />}
    </>
  );

  const info = (
    <>
      <h4>{scenarioMeta.title}</h4>
      <ul>
        <li>{scenarioMeta.summary}</li>
        <li>{scenarioMeta.note}</li>
        {scenarioNote && scenarioNote !== scenarioMeta.note ? <li>{scenarioNote}</li> : null}
      </ul>

      {isEarthPitch ? (
        <>
          <h4>Newton’s pitch</h4>
          <ul>
            <li>
              Start zoomed in with a hard throw: the ground looks flat and the ball falls. Zoom out to see the globe, then
              raise the speed toward circular (~1×) and escape (~1.41×).
            </li>
            <li>Handy markers: hard throw ≈ 0.05× · circular 1.00× · escape ≈ 1.41×</li>
            <li>Zoom in for a flat “local” horizon; zoom out to see Earth as a globe again.</li>
          </ul>
        </>
      ) : null}

      {isBinary && binarySnapshot ? (
        <>
          <h4>Shared center of mass</h4>
          <ul>
            <li>
              The cross is the barycenter and the shared focus of both ellipses. At every moment, m<sub>A</sub>r
              <sub>A</sub> = m<sub>B</sub>r<sub>B</sub>, so the heavier planet stays closer. Closest-to-farthest
              separation runs from {pct(binaryShare(binarySnapshot.periapsisSeparationPx), 0)} to{" "}
              {pct(binaryShare(binarySnapshot.apoapsisSeparationPx), 0)} of the semimajor axis.
            </li>
            <li>Eccentricity: 0 is circular · higher values make a more elongated orbit and a stronger closest-approach speed-up.</li>
            <li>Kepler’s 2nd law: {keplerHint}</li>
          </ul>
        </>
      ) : null}

      {isHistoric ? (
        <>
          <h4>
            {historicMeta.label} · {historicMeta.yearHint}
          </h4>
          <ul>
            <li>
              <strong>{historicMeta.bizarreHook}</strong> {historicMeta.summary} Leave trails on; in Ptolemy, keep Mars
              selected to watch the epicycle loops.
            </li>
            <li>Historic models are kinematic cartoons, so they draw no gravitational-pull arrows.</li>
          </ul>
        </>
      ) : null}

      {isNearEarth ? (
        <>
          <h4>How much space is in view?</h4>
          <ul>
            <li>{TIP.nearEarthView}</li>
          </ul>
        </>
      ) : null}

      {isNamedOrbit ? (
        <>
          <h4>{selected ? selected.name : "Selecting a body"}</h4>
          <ul>
            {selected ? <li>{selected.description}</li> : null}
            <li>{TIP.noSelection}</li>
          </ul>
        </>
      ) : null}

      <h4>Colour key</h4>
      <ul>
        <li>Green arrows: velocity. Orange arrows: gravitational pull. Lengths are scaled for readability.</li>
        {isNamedOrbit ? <li>A dashed ring marks the selected body.</li> : null}
      </ul>
    </>
  );

  const popupContent = controlsPortalTarget
    ? createPortal(
        <div className={`stage gravity-popup-stage${lightSurface ? " is-light" : ""}`}>
          <div className="stage-glass stage-topbar">
            {transport}
            <StageDivider />
            <StagePillButton label="Return controls" tip={TIP.dock} onClick={dockControls} />
          </div>
          <div className="stage-glass stage-controls">{controls}</div>
          <div className="stage-glass stage-readouts">{readouts}</div>
        </div>,
        controlsPortalTarget
      )
    : null;

  return (
    <>
      <AppletStage
        logicalWidth={CANVAS_W}
        logicalHeight={CANVAS_H}
        canvasRef={canvasRef}
        canvasLabel={`Orbital motion: ${scenarioMeta.title}`}
        canvasProps={{ style: { cursor: isPlayground ? "grab" : "pointer" } }}
        toolbar={toolbar}
        controls={popped ? undefined : controls}
        readouts={readouts}
        info={info}
        play={{ visible: !running || paused, label: playLabel, onClick: onPlay }}
        surface={lightSurface ? "light" : "dark"}
        rootClassName="gravity-stage"
      />
      {popupContent}
    </>
  );
}
