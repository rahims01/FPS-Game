import { keyLabel, type GameSettings } from '../game/settings';

/** Every control in the player's own keys: shown on the pause screen and under the Play tab's modes. */
export const ControlsList = ({ settings, touch = false }: { settings: GameSettings; touch?: boolean }) => {
  const k = settings.keys;
  const key = (code: string) => keyLabel(code);
  const rows: [string, string[]][] = touch
    ? [
        ['Move', ['Left side']],
        ['Aim', ['Drag right side']],
        ['Fire', ['FIRE']],
        ['Aim down sights', ['AIM']],
        ['Jump / crouch', ['JUMP', 'CROUCH']],
        ['Reload', ['R']],
        ['Lethal / tactical', ['G', 'H']],
        ['Knife', ['KNIFE']],
        ['Switch weapon', ['SWAP']],
        ['Scoreboard', ['Scores']]
      ]
    : [
        ['Move', [`${key(k.forward)}${key(k.left)}${key(k.back)}${key(k.right)}`]],
        ['Fire / aim', ['Left click', 'Right click']],
        ['Sprint', [key(k.sprint)]],
        ['Jump', [key(k.jump)]],
        ['Crouch / slide', [key(k.crouch)]],
        ['Reload', [key(k.reload)]],
        ['Switch weapon', [key(k.weapon1), key(k.weapon2), key(k.swap), 'Wheel']],
        ['Knife', [key(k.melee)]],
        ['Lethal / tactical', [key(k.grenade), key(k.tactical)]],
        ['Scoreboard', [key(k.scores)]],
        ['Chat (online)', [key(k.chat)]],
        ['Pause', ['Esc']]
      ];
  return (
    <dl className="controls-list">
      {rows.map(([what, keys]) => (
        <div key={what}>
          <dt>{what}</dt>
          <dd>
            {keys.map((x) => (
              <kbd key={x}>{x}</kbd>
            ))}
          </dd>
        </div>
      ))}
      {!touch && (
        <p className="set-hint">
          Controllers work too: left stick move, right stick aim, RT fire, LT aim, Y switch, X reload, RB / LB throw. Change keys in Settings.
        </p>
      )}
    </dl>
  );
};
