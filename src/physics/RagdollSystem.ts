import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PHYSICS_GROUP_RAGDOLL, PHYSICS_GROUP_WORLD, registerRagdollBody } from './PhysicsWorld';
import { STICKMAN_SCALE } from '../assets/scale';
import type { HitRegion } from '../sim/config';

// Ported from TribeSim (Battle Simulator), which ported it from the Action
// Game project. Box sizes were tuned for a 0.012 rig scale, so extents are
// scaled to match STICKMAN_SCALE.
const EXTENT_SCALE = STICKMAN_SCALE / 0.012;

/** Body that receives an impact for each authoritative hit region. */
export const REGION_BONE: Record<HitRegion, string> = {
  head: 'mixamorigHead',
  torso: 'mixamorigSpine2',
  legs: 'mixamorigLeftUpLeg'
};

const DEG = Math.PI / 180;

interface RagdollBoneSpec {
  name: string;
  parent: string | null;
  // Bone/reference object whose world position defines the direction this
  // body's box is oriented toward. Doesn't need its own physics body (e.g.
  // HeadTop_End, fingertip, toe bones all work as pure direction refs).
  orientRef: string;
  mass: number;
  halfExtents: [number, number, number];
  /** Aperture of the joint's cone, around its neutral direction (see JointNeutral). */
  swingAngle: number;
  /** How far the limb may roll about its own length (see TwistLimit). */
  twistAngle: number;
  neutral: JointNeutral;
  /**
   * Elbows and knees are NOT ball joints - they bend one way and stop, and a
   * ConeTwist cannot say that on its own: its cone is symmetric about its
   * axis, so any angle it permits forwards it permits backwards too.
   *
   * The fix is a SECOND cone for these joints, centred not on the bone but
   * tilted off it toward the flexion side by its own aperture, so that
   * "straight" sits exactly on its rim. The joint can then close away from
   * that rim through twice the angle and cannot open past straight at all.
   * Elbows flex forward, knees flex backward.
   *
   * It has to be a second constraint rather than a tilt on this one, because
   * ConeTwistConstraint derives the TWIST reference from axisA via
   * axisA.tangents(). Tilting axisA silently rotates the twist frame
   * with it, and the twist equation then fights the cone - which showed up as
   * knees (tightest twist, heaviest limb) inverting completely.
   */
  hinge?: 'elbow' | 'knee';
  /** Aperture of that second cone, and therefore half the usable flexion. */
  hingeAngle?: number;
}

/**
 * Where a joint's cone is centred.
 *
 * cannon's cone is measured from axisA in the PARENT body's frame, and every
 * body's local Y runs along its own bone. Using the parent's Y as the centre
 * (as this used to) only works where the child continues straight on from
 * the parent. Anywhere the skeleton turns a corner it is badly wrong: the
 * hip body points up the spine while the thigh points down, so the thigh
 * started 180 degrees outside a 70 degree cone and the solver spent the
 * whole fall dragging the legs up toward the head (measured: thighs at
 * 145-175 degrees from the torso, where a real hip stops near 120). The
 * shoulders and feet had the same problem at 90 degrees.
 *
 *  - straight: on along the parent (knees, elbows; their hinge does the rest).
 *  - rest: the limb's direction in the pose it died in (spine, neck, collar
 *    bones, hands, feet: joints whose resting angle is not straight).
 *  - hip: down the torso, tilted forward by coneTilt. A circular cone cannot
 *    hold a hip's lopsided range on its own axis, but tilted it gives about
 *    100 degrees forward, 20 back and 50 out to the side.
 *  - arm: out to the side and forward, wide enough for arms to hang, reach
 *    forward or out, and not swing far behind the back or across the chest.
 */
type JointNeutral = 'straight' | 'rest' | 'hip' | 'arm';

/** Forward tilt of the hip cone's centre from straight down the torso. */
const HIP_TILT = 40 * DEG;

