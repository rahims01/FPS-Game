/** Lets the account layer hear about local saves (progress, settings) without the save code importing it. */
let hook: (() => void) | null = null;
export const onLocalSave = (fn: () => void) => (hook = fn);
export const localSaved = () => hook?.();
