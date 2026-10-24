import { useEffect, useState } from 'react';
import { DEFAULT_KEYS, KEY_ACTIONS, keyLabel, QUALITY_PRESETS, type GameSettings, type Graphics, type KeyAction, type Quality } from '../game/settings';

type Tab = 'gameplay' | 'graphics' | 'controls' | 'crosshair' | 'audio';
const TABS: [Tab, string][] = [
  ['gameplay', 'Gameplay'],
  ['graphics', 'Graphics'],
  ['controls', 'Controls'],
  ['crosshair', 'Crosshair'],
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
export const SettingsPanel = ({ settings, onChange }: { settings: GameSettings; onChange: (s: GameSettings) => void }) => {
  const [tab, setTab] = useState<Tab>('gameplay');
  const [binding, setBinding] = useState<KeyAction | null>(null);
  const set = (patch: Partial<GameSettings>) => onChange({ ...settings, ...patch });
  // Changing any single graphics option makes the preset "custom".
  const setGfx = (patch: Partial<Graphics>) => onChange({ ...settings, quality: 'custom', graphics: { ...settings.graphics, ...patch } });

  // Rebinding: the next key pressed becomes the binding (Escape cancels).
  useEffect(() => {
    if (!binding) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code !== 'Escape') {
        const keys = { ...settings.keys };
        // A key can only do one thing: swap with whatever used it before.
        const clash = (Object.keys(keys) as KeyAction[]).find((a) => keys[a] === e.code && a !== binding);
        if (clash) keys[clash] = keys[binding];
        keys[binding] = e.code;
        onChange({ ...settings, keys });
      }
      setBinding(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
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
            <Toggle label="Hit marker sound" value={settings.hitSounds} onChange={(v) => set({ hitSounds: v })} />
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
              onChange={(q) => onChange({ ...settings, quality: q, graphics: q === 'custom' ? settings.graphics : { ...QUALITY_PRESETS[q] } })}
            />
            <p className="set-hint">Low or Medium make a big difference on older laptops and integrated graphics.</p>
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
            <Toggle label="Anti-aliasing" hint="Applies from the next match" value={settings.graphics.antialias} onChange={(v) => setGfx({ antialias: v })} />
          </>
        )}
        {tab === 'controls' && (
          <>
            <p className="set-hint">Click a key, then press the new one (Esc cancels). Mouse: left fire, right aim, wheel switch weapon.</p>
            <div className="binds">
              {KEY_ACTIONS.map(([action, label]) => (
                <div key={action} className="set-row">
                  <span>{label}</span>
                  <button className={`chip key ${binding === action ? 'on' : ''}`} onClick={() => setBinding(action)}>
                    {binding === action ? 'Press a key…' : keyLabel(settings.keys[action])}
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
        {tab === 'audio' && <Slider label="Master volume" value={settings.volume} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ volume: v })} />}
      </div>
    </div>
  );
};
