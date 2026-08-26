import { useEffect, useMemo, useRef, useState } from "react";
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
  NEAR_EARTH_VIEW_DEFAULT_KM,
  NEAR_EARTH_VIEW_MAX_KM,
  NEAR_EARTH_VIEW_MIN_KM,
  SCENARIOS,
  SCENARIO_OPTIONS,
  formatDistance
} from "./scenarios";
import { createGravityOrbitSim } from "./sim";
import { renderGravityOrbit } from "./render";
import { ScenarioId, SelectedBodyInfo } from "./types";

const MASS_MIN = 20;
const MASS_MAX = 320;
const MASS_DEFAULT = 120;
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

export function GravityOrbitCanvas({ host }: GravityOrbitCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef(false);
  const cameraRef = useRef<CameraView>(defaultCamera(CANVAS_W, CANVAS_H));
  const followRef = useRef(false);

  const [scenario, setScenario] = useState<ScenarioId>("solar-system");
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [centralMass, setCentralMass] = useState(MASS_DEFAULT);
  const [particleCount, setParticleCount] = useState(PARTICLE_DEFAULT);
  const [selfGravity, setSelfGravity] = useState(false);
  const [showVelocityVectors, setShowVelocityVectors] = useState(false);
  const [showForceVectors, setShowForceVectors] = useState(false);
  const [showTrails, setShowTrails] = useState(true);
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
    }
  }, [scenario, sim]);

  useEffect(() => {
    sim.setCenterMass(centralMass);
  }, [centralMass, sim]);

  useEffect(() => {
    sim.setParticleCount(particleCount);
  }, [particleCount, sim]);

  useEffect(() => {
    sim.setSelfGravity(selfGravity);
  }, [selfGravity, sim]);

  useEffect(() => {
    sim.setViewHalfWidthKm(viewHalfWidthKm);
  }, [viewHalfWidthKm, sim]);

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
      } else if (followRef.current && selectedBody) {
        cameraRef.current = {
          ...cameraRef.current,
          focus: { x: selectedBody.position.x, y: selectedBody.position.y }
        };
      }

      renderGravityOrbit(ctx, snapshot, {
        showTrails,
        showVelocityVectors,
        showForceVectors,
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
  }, [paused, running, showTrails, showVelocityVectors, showForceVectors, sim]);

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
    if (scenario === "near-earth" && !body.isCenter) {
      const nextView = clampNearEarthViewForBody(body.distanceValue);
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

  const isPlayground = scenario === "playground";
  const isNearEarth = scenario === "near-earth";
  const isEarthPitch = scenario === "earth-pitch";
  const isNamedOrbit = scenario === "solar-system" || scenario === "near-earth";
  const scenarioMeta = SCENARIOS[scenario];

  const overlayControls = (
    <div className="gravity-canvas-toolbar" role="toolbar" aria-label="Playback controls">
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
    </div>
  );

  return (
    <div className="gravity-layout">
      <ControlCard title="Gravity Orbit Controls" subtitle={scenarioMeta.summary}>
        <div className="control-grid">
          <label className="control-span-2">
            Scenario
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
                  <span>Central mass:</span>
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
                  <span>Number of particles:</span>
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
                Enable self-gravity between particles
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
                  Default is a fast everyday pitch (≪ v_circ) with the camera zoomed in so Earth looks
                  flat. Zoom out to recover the globe, then raise speed toward circular / escape.
                </p>
              </div>

              <label className="control-span-2">
                <span className="slider-label">
                  <span>Pitch speed:</span>
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
                  Markers: fast ≈ 0.05× · circular 1.00× · escape ≈ 1.41×
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
                  <span>Orbit time scale:</span>
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
                  <span>Camera zoom:</span>
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
                  Zoom in: ground flattens (pitcher/ball stay fixed size). Zoom out: Earth becomes a
                  globe again.
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
              <label className="control-span-2">
                <span className="slider-label">
                  <span>Orbit time scale:</span>
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

              {isNearEarth ? (
                <label className="control-span-2">
                  <span className="slider-label">
                    <span>Distance (view half-width):</span>
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
                    Physical scale from LEO (~ISS) out past the Moon and JWST toward 1 AU.
                  </span>
                </label>
              ) : null}

              <label className="control-span-2">
                <span className="slider-label">
                  <span>Camera zoom:</span>
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
                Follow selected body
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
                  Click a body to select it, then enable Follow or Zoom & follow.
                </p>
              )}

              <div className="gravity-body-list control-span-2" role="list">
                {(scenario === "solar-system"
                  ? SCENARIOS["solar-system"].bodies
                  : SCENARIOS["near-earth"].bodies
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
            Show velocity vectors
          </label>

          <label className="checkbox control-span-2">
            <input
              type="checkbox"
              checked={showForceVectors}
              onChange={(event) => setShowForceVectors(event.target.checked)}
            />
            Show gravitational pull (force) vectors
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

      <div className="canvas-shell card gravity-canvas-shell">
        <div className="gravity-canvas-frame">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            style={{ cursor: isPlayground ? "grab" : "pointer" }}
          />
          {overlayControls}
        </div>
      </div>
    </div>
  );
}
