import { useEffect, useState } from 'react';
import { DEFAULT_KEYS, KEY_ACTIONS, keyLabel, QUALITY_PRESETS, type GameSettings, type Graphics, type KeyAction, type Quality } from '../game/settings';

type Tab = 'gameplay' | 'graphics' | 'controls' | 'controller' | 'crosshair' | 'access' | 'audio';
const TABS: [Tab, string][] = [
  ['gameplay', 'Gameplay'],
  ['graphics', 'Graphics'],
  ['controls', 'Keys'],
  ['controller', 'Controller'],
  ['crosshair', 'Crosshair'],
  ['access', 'Accessibility'],
  ['audio', 'Audio']
];

const Slider = ({ label, value, min, max, step, fmt, onChange }: { label: string; value: number; min: number; max: number; step: number; fmt?: (v: number) => string; onChange: (v: number) => void }) => (
  <label className="set-row">
    <span>{label}</span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    <b>{fmt ? fmt(value) : value}</b>
  </label>
);

const Toggle = ({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) => (
  <label className="set-row toggle">
    <span>
      {label}
      {hint && <small>{hint}</small>}
    </span>
    <button className={`chip ${value ? 'on' : ''}`} onClick={() => onChange(!value)}>
      {value ? 'On' : 'Off'}
    </button>
  </label>
);

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="set-row">
      <span>{label}</span>
      <div className="set-choices">
        {options.map(([v, l]) => (
          <button key={v} className={`chip ${value === v ? 'on' : ''}`} onClick={() => onChange(v)}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Tabbed settings: gameplay, graphics (quality presets for slower computers), key bindings, crosshair and audio. */
export const SettingsPanel = ({ settings, onChange, onReplayTour }: { settings: GameSettings; onChange: (s: GameSettings) => void; onReplayTour?: () => void }) => {
  const [tab, setTab] = useState<Tab>('gameplay');
  const [binding, setBinding] = useState<KeyAction | null>(null);
  const set = (patch: Partial<GameSettings>) => onChange({ ...settings, ...patch });
  // Changing any single graphics option makes the preset "custom".
  const setGfx = (patch: Partial<Graphics>) => onChange({ ...settings, quality: 'custom', autoQuality: false, graphics: { ...settings.graphics, ...patch } });

  // Rebinding: the next key or mouse button pressed becomes the binding (Escape cancels).
  useEffect(() => {
    if (!binding) return;
    const bind = (code: string) => {
      if (code !== 'Escape') {
        const keys = { ...settings.keys };
        // A key can only do one thing: swap with whatever used it before.
        const clash = (Object.keys(keys) as KeyAction[]).find((a) => keys[a] === code && a !== binding);
        if (clash) keys[clash] = keys[binding];
        keys[binding] = code;
        onChange({ ...settings, keys });
      }
      setBinding(null);
    };
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      bind(e.code);
    };
    const onMouse = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      bind(`Mouse${e.button}`);
    };
    // The click that opened the right-click menu would otherwise land on the page.
    const noMenu = (e: MouseEvent) => e.preventDefault();
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('mousedown', onMouse, true);
    window.addEventListener('contextmenu', noMenu, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('mousedown', onMouse, true);
      // Let the right click's own menu event pass first, then allow menus again.
      setTimeout(() => window.removeEventListener('contextmenu', noMenu, true), 0);
    };
  }, [binding, settings, onChange]);

  const c = settings.crosshair;
  return (
    <div className="settings-panel">
      <div className="set-tabs">
        {TABS.map(([id, label]) => (
          <button key={id} className={`set-tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="set-body">
        {tab === 'gameplay' && (
          <>
            <Slider label="Mouse sensitivity" value={settings.sensitivity} min={0.1} max={4} step={0.05} fmt={(v) => v.toFixed(2)} onChange={(v) => set({ sensitivity: v })} />
            <Slider label="Aim-down-sights sensitivity" value={settings.adsSensitivity} min={0.2} max={1.5} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ adsSensitivity: v })} />
            <Toggle label="Invert mouse Y" value={settings.invertY} onChange={(v) => set({ invertY: v })} />
            <Toggle label="Toggle aim" hint="Right click toggles instead of holding" value={settings.toggleAim} onChange={(v) => set({ toggleAim: v })} />
            <Toggle label="Toggle crouch" hint="Crouch key toggles instead of holding" value={settings.toggleCrouch} onChange={(v) => set({ toggleCrouch: v })} />
            <Slider label="Field of view" value={settings.fov} min={60} max={115} step={1} fmt={(v) => `${v}°`} onChange={(v) => set({ fov: v })} />
            <Toggle label="Show FPS" value={settings.showFps} onChange={(v) => set({ showFps: v })} />
            <Toggle label="Show ping (online)" value={settings.showPing} onChange={(v) => set({ showPing: v })} />
            <Toggle label="Damage numbers" hint="Floating numbers on everyone you hit" value={settings.damageNumbers} onChange={(v) => set({ damageNumbers: v })} />
            <Toggle label="Blood" hint="Off: hits kick up dust and nobody leaves a pool of blood" value={settings.blood} onChange={(v) => set({ blood: v })} />
            <Toggle label="Hit marker sound" value={settings.hitSounds} onChange={(v) => set({ hitSounds: v })} />
            <Toggle label="Control hints" hint="Short tips in your first matches (switching weapons, grenades, scoreboard...). Each one stops once you've used it." value={settings.hints} onChange={(v) => set({ hints: v })} />
            {onReplayTour && (
              <div className="set-row toggle">
                <span>
                  New here?
                  <small>Shows the menu tour again and brings back the control hints.</small>
                </span>
                <button className="chip" onClick={onReplayTour}>
                  Show the tour
                </button>
              </div>
            )}
            <Choice
              label="Touch controls"
              value={settings.touchControls}
              options={[
                ['auto', 'Auto'],
                ['on', 'On'],
                ['off', 'Off']
              ]}
              onChange={(v) => set({ touchControls: v })}
            />
          </>
        )}
        {tab === 'graphics' && (
          <>
            <Choice<Quality>
              label="Quality preset"
              value={settings.quality}
              options={[
                ['low', 'Low'],
                ['medium', 'Medium'],
                ['high', 'High'],
                ['ultra', 'Ultra'],
                ['custom', 'Custom']
              ]}
              onChange={(q) => onChange({ ...settings, quality: q, autoQuality: false, graphics: q === 'custom' ? settings.graphics : { ...QUALITY_PRESETS[q] } })}
            />
            <p className="set-hint">Low or Medium make a big difference on older laptops, Chromebooks and integrated graphics.</p>
            <Toggle
              label="Adjust automatically"
              hint="Lowers the preset by itself if matches run slowly on this device. Picking a preset turns this off."
              value={settings.autoQuality}
              onChange={(v) => set({ autoQuality: v })}
            />
            <Slider label="Render resolution" value={settings.graphics.renderScale} min={0.4} max={1.5} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setGfx({ renderScale: v })} />
            <Choice
              label="Shadows"
              value={settings.graphics.shadows}
              options={[
                ['off', 'Off'],
                ['low', 'Low'],
                ['high', 'High']
              ]}
              onChange={(v) => setGfx({ shadows: v })}
            />
            <Choice
              label="Effects"
              value={settings.graphics.effects}
              options={[
                ['low', 'Low'],
                ['high', 'High']
              ]}
              onChange={(v) => setGfx({ effects: v })}
            />
            <Slider label="View distance" value={settings.graphics.viewDistance} min={0.4} max={1.6} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setGfx({ viewDistance: v })} />
            <Slider label="Ragdolls at once" value={settings.graphics.maxRagdolls} min={2} max={24} step={1} onChange={(v) => setGfx({ maxRagdolls: v })} />
            <Toggle
              label="Simplified soldiers"
              hint="Lighter soldier models, and soldiers out of view skip their animation. Big speed-up in big lobbies on weak devices."
              value={settings.graphics.simpleSoldiers}
              onChange={(v) => setGfx({ simpleSoldiers: v })}
            />
            <Choice
              label="Frame rate limit"
              value={String(settings.fpsLimit)}
              options={[
                ['30', '30'],
                ['60', '60'],
                ['90', '90'],
                ['120', '120'],
                ['144', '144'],
                ['0', 'Display']
              ]}
              onChange={(v) => set({ fpsLimit: Number(v) })}
            />
            <Toggle
              label="V-sync"
              hint="Off draws frames as fast as possible: a little less input lag, more power and heat. Browsers still show at most your display's refresh rate."
              value={settings.vsync}
              onChange={(v) => set({ vsync: v })}
            />
            <Toggle label="Anti-aliasing" hint="Applies from the next match" value={settings.graphics.antialias} onChange={(v) => setGfx({ antialias: v })} />
          </>
        )}
        {tab === 'controls' && (
          <>
            <p className="set-hint">Click an action, then press a key or click a mouse button for it (Esc cancels). No mouse? Put Fire and Aim on keys, e.g. F and E. The wheel always switches weapon.</p>
            <div className="binds">
              {KEY_ACTIONS.map(([action, label]) => (
                <div key={action} className="set-row">
                  <span>{label}</span>
                  <button className={`chip key ${binding === action ? 'on' : ''}`} onClick={() => setBinding(action)}>
                    {binding === action ? 'Press a key or click…' : keyLabel(settings.keys[action])}
                  </button>
                </div>
              ))}
            </div>
            <button className="chip" onClick={() => set({ keys: { ...DEFAULT_KEYS } })}>
              Reset to defaults
            </button>
          </>
        )}
        {tab === 'crosshair' && (
          <>
            <div className="crosshair-preview">
              <div className="crosshair" style={{ ['--gap' as string]: `${c.gap}px`, ['--len' as string]: `${c.size}px`, ['--thick' as string]: `${c.thickness}px`, ['--col' as string]: c.color }}>
                <i className="t" />
                <i className="b" />
                <i className="l" />
                <i className="r" />
                {c.dot && <i className="d" />}
              </div>
            </div>
            <div className="set-row">
              <span>Colour</span>
              <div className="set-choices">
                {['#ffffff', '#00ff66', '#00e5ff', '#ffee00', '#ff3355', '#ff66ff'].map((col) => (
                  <button key={col} className={`swatch ${c.color === col ? 'on' : ''}`} style={{ background: col }} onClick={() => set({ crosshair: { ...c, color: col } })} />
                ))}
              </div>
            </div>
            <Slider label="Length" value={c.size} min={2} max={20} step={1} onChange={(v) => set({ crosshair: { ...c, size: v } })} />
            <Slider label="Gap" value={c.gap} min={0} max={20} step={1} onChange={(v) => set({ crosshair: { ...c, gap: v } })} />
            <Slider label="Thickness" value={c.thickness} min={1} max={5} step={1} onChange={(v) => set({ crosshair: { ...c, thickness: v } })} />
            <Toggle label="Centre dot" value={c.dot} onChange={(v) => set({ crosshair: { ...c, dot: v } })} />
            <Toggle label="Dynamic" hint="Opens up with weapon spread" value={c.dynamic} onChange={(v) => set({ crosshair: { ...c, dynamic: v } })} />
          </>
        )}
        {tab === 'controller' && (
          <>
            <p className="set-hint">Plug in or pair an Xbox, PlayStation or other standard controller and press any button. Left stick move (click: sprint), right stick look (click: knife), RT fire, LT aim, A jump, B crouch/slide, X reload, Y swap, RB lethal, LB tactical, Start pause, Back scoreboard. In menus: D-pad or stick to move, A to select.</p>
            <Slider label="Look sensitivity" value={settings.pad.sensitivity} min={0.3} max={3} step={0.05} fmt={(v) => v.toFixed(2)} onChange={(v) => set({ pad: { ...settings.pad, sensitivity: v } })} />
            <Slider label="Stick deadzone" value={settings.pad.deadzone} min={0.03} max={0.35} step={0.01} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ pad: { ...settings.pad, deadzone: v } })} />
            <Toggle label="Aim assist" hint="Slows your aim over enemies and follows them slightly while you steer" value={settings.pad.aimAssist} onChange={(v) => set({ pad: { ...settings.pad, aimAssist: v } })} />
            <Toggle label="Invert look Y" value={settings.pad.invertY} onChange={(v) => set({ pad: { ...settings.pad, invertY: v } })} />
          </>
        )}
        {tab === 'access' && (
          <>
            <Choice
              label="Colourblind mode"
              value={settings.access.colorblind}
              options={[
                ['off', 'Off'],
                ['protanopia', 'Protanopia'],
                ['deuteranopia', 'Deuteranopia'],
                ['tritanopia', 'Tritanopia']
              ]}
              onChange={(v) => set({ access: { ...settings.access, colorblind: v } })}
            />
            <p className="set-hint">Team colours and enemy markers switch to pairs that stay easy to tell apart.</p>
            <Slider label="Text and HUD size" value={settings.access.uiScale} min={0.85} max={1.4} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ access: { ...settings.access, uiScale: v } })} />
            <Toggle label="Reduce motion" hint="No screen shake, weapon bob or camera tilt" value={settings.access.reduceMotion} onChange={(v) => set({ access: { ...settings.access, reduceMotion: v } })} />
            <Toggle label="Reduce flashing" hint="Dimmer flashbangs and explosions" value={settings.access.reduceFlash} onChange={(v) => set({ access: { ...settings.access, reduceFlash: v } })} />
            <Toggle label="Visualise sound" hint="Arrows around the crosshair for nearby gunfire, explosions and enemy footsteps" value={settings.access.visualSound} onChange={(v) => set({ access: { ...settings.access, visualSound: v } })} />
            <Toggle label="High-contrast HUD" hint="Solid backgrounds behind HUD text" value={settings.access.highContrast} onChange={(v) => set({ access: { ...settings.access, highContrast: v } })} />
          </>
        )}
        {tab === 'audio' && <Slider label="Master volume" value={settings.volume} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ volume: v })} />}
      </div>
    </div>
  );
};