// cannon-es has no capsule shape, so boxes are used as the spec's documented fallback.
// Limits are set to a real body's passive range of motion.
const RAGDOLL_BONES: RagdollBoneSpec[] = [
  { name: 'mixamorigHips', parent: null, orientRef: 'mixamorigSpine', mass: 8, halfExtents: [0.14, 0.1, 0.1], swingAngle: 0, twistAngle: 0, neutral: 'rest' },
  { name: 'mixamorigSpine', parent: 'mixamorigHips', orientRef: 'mixamorigSpine1', mass: 5, halfExtents: [0.13, 0.1, 0.09], swingAngle: 18 * DEG, twistAngle: 12 * DEG, neutral: 'rest' },
  { name: 'mixamorigSpine1', parent: 'mixamorigSpine', orientRef: 'mixamorigSpine2', mass: 5, halfExtents: [0.13, 0.09, 0.09], swingAngle: 18 * DEG, twistAngle: 12 * DEG, neutral: 'rest' },
  { name: 'mixamorigSpine2', parent: 'mixamorigSpine1', orientRef: 'mixamorigNeck', mass: 5, halfExtents: [0.14, 0.09, 0.1], swingAngle: 18 * DEG, twistAngle: 12 * DEG, neutral: 'rest' },
  { name: 'mixamorigNeck', parent: 'mixamorigSpine2', orientRef: 'mixamorigHead', mass: 1, halfExtents: [0.05, 0.05, 0.05], swingAngle: 35 * DEG, twistAngle: 30 * DEG, neutral: 'rest' },
  { name: 'mixamorigHead', parent: 'mixamorigNeck', orientRef: 'mixamorigHeadTop_End', mass: 3, halfExtents: [0.1, 0.11, 0.1], swingAngle: 30 * DEG, twistAngle: 30 * DEG, neutral: 'rest' },
  { name: 'mixamorigLeftShoulder', parent: 'mixamorigSpine2', orientRef: 'mixamorigLeftArm', mass: 1, halfExtents: [0.08, 0.05, 0.05], swingAngle: 15 * DEG, twistAngle: 10 * DEG, neutral: 'rest' },
  { name: 'mixamorigLeftArm', parent: 'mixamorigLeftShoulder', orientRef: 'mixamorigLeftForeArm', mass: 2, halfExtents: [0.045, 0.13, 0.045], swingAngle: 110 * DEG, twistAngle: 100 * DEG, neutral: 'arm' },
  { name: 'mixamorigLeftForeArm', parent: 'mixamorigLeftArm', orientRef: 'mixamorigLeftHand', mass: 1.5, halfExtents: [0.04, 0.12, 0.04], swingAngle: 80 * DEG, twistAngle: 35 * DEG, neutral: 'straight', hinge: 'elbow', hingeAngle: 72 * DEG },
  { name: 'mixamorigLeftHand', parent: 'mixamorigLeftForeArm', orientRef: 'mixamorigLeftHandMiddle1', mass: 0.5, halfExtents: [0.035, 0.06, 0.04], swingAngle: 55 * DEG, twistAngle: 25 * DEG, neutral: 'rest' },
  { name: 'mixamorigRightShoulder', parent: 'mixamorigSpine2', orientRef: 'mixamorigRightArm', mass: 1, halfExtents: [0.08, 0.05, 0.05], swingAngle: 15 * DEG, twistAngle: 10 * DEG, neutral: 'rest' },
  { name: 'mixamorigRightArm', parent: 'mixamorigRightShoulder', orientRef: 'mixamorigRightForeArm', mass: 2, halfExtents: [0.045, 0.13, 0.045], swingAngle: 110 * DEG, twistAngle: 100 * DEG, neutral: 'arm' },
  { name: 'mixamorigRightForeArm', parent: 'mixamorigRightArm', orientRef: 'mixamorigRightHand', mass: 1.5, halfExtents: [0.04, 0.12, 0.04], swingAngle: 80 * DEG, twistAngle: 35 * DEG, neutral: 'straight', hinge: 'elbow', hingeAngle: 72 * DEG },
  { name: 'mixamorigRightHand', parent: 'mixamorigRightForeArm', orientRef: 'mixamorigRightHandMiddle1', mass: 0.5, halfExtents: [0.035, 0.06, 0.04], swingAngle: 55 * DEG, twistAngle: 25 * DEG, neutral: 'rest' },
  { name: 'mixamorigLeftUpLeg', parent: 'mixamorigHips', orientRef: 'mixamorigLeftLeg', mass: 5, halfExtents: [0.07, 0.2, 0.07], swingAngle: 60 * DEG, twistAngle: 40 * DEG, neutral: 'hip' },
  { name: 'mixamorigLeftLeg', parent: 'mixamorigLeftUpLeg', orientRef: 'mixamorigLeftFoot', mass: 4, halfExtents: [0.055, 0.19, 0.055], swingAngle: 75 * DEG, twistAngle: 8 * DEG, neutral: 'straight', hinge: 'knee', hingeAngle: 67 * DEG },
  { name: 'mixamorigLeftFoot', parent: 'mixamorigLeftLeg', orientRef: 'mixamorigLeftToeBase', mass: 1, halfExtents: [0.05, 0.04, 0.1], swingAngle: 30 * DEG, twistAngle: 20 * DEG, neutral: 'rest' },
  { name: 'mixamorigRightUpLeg', parent: 'mixamorigHips', orientRef: 'mixamorigRightLeg', mass: 5, halfExtents: [0.07, 0.2, 0.07], swingAngle: 60 * DEG, twistAngle: 40 * DEG, neutral: 'hip' },
  { name: 'mixamorigRightLeg', parent: 'mixamorigRightUpLeg', orientRef: 'mixamorigRightFoot', mass: 4, halfExtents: [0.055, 0.19, 0.055], swingAngle: 75 * DEG, twistAngle: 8 * DEG, neutral: 'straight', hinge: 'knee', hingeAngle: 67 * DEG },
  { name: 'mixamorigRightFoot', parent: 'mixamorigRightLeg', orientRef: 'mixamorigRightToeBase', mass: 1, halfExtents: [0.05, 0.04, 0.1], swingAngle: 30 * DEG, twistAngle: 20 * DEG, neutral: 'rest' }
];

/**
 * Twist limit with reference vectors chosen by us.
 *
 * ConeTwistConstraint builds its twist reference from axisA.tangents(), an
 * arbitrary perpendicular that does not line up with the child's at rest once
 * the cone is centred anywhere but straight on, so its twist is switched off
 * and this replaces it. Both references start as the same world direction
 * (across the limb, side to side), and the limb may roll that far from it.
 * Rolling side to side also turns them, so this doubles as the limit on a
 * knee bending sideways or a leg swinging out.
 */
