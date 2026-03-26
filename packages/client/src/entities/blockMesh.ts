import * as THREE from 'three';
import { Element, BlockOrientation } from '@fbwb/shared';
import type { GameRenderer } from '../renderer/scene.js';
import {
  createFireParticles,
  createWaterParticles,
  updateFireParticles,
  updateWaterParticles,
} from './effects.js';

const BLOCK_STYLES: Record<Element, { color: number; emissive: number }> = {
  [Element.Fire]:  { color: 0xff6b35, emissive: 0xff2200 },
  [Element.Water]: { color: 0x4fc3f7, emissive: 0x0066cc },
};

const ROLL_DURATION = 0.3; // seconds

// Block half-dimensions (geometry is 0.9 × 1.8 × 0.9)
const HALF_W = 0.45;   // half of 0.9 (x and z)
const HALF_H = 0.9;    // half of 1.8 (tall axis)

interface BlockPose {
  position: { x: number; y: number };
  orientation: BlockOrientation;
}

enum RollDirection {
  North,
  South,
  East,
  West,
}

/**
 * Describes how to animate a single roll: the pivot point on the ground,
 * the rotation axis, the rotation angle, and the final pose.
 */
interface RollSpec {
  pivotWorld: THREE.Vector3;   // world-space pivot point (on the ground)
  rotationAxis: THREE.Vector3; // unit axis to rotate around
  rotationAngle: number;       // total rotation in radians (always ±PI/2)
}

interface PivotAnimation {
  spec: RollSpec;
  from: BlockPose;
  to: BlockPose;
  startTime: number;
  // Cached starting state (mesh position and quaternion relative to pivot)
  startLocalPos: THREE.Vector3;
  startLocalQuat: THREE.Quaternion;
}

/**
 * Returns the world-space position and euler rotation for a given grid pose.
 */
function poseToWorld(
  renderer: GameRenderer,
  pose: BlockPose,
): { pos: THREE.Vector3; rot: THREE.Euler } {
  const worldPos = renderer.gridToWorld(pose.position.x, pose.position.y);
  switch (pose.orientation) {
    case BlockOrientation.Standing:
      return {
        pos: new THREE.Vector3(worldPos.x, HALF_H, worldPos.z),
        rot: new THREE.Euler(0, 0, 0),
      };
    case BlockOrientation.LyingX:
      return {
        pos: new THREE.Vector3(worldPos.x + 0.5, HALF_W, worldPos.z),
        rot: new THREE.Euler(0, 0, Math.PI / 2),
      };
    case BlockOrientation.LyingY:
      return {
        pos: new THREE.Vector3(worldPos.x, HALF_W, worldPos.z - 0.5),
        rot: new THREE.Euler(Math.PI / 2, 0, 0),
      };
  }
}

/**
 * Infer the roll direction from from-pose to to-pose.
 */
function inferDirection(from: BlockPose, to: BlockPose): RollDirection {
  const dx = to.position.x - from.position.x;
  const dy = to.position.y - from.position.y;

  // One of dx/dy will be non-zero
  if (dx > 0) return RollDirection.East;
  if (dx < 0) return RollDirection.West;
  if (dy > 0) return RollDirection.North;
  return RollDirection.South;
}

/**
 * Calculate the pivot point, rotation axis, and angle for a roll.
 *
 * The pivot is the leading bottom edge of the block in the direction of
 * movement, sitting on the ground (y=0).
 *
 * Rotation axis is perpendicular to the direction of movement:
 *   - North/South movement → rotate around X axis
 *   - East/West movement → rotate around Z axis
 *
 * Coordinate system:
 *   - World X increases east
 *   - World Y is up
 *   - World Z decreases going north (gridToWorld: z = -gridY + offset)
 *   - Tile size = 1
 */
