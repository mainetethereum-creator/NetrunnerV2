import * as THREE from "three";

// Owns a character's procedural poses on top of its skeletal animation. Right
// now that means a relaxed arms-down idle; it is the seam where run/attack pose
// logic and weapon holds will hang too.
//
// Why it exists: every Meshy rig binds in a wide A-pose, and simply lowering the
// UPPER arm leaves the forearm pointing forward-and-inward (its bind stays put),
// so hands drift in front of the belly. The controller aims the whole arm chain
// -- shoulder AND forearm -- down, once, from the bind pose, and stores each
// segment's local target. Because the targets are fixed quaternions the render
// loop only slerps toward, nothing is recomputed per frame, so nothing jitters.

const LIMB = new THREE.Vector3(0, 1, 0); // Meshy bones point +Y down the limb

export class PoseController {
  private bones: Record<string, THREE.Object3D> = {};
  private idle: Record<string, THREE.Quaternion> = {};

  constructor(root: THREE.Object3D) {
    const prefixed: Array<[string, THREE.Object3D]> = [];
    root.traverse((o) => {
      if (!(o as THREE.Bone).isBone) return;
      this.bones[o.name] = o;
      // Meshy rigs name the bone "LeftArm"; Mixamo names the same bone
      // "mixamorig:LeftArm". Every lookup below asks for the bare name, so a
      // Mixamo rig used to miss every bone, buildIdle set nothing, and the
      // character stood in its bind T-pose (Neon Sentinel, which also ships no
      // Idle clip, so nothing else covered for it). Index the bare name too.
      // GLTFLoader removes colons: mixamorig:LeftArm becomes mixamorigLeftArm.
      const bare = o.name.replace(/^.*[:|]/, "").replace(/^mixamorig/i, "");
      if (bare !== o.name) prefixed.push([bare, o]);
    });
    // Applied after the raw pass so a rig that genuinely has a plain "LeftArm"
    // keeps it, and only unclaimed names fall back to the stripped alias.
    for (const [bare, bone] of prefixed) if (!(bare in this.bones)) this.bones[bare] = bone;
  }

  /** Solve the arms-down idle from the current (bind) pose. Call once, after the
   *  skeleton is settled and its world matrices are up to date. */
  buildIdle(root: THREE.Object3D) {
    root.updateMatrixWorld(true);
    const rootPos = root.getWorldPosition(new THREE.Vector3());
    for (const side of ["Left", "Right"] as const) {
      const shoulder = this.bones[`${side}Arm`];
      if (!shoulder) continue;
      // Which way this shoulder sits, from its bind world X. Solved while the
      // body faces +Z (load time), so world X is the character's left/right.
      const sx = shoulder.getWorldPosition(new THREE.Vector3()).x - rootPos.x;
      const s = Math.sign(sx) || (side === "Left" ? -1 : 1);
      // Down, splayed out to its own side so the arm clears the torso instead of
      // hugging it, a hair forward so the elbow reads.
      this.aim(`${side}Arm`, new THREE.Vector3(s * 0.30, -1, 0.08), root);
      // Forearm continues down and keeps some of that outward splay, so the hand
      // hangs beside the thigh rather than pressed to it.
      this.aim(`${side}ForeArm`, new THREE.Vector3(s * 0.22, -1, 0.12), root);
    }
  }

  /** Rotate one bone so its limb axis points along `targetDir` (world), store the
   *  resulting local quaternion, and apply it now so the next segment down the
   *  chain aims from the corrected parent. */
  private aim(name: string, targetDir: THREE.Vector3, root: THREE.Object3D) {
    const bone = this.bones[name];
    if (!bone || !bone.parent) return;
    const wq = bone.getWorldQuaternion(new THREE.Quaternion());
    const cur = LIMB.clone().applyQuaternion(wq).normalize();
    const rot = new THREE.Quaternion().setFromUnitVectors(cur, targetDir.clone().normalize());
    wq.premultiply(rot);
    const pq = bone.parent.getWorldQuaternion(new THREE.Quaternion());
    const local = pq.invert().multiply(wq);
    this.idle[name] = local;
    bone.quaternion.copy(local);
    root.updateMatrixWorld(true);
  }

  /** Blend the idle-managed bones toward their idle target by `weight`
   *  (1 = fully idle, 0 = leave the animation untouched). Call each frame AFTER
   *  the animation mixer has written its pose. */
  apply(weight: number) {
    if (weight <= 0.001) return;
    for (const name in this.idle) {
      const bone = this.bones[name];
      if (bone) bone.quaternion.slerp(this.idle[name], weight);
    }
  }

  get hasIdle() {
    return Object.keys(this.idle).length > 0;
  }
}