class TwistLimit extends CANNON.Constraint {
  private readonly eq: CANNON.RotationalEquation;
  constructor(bodyA: CANNON.Body, bodyB: CANNON.Body, private readonly refA: CANNON.Vec3, private readonly refB: CANNON.Vec3, angle: number) {
    super(bodyA, bodyB, { collideConnected: false });
    this.eq = new CANNON.RotationalEquation(bodyA, bodyB);
    this.eq.maxAngle = angle;
    // One-sided, like ConeTwist's own: only pulls back toward the reference.
    this.eq.maxForce = 0;
    this.eq.minForce = -1e6;
    this.equations.push(this.eq);
  }
  update(): void {
    this.bodyA.vectorToWorldFrame(this.refA, this.eq.axisA);
    this.bodyB.vectorToWorldFrame(this.refB, this.eq.axisB);
  }
}

/** Every cone, for the hard backstop in clampCones. */
interface ConeRuntime {
  parent: CANNON.Body;
  child: CANNON.Body;
  /** Cone centre in the PARENT body's frame. */
  axisLocal: THREE.Vector3;
  angle: number;
}

/** How far past its cone a limb may sit before the clamp acts (same reasoning as the hinge tolerance). */
const CONE_TOLERANCE = 5 * DEG;

/**
 * A hinge the solver is allowed to get wrong, and the post-step clamp fixes.
 *
 * The one-way cone stops hyperextension under ordinary loads, but a cone is
 * a soft constraint: a hard enough shove drives the joint past it in a single
 * step, and once the bend passes (180 - aperture) the cone's own jacobian -
 * cross(axisA, axisB) - collapses toward zero and it can no longer push back
 * at all. That is the failure mode where a knee ends up folded the wrong way
 * and stays there. The clamp is the hard backstop underneath the soft one.
 */
interface HingeRuntime {
  parent: CANNON.Body;
  child: CANNON.Body;
  /** Flexion direction in the PARENT body's frame, captured at activation. */
  flexLocal: THREE.Vector3;
}

interface BoneRuntime {
  bone: THREE.Object3D;
  body: CANNON.Body;
  // Fixed relationship between the body's (arbitrarily chosen) orientation
  // and the bone's actual bind-relative transform, captured at activation.
  // Re-applying it every frame lets the body drive the bone correctly
  // without the box's axis convention having to match the rig's own.
  offsetPos: THREE.Vector3;
  offsetQuat: THREE.Quaternion;
}

export interface RagdollActivation {
  /** Impulse applied at the impacted region's body (N*s). */
  impulse?: THREE.Vector3;
  region?: HitRegion;
  /** Linear velocity of the unit at death, transferred to every body. */
  velocity?: THREE.Vector3;
}

export interface RagdollHandle {
  activate: (opts?: RagdollActivation) => void;
  isSettled: () => boolean;
  update: () => void;
  dispose: () => void;
  isActive: () => boolean;
  applyImpulseToHips: (impulse: THREE.Vector3) => void;
  getHipsWorldPosition: (target: THREE.Vector3) => void;
}

/**
 * When to call a corpse finished.
 *
 * cannon's own sleep is not usable for this: measured over ten seconds, only
 * nine of a ragdoll's twenty bodies ever reach SLEEPING - the rest keep a
 * small angular jitter (0.5-2 rad/s) below the linear threshold but above the
 * combined one, forever. So quiet is measured directly, and there is a hard
 * cap behind it for anything balanced on an edge.
 */
const SETTLE_LINEAR_SPEED = 0.15;
const SETTLE_ANGULAR_SPEED = 2;
/**
 * Both counted in cannon SUBSTEPS, not in frames and not in wall-clock
 * seconds - 20 substeps is a third of a simulated second, 180 is three.
 *
 * Frames were wrong in a way that pointed the wrong direction: the retirement
 * delay scaled INVERSELY with framerate, so at 10fps a corpse took 18
 * wall-clock seconds to retire instead of 3 - slowest exactly when retiring
 * it is most urgent. world.time is no better, because cannon advances it by
 * the wall-clock delta handed in, not by the amount it managed to simulate,
 * and discards the accumulator it could not catch up on. world.stepnumber
 * increments once per internalStep and is the only honest simulated clock.
 */
/**
 * How far past straight an elbow or knee may sit before the clamp acts. A few
 * degrees of give keeps it from firing continuously at exactly straight,
 * which would read as a joint that buzzes.
 */
const HINGE_BACKWARD_TOLERANCE = 6 * DEG;

/**
 * How far apart two bones must be in the skeleton before their boxes are
 * allowed to collide. Two hops covers parent/child, siblings and
 * grandparent/grandchild - all of them neighbouring geometry rather than a
 * limb genuinely landing on another.
 */
const HINGE_IGNORE_HOPS = 2;

const SETTLE_QUIET_STEPS = 20;
const SETTLE_STEP_LIMIT = 180;

// Distinguishes one corpse's limbs from another's, so the broadphase hook in
// physicsWorld can let a limb hit its own chest without every corpse in the
// arena also testing against every other corpse's twenty boxes.
let nextRagdollInstanceId = 0;