function computeRollSpec(
  renderer: GameRenderer,
  from: BlockPose,
  to: BlockPose,
  direction: RollDirection,
): RollSpec {
  const fromWorld = poseToWorld(renderer, from);
  const centerPos = fromWorld.pos;

  let pivotWorld: THREE.Vector3;
  let rotationAxis: THREE.Vector3;
  let rotationAngle: number;

  switch (from.orientation) {
    case BlockOrientation.Standing:
      // Block is standing upright. Center at (cx, 0.9, cz).
      // Bottom face is 0.9×0.9 centered at (cx, 0, cz).
      switch (direction) {
        case RollDirection.North:
          // Leading edge is the north edge of the base: z = cz - HALF_W
          // Pivot at (cx, 0, cz - HALF_W). Rotate around X axis.
          // Block tips north (negative Z) → rotation is negative around X
          pivotWorld = new THREE.Vector3(centerPos.x, 0, centerPos.z - HALF_W);
          rotationAxis = new THREE.Vector3(1, 0, 0);
          rotationAngle = -Math.PI / 2;
          break;
        case RollDirection.South:
          // Leading edge is the south edge of the base: z = cz + HALF_W
          pivotWorld = new THREE.Vector3(centerPos.x, 0, centerPos.z + HALF_W);
          rotationAxis = new THREE.Vector3(1, 0, 0);
          rotationAngle = Math.PI / 2;
          break;
        case RollDirection.East:
          // Leading edge is the east edge of the base: x = cx + HALF_W
          pivotWorld = new THREE.Vector3(centerPos.x + HALF_W, 0, centerPos.z);
          rotationAxis = new THREE.Vector3(0, 0, 1);
          rotationAngle = -Math.PI / 2;
          break;
        case RollDirection.West:
          // Leading edge is the west edge of the base: x = cx - HALF_W
          pivotWorld = new THREE.Vector3(centerPos.x - HALF_W, 0, centerPos.z);
          rotationAxis = new THREE.Vector3(0, 0, 1);
          rotationAngle = Math.PI / 2;
          break;
      }
      break;

    case BlockOrientation.LyingX:
      // Block lying along X axis. Center at (cx, 0.45, cz).
      // The 1.8 dimension is along X, so it extends ±0.9 in X from center.
      // The 0.9 dimensions are along Y (height=0.9) and Z.
      // Bottom face is a 1.8×0.9 rectangle on the ground.
      switch (direction) {
        case RollDirection.East:
          // Leading edge is east end: x = cx + HALF_H (0.9)
          // This is the "short" edge. Block will stand up.
          pivotWorld = new THREE.Vector3(centerPos.x + HALF_H, 0, centerPos.z);
          rotationAxis = new THREE.Vector3(0, 0, 1);
          rotationAngle = -Math.PI / 2;
          break;
        case RollDirection.West:
          // Leading edge is west end: x = cx - HALF_H
          pivotWorld = new THREE.Vector3(centerPos.x - HALF_H, 0, centerPos.z);
          rotationAxis = new THREE.Vector3(0, 0, 1);
          rotationAngle = Math.PI / 2;
          break;
        case RollDirection.North:
          // Leading edge is north edge: z = cz - HALF_W
          // Block stays lying along X.
          pivotWorld = new THREE.Vector3(centerPos.x, 0, centerPos.z - HALF_W);
          rotationAxis = new THREE.Vector3(1, 0, 0);
          rotationAngle = -Math.PI / 2;
          break;
        case RollDirection.South:
          // Leading edge is south edge: z = cz + HALF_W
          pivotWorld = new THREE.Vector3(centerPos.x, 0, centerPos.z + HALF_W);
          rotationAxis = new THREE.Vector3(1, 0, 0);
          rotationAngle = Math.PI / 2;
          break;
      }
      break;

    case BlockOrientation.LyingY:
      // Block lying along Z axis (grid Y → world -Z). Center at (cx, 0.45, cz).
      // The 1.8 dimension is along Z, so it extends ±0.9 in Z from center.
      // The 0.9 dimensions are along X and Y (height=0.9).
      // Bottom face is a 0.9×1.8 rectangle on the ground.
      switch (direction) {
        case RollDirection.North:
          // Leading edge is north end: z = cz - HALF_H (0.9)
          // Block will stand up.
          pivotWorld = new THREE.Vector3(centerPos.x, 0, centerPos.z - HALF_H);
          rotationAxis = new THREE.Vector3(1, 0, 0);
          rotationAngle = -Math.PI / 2;
          break;
        case RollDirection.South:
          // Leading edge is south end: z = cz + HALF_H
          pivotWorld = new THREE.Vector3(centerPos.x, 0, centerPos.z + HALF_H);
          rotationAxis = new THREE.Vector3(1, 0, 0);
          rotationAngle = Math.PI / 2;
          break;
        case RollDirection.East:
          // Leading edge is east edge: x = cx + HALF_W
          // Block stays lying along Z.
          pivotWorld = new THREE.Vector3(centerPos.x + HALF_W, 0, centerPos.z);
          rotationAxis = new THREE.Vector3(0, 0, 1);
          rotationAngle = -Math.PI / 2;
          break;
        case RollDirection.West:
          // Leading edge is west edge: x = cx - HALF_W
          pivotWorld = new THREE.Vector3(centerPos.x - HALF_W, 0, centerPos.z);
          rotationAxis = new THREE.Vector3(0, 0, 1);
          rotationAngle = Math.PI / 2;
          break;
      }
      break;
  }

  return { pivotWorld: pivotWorld!, rotationAxis: rotationAxis!, rotationAngle: rotationAngle! };
}

