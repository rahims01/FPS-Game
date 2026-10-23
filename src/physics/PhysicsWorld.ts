import * as CANNON from 'cannon-es';
import type { Arena } from '../sim/Arena';

/**
 * Render-side physics for ragdolls only. Gameplay never reads it, so the
 * headless trainer and the browser resolve combat identically.
 *
 * Collision groups (ported from TribeSim):
 *   different corpses          -> never collide (cost control)
 *   same corpse, jointed/near  -> never collide (boxes overlap by construction)
 *   same corpse, otherwise     -> collide (an arm can rest on the chest)
 */
export const PHYSICS_GROUP_WORLD = 1;
export const PHYSICS_GROUP_RAGDOLL = 2;

const ragdollInstance = new WeakMap<CANNON.Body, number>();
const ragdollIgnores = new WeakMap<CANNON.Body, Set<number>>();

export const registerRagdollBody = (body: CANNON.Body, instanceId: number, ignores: Set<number>): void => {
  ragdollInstance.set(body, instanceId);
  ragdollIgnores.set(body, ignores);
};

export const FIXED_TIME_STEP = 1 / 60;
const MAX_SUB_STEPS = 5;

export class PhysicsWorld {
  readonly world: CANNON.World;

  constructor(arena: Arena) {
    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.81, 0) });
    (world.solver as CANNON.GSSolver).iterations = 10;
    world.defaultContactMaterial.friction = 0.5;
    world.defaultContactMaterial.restitution = 0.05;
    world.allowSleep = true;
    this.world = world;

    const ground = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC, shape: new CANNON.Plane(), collisionFilterGroup: PHYSICS_GROUP_WORLD });
    ground.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    world.addBody(ground);

    for (const b of arena.boxes) {
      const body = new CANNON.Body({
        mass: 0,
        type: CANNON.Body.STATIC,
        shape: new CANNON.Box(new CANNON.Vec3((b.maxX - b.minX) / 2, b.h / 2, (b.maxZ - b.minZ) / 2)),
        collisionFilterGroup: PHYSICS_GROUP_WORLD
      });
      body.position.set((b.minX + b.maxX) / 2, b.h / 2, (b.minZ + b.maxZ) / 2);
      world.addBody(body);
    }

    const base = world.broadphase.needBroadphaseCollision.bind(world.broadphase);
    world.broadphase.needBroadphaseCollision = (a: CANNON.Body, b: CANNON.Body): boolean => {
      if (!base(a, b)) return false;
      const ia = ragdollInstance.get(a);
      if (ia === undefined) return true;
      const ib = ragdollInstance.get(b);
      if (ib === undefined) return true;
      if (ia !== ib) return false;
      return !ragdollIgnores.get(a)?.has(b.id);
    };
  }

  step(delta: number): void {
    this.world.step(FIXED_TIME_STEP, Math.min(delta, 0.1), MAX_SUB_STEPS);
  }
}