/**
 * Which way this character is facing, taken from the POSE rather than from
 * any rig convention: toes point forward, so foot->toe flattened onto the
 * horizontal plane is a reliable anterior direction on any humanoid. Both
 * feet are averaged so a mid-stride pose does not skew it.
 */
const deriveForward = (model: THREE.Object3D): THREE.Vector3 => {
  const up = new THREE.Vector3(0, 1, 0);
  const forward = new THREE.Vector3();
  const footPos = new THREE.Vector3();
  const toePos = new THREE.Vector3();
  let found = 0;
  for (const side of ['Left', 'Right']) {
    const foot = model.getObjectByName(`mixamorig${side}Foot`);
    const toe = model.getObjectByName(`mixamorig${side}ToeBase`);
    if (!foot || !toe) continue;
    foot.getWorldPosition(footPos);
    toe.getWorldPosition(toePos);
    forward.add(toePos.sub(footPos));
    found++;
  }
  if (found === 0) return new THREE.Vector3(0, 0, 1);
  forward.addScaledVector(up, -forward.dot(up));
  if (forward.lengthSq() < 1e-8) return new THREE.Vector3(0, 0, 1);
  return forward.normalize();
};

export const createRagdoll = (model: THREE.Object3D, world: CANNON.World): RagdollHandle => {
  let runtimes: BoneRuntime[] = [];
  let constraints: CANNON.Constraint[] = [];
  let active = false;
  // A corpse that has stopped moving still costs a full solve every step -
  // twenty bodies and nineteen constraints each, and the arena keeps up to
  // DEAD_BODY_LIMIT of them lying around for half a minute. Once every body
  // has fallen asleep the pose is never going to change again, so it is
  // cached, the physics is torn down, and update() just re-applies the frozen
  // pose. Behaviour is unchanged: cannon's solver already skips sleeping
  // bodies and applyImpulse does not wake them, so a settled corpse was
  // immovable before this too - it was just immovable AND expensive.
  let settled = false;
  const settledPose: { bone: THREE.Object3D; position: THREE.Vector3; quaternion: THREE.Quaternion }[] = [];
  let hipsBone: THREE.Object3D | null = null;
  let hinges: HingeRuntime[] = [];
  let cones: ConeRuntime[] = [];
  let activatedAtStep = 0;
  /** stepnumber at which the current run of quiet began; -1 when not quiet. */
  let quietSinceStep = -1;

  const activate = (opts: RagdollActivation = {}) => {
    const impulse = opts.impulse;
    if (active) return;
    active = true;
    model.updateMatrixWorld(true);

    const instanceId = nextRagdollInstanceId++;
    hipsBone = model.getObjectByName('mixamorigHips') ?? null;
    activatedAtStep = world.stepnumber;
    quietSinceStep = -1;
    const forwardWorld = deriveForward(model);
    const bodiesByName = new Map<string, CANNON.Body>();
    const boneWorldPos = new THREE.Vector3();
    const refWorldPos = new THREE.Vector3();
    const boneWorldQuat = new THREE.Quaternion();
    const dir = new THREE.Vector3();
    const upAxis = new THREE.Vector3(0, 1, 0);
    const bodyQuat = new THREE.Quaternion();

    RAGDOLL_BONES.forEach((spec) => {
      const bone = model.getObjectByName(spec.name);
      if (!bone) return;

      bone.getWorldPosition(boneWorldPos);
      bone.getWorldQuaternion(boneWorldQuat);

      const refObject = model.getObjectByName(spec.orientRef);
      const centerPos = boneWorldPos.clone();
      if (refObject) {
        refObject.getWorldPosition(refWorldPos);
        dir.copy(refWorldPos).sub(boneWorldPos);
        if (dir.lengthSq() > 1e-8) {
          dir.normalize();
          bodyQuat.setFromUnitVectors(upAxis, dir);
        } else {
          bodyQuat.identity();
        }
        centerPos.lerp(refWorldPos, 0.5);
      } else {
        bodyQuat.identity();
      }

      const shape = new CANNON.Box(
        new CANNON.Vec3(spec.halfExtents[0] * EXTENT_SCALE, spec.halfExtents[1] * EXTENT_SCALE, spec.halfExtents[2] * EXTENT_SCALE)
      );
      const body = new CANNON.Body({
        mass: spec.mass,
        shape,
        position: new CANNON.Vec3(centerPos.x, centerPos.y, centerPos.z),
        quaternion: new CANNON.Quaternion(bodyQuat.x, bodyQuat.y, bodyQuat.z, bodyQuat.w),
        // Open to the world AND to other limbs. Which limb pairs actually
        // collide is a per-PAIR question that a mask cannot express, so it is
        // settled by the broadphase hook in physicsWorld.ts: same corpse yes,
        // jointed pair no, different corpse no.
        collisionFilterGroup: PHYSICS_GROUP_RAGDOLL,
        collisionFilterMask: PHYSICS_GROUP_WORLD | PHYSICS_GROUP_RAGDOLL,
        linearDamping: 0.4,
        angularDamping: 0.6,
        allowSleep: true,
        sleepSpeedLimit: 0.2,
        sleepTimeLimit: 1
      });

      const offsetQuat = bodyQuat.clone().invert().multiply(boneWorldQuat);
      const offsetPos = boneWorldPos.clone().sub(centerPos).applyQuaternion(bodyQuat.clone().invert());

      bodiesByName.set(spec.name, body);
      world.addBody(body);
      runtimes.push({ bone, body, offsetPos, offsetQuat });
    });

    // Which limb pairs must never generate contacts.
    //
    // Being JOINTED is the obvious case, and assuming it was the ONLY case
    // left a real bug in. A shoulder's parent is Spine2, so Spine1/Shoulder
    // is not a jointed pair - yet those two boxes sit inside each other in
    // every pose, and left colliding they shoved the shoulders out of the
    // torso on every step. The same goes for the two thighs, for a thigh
    // against the spine, and for a shoulder against the neck: all of them
    // anatomically adjacent, none of them directly jointed, and between them
    // they accounted for most of 1183 limb-vs-limb contact frames in a
    // single fall.
    //
    // Two rules, both about boxes that were never meant to touch:
    //
    //  - GRAPH DISTANCE. Anything within two joints of each other in the
    //    skeleton is neighbouring geometry, not a collision. That covers
    //    parent/child, siblings, and grandparent/grandchild.
    //  - OVERLAP AT BIRTH. Anything already interpenetrating in the pose the
    //    ragdoll was built from, whatever the graph says.
    //
    // Everything further apart stays free to collide, which is what lets an
    // arm come to rest ON the chest - a hand is four joints from the torso.
    const ignores = new Map<CANNON.Body, Set<number>>();
    runtimes.forEach(({ body }) => ignores.set(body, new Set<number>()));
    const excludePair = (a: CANNON.Body, b: CANNON.Body) => {
      ignores.get(a)?.add(b.id);
      ignores.get(b)?.add(a.id);
    };

    // Adjacency over the bones that actually have bodies.
    const neighbours = new Map<string, string[]>();
    RAGDOLL_BONES.forEach((spec) => {
      if (!spec.parent || !bodiesByName.has(spec.name) || !bodiesByName.has(spec.parent)) return;
      if (!neighbours.has(spec.name)) neighbours.set(spec.name, []);
      if (!neighbours.has(spec.parent)) neighbours.set(spec.parent, []);
      neighbours.get(spec.name)!.push(spec.parent);
      neighbours.get(spec.parent)!.push(spec.name);
    });
    RAGDOLL_BONES.forEach((spec) => {
      const from = bodiesByName.get(spec.name);
      if (!from) return;
      // Breadth-first to depth 2; anything reached is neighbouring geometry.
      let frontier = [spec.name];
      const seen = new Set([spec.name]);
      for (let hop = 0; hop < HINGE_IGNORE_HOPS; hop++) {
        const next: string[] = [];
        for (const name of frontier) {
          for (const adjacent of neighbours.get(name) ?? []) {
            if (seen.has(adjacent)) continue;
            seen.add(adjacent);
            next.push(adjacent);
            const other = bodiesByName.get(adjacent);
            if (other) excludePair(from, other);
          }
        }
        frontier = next;
      }
    });

    runtimes.forEach(({ body }) => body.updateAABB());
    for (let i = 0; i < runtimes.length; i++) {
      for (let j = i + 1; j < runtimes.length; j++) {
        const a = runtimes[i].body;
        const b = runtimes[j].body;
        if (a.aabb.overlaps(b.aabb)) excludePair(a, b);
      }
    }
    runtimes.forEach(({ body }) => registerRagdollBody(body, instanceId, ignores.get(body) ?? new Set()));

    const upAxisLocal = new THREE.Vector3(0, 1, 0);
    const flexLocal = new THREE.Vector3();
    const parentQuatInv = new THREE.Quaternion();
    const tiltedAxis = new THREE.Vector3();

    // The torso's frame at death, for the hip and arm cones.
    const hipsBody = bodiesByName.get('mixamorigHips');
    const chestBody = bodiesByName.get('mixamorigSpine2') ?? hipsBody;
    const torsoUp = new THREE.Vector3(0, 1, 0);
    if (hipsBody) torsoUp.applyQuaternion(new THREE.Quaternion(hipsBody.quaternion.x, hipsBody.quaternion.y, hipsBody.quaternion.z, hipsBody.quaternion.w));
    const torsoForward = forwardWorld.clone().addScaledVector(torsoUp, -forwardWorld.dot(torsoUp));
    if (torsoForward.lengthSq() < 1e-8) torsoForward.set(0, 0, 1);
    torsoForward.normalize();
    const parentQuat = new THREE.Quaternion();
    const childQuat = new THREE.Quaternion();
    const neutralWorld = new THREE.Vector3();
    const limbWorld = new THREE.Vector3();
    const acrossWorld = new THREE.Vector3();
    const outward = new THREE.Vector3();

    RAGDOLL_BONES.forEach((spec) => {
      if (!spec.parent) return;
      const childBody = bodiesByName.get(spec.name);
      const parentBody = bodiesByName.get(spec.parent);
      const bone = model.getObjectByName(spec.name);
      if (!childBody || !parentBody || !bone) return;

      bone.getWorldPosition(boneWorldPos);
      const jointWorld = new CANNON.Vec3(boneWorldPos.x, boneWorldPos.y, boneWorldPos.z);

      const pivotA = parentBody.quaternion.inverse().vmult(jointWorld.vsub(parentBody.position));
      const pivotB = childBody.quaternion.inverse().vmult(jointWorld.vsub(childBody.position));

      parentQuat.set(parentBody.quaternion.x, parentBody.quaternion.y, parentBody.quaternion.z, parentBody.quaternion.w);
      childQuat.set(childBody.quaternion.x, childBody.quaternion.y, childBody.quaternion.z, childBody.quaternion.w);
      limbWorld.set(0, 1, 0).applyQuaternion(childQuat);
      if (spec.neutral === 'straight') neutralWorld.set(0, 1, 0).applyQuaternion(parentQuat);
      else if (spec.neutral === 'hip') neutralWorld.copy(torsoUp).multiplyScalar(-Math.cos(HIP_TILT)).addScaledVector(torsoForward, Math.sin(HIP_TILT));
      else if (spec.neutral === 'arm' && chestBody) {
        // Out from the chest on this arm's side, flattened across the torso, then angled forward.
        outward.set(boneWorldPos.x - chestBody.position.x, boneWorldPos.y - chestBody.position.y, boneWorldPos.z - chestBody.position.z);
        outward.addScaledVector(torsoUp, -outward.dot(torsoUp)).addScaledVector(torsoForward, -outward.dot(torsoForward));
        if (outward.lengthSq() < 1e-8) neutralWorld.copy(limbWorld);
        else neutralWorld.copy(outward.normalize()).addScaledVector(torsoForward, 0.6).normalize();
      } else neutralWorld.copy(limbWorld);
      parentQuatInv.copy(parentQuat).invert();
      const axisLocal = neutralWorld.clone().applyQuaternion(parentQuatInv);

      const constraint = new CANNON.ConeTwistConstraint(parentBody, childBody, {
        pivotA,
        pivotB,
        axisA: new CANNON.Vec3(axisLocal.x, axisLocal.y, axisLocal.z),
        axisB: new CANNON.Vec3(0, 1, 0),
        angle: spec.swingAngle,
        // Its own twist is replaced by TwistLimit below.
        twistAngle: Math.PI,
        // Belt and braces under the group mask above. cannon defaults this to
        // TRUE, which is what has any constrained pair colliding in the first
        // place. The mask should already prevent it, but this independently
        // removes exactly the parent/child pairs that overlap by construction
        // - so if the grouping is ever misconfigured or a body is created
        // outside createRagdoll, the worst offenders still cannot fight.
        collideConnected: false
      });
      constraint.twistEquation.enabled = false;
      world.addConstraint(constraint);
      constraints.push(constraint);
      cones.push({ parent: parentBody, child: childBody, axisLocal, angle: spec.swingAngle });

      // Twist reference: across the limb, side to side. A limb pointing
      // straight ahead (a foot) takes it from the torso's up instead.
      acrossWorld.crossVectors(limbWorld, torsoForward);
      if (acrossWorld.lengthSq() < 0.05) acrossWorld.crossVectors(limbWorld, torsoUp);
      if (acrossWorld.lengthSq() > 1e-8) {
        acrossWorld.normalize();
        const refA = acrossWorld.clone().applyQuaternion(parentQuatInv);
        const refB = acrossWorld.clone().applyQuaternion(childQuat.clone().invert());
        const twist = new TwistLimit(parentBody, childBody, new CANNON.Vec3(refA.x, refA.y, refA.z), new CANNON.Vec3(refB.x, refB.y, refB.z), spec.twistAngle);
        world.addConstraint(twist);
        constraints.push(twist);
      }

      if (!spec.hinge || spec.hingeAngle === undefined) return;

      // The flexion direction, in the PARENT body's local frame. Taken from
      // the pose rather than from a rig convention, so it is correct whatever
      // arbitrary roll setFromUnitVectors happened to pick for this body.
      flexLocal.copy(forwardWorld);
      if (spec.hinge === 'knee') flexLocal.negate();
      flexLocal.applyQuaternion(parentQuatInv);
      // Only the component across the bone can tilt the cone off it.
      flexLocal.addScaledVector(upAxisLocal, -flexLocal.dot(upAxisLocal));
      if (flexLocal.lengthSq() <= 1e-8) return;
      flexLocal.normalize();
      tiltedAxis
        .copy(upAxisLocal)
        .multiplyScalar(Math.cos(spec.hingeAngle))
        .addScaledVector(flexLocal, Math.sin(spec.hingeAngle));

      // A second ConeTwist used purely as a cone: its point-to-point and
      // twist equations are switched off, leaving only the one-sided cone
      // that refuses to let the joint open past straight. The primary
      // constraint above keeps the true bone axis, so its twist frame - which
      // is derived from axisA - stays correct.
      const hyperLimit = new CANNON.ConeTwistConstraint(parentBody, childBody, {
        pivotA,
        pivotB,
        axisA: new CANNON.Vec3(tiltedAxis.x, tiltedAxis.y, tiltedAxis.z),
        axisB: new CANNON.Vec3(0, 1, 0),
        angle: spec.hingeAngle,
        twistAngle: Math.PI,
        collideConnected: false
      });
      hyperLimit.equations.forEach((equation) => {
        if (equation !== hyperLimit.coneEquation) equation.enabled = false;
      });
      world.addConstraint(hyperLimit);
      constraints.push(hyperLimit);
      hinges.push({ parent: parentBody, child: childBody, flexLocal: flexLocal.clone() });
    });

    if (opts.velocity) {
      for (const { body } of runtimes) body.velocity.set(opts.velocity.x, opts.velocity.y, opts.velocity.z);
    }
    if (impulse) {
      const target = (opts.region && bodiesByName.get(REGION_BONE[opts.region])) || bodiesByName.get('mixamorigHips');
      target?.applyImpulse(new CANNON.Vec3(impulse.x, impulse.y, impulse.z));
    }
  };

  const worldPos = new THREE.Vector3();
  const worldQuat = new THREE.Quaternion();
  const localMatrix = new THREE.Matrix4();
  const unitScale = new THREE.Vector3(1, 1, 1);
  const parentInverse = new THREE.Matrix4();
  const bodyQuatThree = new THREE.Quaternion();
  // Mixamo bones never animate scale - decompose() needs somewhere to put
  // the matrix's scale component, but it must NOT be written onto the bone.
  // The parent's matrixWorld includes the model's root scale (0.012), so
  // composing with a unit world-scale and converting to local space would
  // otherwise bake in ~1/0.012 to "cancel" it, blowing the mesh up hugely.
  const discardedScale = new THREE.Vector3();

  /**
   * Cache the final pose and hand the bodies back. Called once, when the
   * corpse has come to rest.
   */
  const settle = () => {
    settledPose.length = 0;
    runtimes.forEach(({ bone }) => {
      settledPose.push({ bone, position: bone.position.clone(), quaternion: bone.quaternion.clone() });
    });
    constraints.forEach((c) => world.removeConstraint(c));
    runtimes.forEach(({ body }) => world.removeBody(body));
    constraints = [];
    runtimes = [];
    hinges = [];
    cones = [];
    settled = true;
  };

  // Scratch for the hinge clamp; this runs per hinge per frame.
  const hingeUp = new THREE.Vector3();
  const hingeDown = new THREE.Vector3();
  const hingePerp = new THREE.Vector3();
  const hingeFlex = new THREE.Vector3();
  const hingeAxis = new THREE.Vector3();
  const hingeQuat = new THREE.Quaternion();
  const hingeCorrection = new THREE.Quaternion();
  const hingeSpin = new THREE.Vector3();

  /**
   * Hard backstop for elbows and knees.
   *
   * Measures each hinge's bend against the flexion direction it was built
   * with, and if the joint has been driven backwards past the tolerance,
   * rotates the child body back to the tolerance and removes the angular
   * velocity that was pushing it there. Dissipative - it only ever takes
   * energy out - so it cannot make the ragdoll livelier.
   *
   * Everything is measured in the PARENT's frame, so a corpse lying on its
   * back is judged exactly like one standing up.
   */
  const clampHinges = () => {
    for (const hinge of hinges) {
      hingeQuat.set(hinge.parent.quaternion.x, hinge.parent.quaternion.y, hinge.parent.quaternion.z, hinge.parent.quaternion.w);
      hingeUp.set(0, 1, 0).applyQuaternion(hingeQuat);
      hingeFlex.copy(hinge.flexLocal).applyQuaternion(hingeQuat);

      hingeQuat.set(hinge.child.quaternion.x, hinge.child.quaternion.y, hinge.child.quaternion.z, hinge.child.quaternion.w);
      hingeDown.set(0, 1, 0).applyQuaternion(hingeQuat);

      const cos = Math.max(-1, Math.min(1, hingeUp.dot(hingeDown)));
      const bend = Math.acos(cos);
      if (bend <= HINGE_BACKWARD_TOLERANCE) continue;

      // Which side of straight is it on? Only the wrong side is policed.
      hingePerp.copy(hingeDown).addScaledVector(hingeUp, -cos);
      if (hingePerp.dot(hingeFlex) >= 0) continue;

      // Rotate the child back toward straight, leaving it at the tolerance.
      hingeAxis.crossVectors(hingeDown, hingeUp);
      if (hingeAxis.lengthSq() < 1e-12) continue;
      hingeAxis.normalize();
      hingeCorrection.setFromAxisAngle(hingeAxis, bend - HINGE_BACKWARD_TOLERANCE);
      hingeQuat.premultiply(hingeCorrection);
      hinge.child.quaternion.set(hingeQuat.x, hingeQuat.y, hingeQuat.z, hingeQuat.w);

      // And take out the spin that drove it there, so it does not simply
      // come straight back next step.
      hingeSpin.set(hinge.child.angularVelocity.x, hinge.child.angularVelocity.y, hinge.child.angularVelocity.z);
      const along = hingeSpin.dot(hingeAxis);
      if (along < 0) {
        hingeSpin.addScaledVector(hingeAxis, -along);
        hinge.child.angularVelocity.set(hingeSpin.x, hingeSpin.y, hingeSpin.z);
      }
    }
  };

  /**
   * Hard backstop for every cone, as clampHinges is for elbows and knees: a
   * hard enough hit drives a limb through a soft cone in one step. Rotates the
   * limb back to the rim and removes the spin carrying it outward. Only ever
   * takes energy out.
   */
  const clampCones = () => {
    for (const cone of cones) {
      hingeQuat.set(cone.parent.quaternion.x, cone.parent.quaternion.y, cone.parent.quaternion.z, cone.parent.quaternion.w);
      hingeUp.copy(cone.axisLocal).applyQuaternion(hingeQuat);
      hingeQuat.set(cone.child.quaternion.x, cone.child.quaternion.y, cone.child.quaternion.z, cone.child.quaternion.w);
      hingeDown.set(0, 1, 0).applyQuaternion(hingeQuat);
      const off = Math.acos(Math.max(-1, Math.min(1, hingeUp.dot(hingeDown))));
      if (off <= cone.angle + CONE_TOLERANCE) continue;
      hingeAxis.crossVectors(hingeDown, hingeUp);
      if (hingeAxis.lengthSq() < 1e-12) continue;
      hingeAxis.normalize();
      hingeCorrection.setFromAxisAngle(hingeAxis, off - cone.angle - CONE_TOLERANCE);
      hingeQuat.premultiply(hingeCorrection);
      cone.child.quaternion.set(hingeQuat.x, hingeQuat.y, hingeQuat.z, hingeQuat.w);
      hingeSpin.set(cone.child.angularVelocity.x, cone.child.angularVelocity.y, cone.child.angularVelocity.z);
      const along = hingeSpin.dot(hingeAxis);
      if (along < 0) {
        hingeSpin.addScaledVector(hingeAxis, -along);
        cone.child.angularVelocity.set(hingeSpin.x, hingeSpin.y, hingeSpin.z);
      }
    }
  };

  const update = () => {
    if (!active) return;

    if (settled) {
      // The animation mixer is never stopped, so it re-poses these bones
      // every frame and they have to be written back over it - same as when
      // the physics was live, just from a cache instead of from bodies.
      for (const frozen of settledPose) {
        frozen.bone.position.copy(frozen.position);
        frozen.bone.quaternion.copy(frozen.quaternion);
      }
      return;
    }

    clampVelocities();
    clampCones();
    clampHinges();
    runtimes.forEach(({ bone, body, offsetPos, offsetQuat }) => {
      bodyQuatThree.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);

      worldQuat.copy(bodyQuatThree).multiply(offsetQuat);
      worldPos.copy(offsetPos).applyQuaternion(bodyQuatThree);
      worldPos.x += body.position.x;
      worldPos.y += body.position.y;
      worldPos.z += body.position.z;

      if (!bone.parent) return;
      bone.parent.updateWorldMatrix(true, false);
      localMatrix.compose(worldPos, worldQuat, unitScale);
      parentInverse.copy(bone.parent.matrixWorld).invert();
      localMatrix.premultiply(parentInverse);
      localMatrix.decompose(bone.position, bone.quaternion, discardedScale);
    });

    // Asleep in cannon's own judgement, or simply out of patience: a limb
    // balanced on an edge can jitter below the sleep threshold indefinitely,
    // and an unbounded cost is worse than a corpse that stops twitching.
    let maxLinear = 0;
    let maxAngular = 0;
    for (const { body } of runtimes) {
      maxLinear = Math.max(maxLinear, body.velocity.lengthSquared());
      maxAngular = Math.max(maxAngular, body.angularVelocity.lengthSquared());
    }
    const quiet =
      maxLinear < SETTLE_LINEAR_SPEED * SETTLE_LINEAR_SPEED &&
      maxAngular < SETTLE_ANGULAR_SPEED * SETTLE_ANGULAR_SPEED;
    if (!quiet) quietSinceStep = -1;
    else if (quietSinceStep < 0) quietSinceStep = world.stepnumber;
    const quietSteps = quietSinceStep < 0 ? 0 : world.stepnumber - quietSinceStep;
    const stepsAlive = world.stepnumber - activatedAtStep;
    if (runtimes.length > 0 && (quietSteps >= SETTLE_QUIET_STEPS || stepsAlive > SETTLE_STEP_LIMIT)) settle();
  };

  const applyImpulseToHips = (impulse: THREE.Vector3) => {
    const hips = runtimes.find((r) => r.bone.name === 'mixamorigHips');
    hips?.body.applyImpulse(new CANNON.Vec3(impulse.x, impulse.y, impulse.z));
  };

  // Safety net: nothing should ever exceed a sane speed, regardless of how
  // many frames of contact/impulses stack up. Cheap insurance against any
  // runaway velocity turning the ragdoll into a rocket.
  const MAX_BODY_SPEED = 8;
  const clampVelocities = () => {
    runtimes.forEach(({ body }) => {
      const speedSq = body.velocity.lengthSquared();
      if (speedSq > MAX_BODY_SPEED * MAX_BODY_SPEED) {
        body.velocity.scale(MAX_BODY_SPEED / Math.sqrt(speedSq), body.velocity);
      }
    });
  };

  // Reads the BONE, so it keeps working once the bodies have been released.
  const getHipsWorldPosition = (target: THREE.Vector3) => {
    if (hipsBone) hipsBone.getWorldPosition(target);
  };

  const dispose = () => {
    constraints.forEach((c) => world.removeConstraint(c));
    runtimes.forEach(({ body }) => world.removeBody(body));
    constraints = [];
    runtimes = [];
    hinges = [];
    cones = [];
    settledPose.length = 0;
    settled = false;
    hipsBone = null;
    active = false;
  };

  return { activate, update, dispose, isActive: () => active, isSettled: () => settled, applyImpulseToHips, getHipsWorldPosition };
};