// Smooth easing for the roll animation
function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export class BlockMesh {
  private mesh: THREE.Mesh;
  private renderer: GameRenderer;
  private particles: THREE.Points;
  private element: Element;

  // Animation state
  private currentAnimation: PivotAnimation | null = null;
  private moveQueue: Array<{ from: BlockPose; to: BlockPose }> = [];

  // The settled pose — updated when an animation completes
  private settledPose: BlockPose | null = null;

  constructor(renderer: GameRenderer, element: Element) {
    this.renderer = renderer;
    this.element = element;

    const style = BLOCK_STYLES[element];
    const geometry = new THREE.BoxGeometry(0.9, 1.8, 0.9);
    const material = new THREE.MeshStandardMaterial({
      color: style.color,
      emissive: style.emissive,
      emissiveIntensity: 0.3,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    renderer.scene.add(this.mesh);

    // Create element-specific particles attached to the mesh
    if (element === Element.Fire) {
      this.particles = createFireParticles(this.mesh);
    } else {
      this.particles = createWaterParticles(this.mesh);
    }
  }

  setPositionImmediate(
    position: { x: number; y: number },
    orientation: BlockOrientation,
  ) {
    // Cancel any in-flight animation and queue
    this.currentAnimation = null;
    this.moveQueue = [];

    const pose: BlockPose = { position, orientation };
    this.settledPose = pose;
    this._applyPose(pose);
  }

  /**
   * Enqueue a roll from fromPos/fromOri to toPos/toOri.
   * If nothing is currently animating, start immediately.
   */
  animateRoll(
    fromPos: { x: number; y: number },
    fromOri: BlockOrientation,
    toPos: { x: number; y: number },
    toOri: BlockOrientation,
    now: number,
  ) {
    const from: BlockPose = { position: fromPos, orientation: fromOri };
    const to: BlockPose = { position: toPos, orientation: toOri };

    if (this.currentAnimation === null) {
      this._startAnimation(from, to, now);
    } else {
      this.moveQueue.push({ from, to });
    }
  }

  /** Returns true if there is an active animation or queued moves. */
  isAnimating(): boolean {
    return this.currentAnimation !== null || this.moveQueue.length > 0;
  }

  setVisible(visible: boolean) {
    this.mesh.visible = visible;
  }

  update(dt: number, time: number) {
    // Drive rolling animation
    if (this.currentAnimation !== null) {
      const anim = this.currentAnimation;
      const rawT = (time - anim.startTime) / ROLL_DURATION;
      const t = Math.min(rawT, 1);
      const easedT = easeInOutQuad(t);

      // The current fractional rotation angle
      const currentAngle = anim.spec.rotationAngle * easedT;

      // Build a quaternion for rotating around the axis by currentAngle
      const pivotQuat = new THREE.Quaternion().setFromAxisAngle(
        anim.spec.rotationAxis,
        currentAngle,
      );

      // The mesh position relative to pivot, rotated by the current angle
      const rotatedLocalPos = anim.startLocalPos.clone().applyQuaternion(pivotQuat);

      // Set mesh world position = pivot + rotated local position
      this.mesh.position.copy(anim.spec.pivotWorld).add(rotatedLocalPos);

      // Set mesh world quaternion = pivotQuat * startLocalQuat
      this.mesh.quaternion.copy(pivotQuat).multiply(anim.startLocalQuat);

      if (t >= 1) {
        // Snap to exact final state
        this._applyPose(anim.to);
        this.settledPose = anim.to;
        this.currentAnimation = null;

        // Start next queued move if any
        if (this.moveQueue.length > 0) {
          const next = this.moveQueue.shift()!;
          this._startAnimation(next.from, next.to, time);
        }
      }
    }

    // Update particle effects
    if (this.element === Element.Fire) {
      updateFireParticles(this.particles, dt);
    } else {
      updateWaterParticles(this.particles, time);
    }
  }

  // ---- private helpers ----

  private _startAnimation(from: BlockPose, to: BlockPose, now: number) {
    // Place mesh at the from pose
    this._applyPose(from);

    // Compute the roll specification
    const direction = inferDirection(from, to);
    const spec = computeRollSpec(this.renderer, from, to, direction);

    // Cache the mesh's starting position/quaternion relative to the pivot
    const startLocalPos = this.mesh.position.clone().sub(spec.pivotWorld);
    const startLocalQuat = this.mesh.quaternion.clone();

    this.currentAnimation = {
      spec,
      from,
      to,
      startTime: now,
      startLocalPos,
      startLocalQuat,
    };
  }

  private _applyPose(pose: BlockPose) {
    const { pos, rot } = poseToWorld(this.renderer, pose);
    this.mesh.position.copy(pos);
    this.mesh.rotation.copy(rot);
  }
}
