// Attack animation per player class.
//
// The clips are Meshy library actions, generated against a Meshy rig of our own
// ronin and shipped as animation-only donors (mesh kept, textures stripped —
// retargetAnimationClip finds the skeleton through the skinned mesh). Bone
// names match our native rig, but bind poses do not, so the donor is retargeted
// with bind-relative world deltas rather than copied. See ASSET_PIPELINE.md and
// scripts/fetch-meshy-actions.mjs for how to regenerate them.
//
// Each donor is a full library action — a slash with its approach and recovery,
// a cowboy draw that starts at the holster, a mage cast that gathers overhead.
// Only the part that reads as the attack is kept; TRIM is measured from the
// retargeted clip (peak hand speed and the furthest-forward frame), not guessed.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { retargetAnimationClip } from "./run-retarget";
type ClassCombatStyle = "melee" | "ranged" | "tech";

const ANIMS = "/game/models/anim/";
/** Bump when a donor is re-exported — /public URLs do not change on their own. */
const ANIM_VERSION = "1";

interface ActionDef {
  /** Donor file under public/game/models/anim/. */
  file: string;
  /** Meshy library action this came from, for traceability. */
  source: string;
  /** Seconds of the donor clip to keep: [start, end]. */
  trim: readonly [number, number];
  /** Where the hit reads inside the trimmed clip, 0..1. Documentation for the
   *  warp below — the sim applies damage at the swing start, so this wants to
   *  be early. */
  contact: number;
  /** Playback warp exponent: clipPhase = phase ** warp. Below 1 the action
   *  front-loads, so the strike lands early in the attack window and the
   *  recovery uses the rest of it. */
  warp: number;
}

const ACTIONS: Record<ClassCombatStyle, ActionDef> = {
  // WARRIOR — right-handed diagonal cut. Trimmed to the cocked hold through the
  // follow-through; the donor's approach and return to guard are dropped.
  // The window is the CUT, not the whole action. Measured on the blade tip in
  // the character frame, the donor spends 0.25-0.50 s with the blade behind the
  // right shoulder and 0.65-0.90 s carrying it away behind the left: trimming
  // from 0.40 started the attack mid-wind-up, with the sword pointing sideways
  // and backwards, which is what read as "he swings to the side". Front reach
  // peaks at 0.55-0.60 s, so the window is just around that.
  melee: { file: "slash.glb", source: "219 Right_Hand_Sword_Slash", trim: [0.48, 0.70], contact: 0.43, warp: 0.8 },
  // RANGER — quick draw to a one-handed point, then held on target, so repeat
  // fire reads as a gunslinger snapping back onto the target.
  ranged: { file: "shoot.glb", source: "232 Cowboy_Quick_Draw_Shooting", trim: [2.25, 2.95], contact: 0.46, warp: 0.65 },
  // HACKER — overhead gather hurled forward, then the palm stays out. Picked
  // over the other seven mage clips because its hand travels furthest forward
  // (f -0.74 torso lengths) at the highest speed.
  tech: { file: "cast.glb", source: "131 mage_soell_cast_2", trim: [1.05, 1.95], contact: 0.24, warp: 0.8 },
};

/** Cut a clip down to [start, end] seconds and rebase it to zero.
 *  The retarget resamples uniformly, so time maps straight onto frames. */
function trimClip(clip: THREE.AnimationClip, start: number, end: number): THREE.AnimationClip {
  const frames = Math.max(...clip.tracks.map((t) => t.times.length));
  const fps = frames / clip.duration;
  const from = Math.max(0, Math.round(start * fps));
  const to = Math.min(frames - 1, Math.round(end * fps));
  if (to <= from) return clip;
  const cut = THREE.AnimationUtils.subclip(clip.clone(), clip.name, from, to, fps);
  // subclip leaves the declared duration at the source length on some three
  // versions; recompute it from what actually survived.
  cut.resetDuration();
  return cut;
}

/** How much of the donor's motion each part of the body keeps.
 *
 *  The library actions are full-blooded mocap fighting stances: measured
 *  against our rest pose, the sword slash bends the knees to 94-130 degrees
 *  (a straight leg is ~180, ours rest at 166) and leans the torso up to 26
 *  degrees. That is correct for a hero shot and unreadable on a character
 *  drawn 60 px tall from above — it reads as hunched and broken.
 *
 *  So the swing is taken from the arms at full strength and the crouch is
 *  damped out of the legs. This is the standard upper-body-only trick, done
 *  as a weight per bone rather than by throwing the lower body away, so the
 *  weight shift still reads. */
const STANCE_WEIGHT: ReadonlyArray<readonly [RegExp, number]> = [
  [/UpLeg|Leg$|Foot|ToeBase/, 0.30], // legs: keep a hint of the stance
  [/^Hips$/, 0.45],                  // pelvis: some drop and twist
  [/Spine/, 0.70],                   // torso: most of the coil
];

const weightFor = (bone: string) => {
  for (const [pattern, weight] of STANCE_WEIGHT) if (pattern.test(bone)) return weight;
  return 1;
};

/** Bones the attack does not touch at all: the strike is thrown with the right
 *  arm, and the free arm and the head hold whatever the idle left them doing.
 *
 *  These are dropped as TRACKS rather than damped to zero weight. Zero weight
 *  would mean "use the reference pose", and the reference is how the character
 *  loads — a wide Meshy A-pose — so the free arm would snap out sideways the
 *  moment an attack started. With no track at all the mixer never writes those
 *  bones during the swing, so they simply stay where the idle put them. */
const FROZEN = ["LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand", "neck", "Head"];
const FROZEN_TRACK = new RegExp(`^(${FROZEN.join("|")}|head_end|headfront)\\.`);

/** Hold the free arm and the head still while the right arm swings.
 *
 *  Dropping their tracks is not enough on its own: they hang off the spine, so
 *  the torso twist still carries them (measured: 0.20 m of travel with their
 *  own animation already removed). So each one gets a track that cancels
 *  whatever its parent is doing — local = parentWorld^-1 * restWorld — which
 *  pins it in world space for the length of the swing. The head therefore keeps
 *  facing the target instead of being dragged around by the shoulders. */
function pinBones(
  targetRoot: THREE.Object3D,
  clip: THREE.AnimationClip,
  reference: PoseSnapshot | null,
  hold: PoseSnapshot | null,
) {
  if (!reference) return;
  clip.tracks = clip.tracks.filter((track) => !FROZEN_TRACK.test(track.name));

  const bones = FROZEN
    .map((name) => targetRoot.getObjectByName(name))
    .filter((b): b is THREE.Object3D => Boolean(b) && Boolean(b!.parent));
  if (!bones.length) return;

  // The orientation to hold is the character's IDLE, not the pose it loads in.
  // The load pose is the wide Meshy A-pose; pinning the free arm to that pushes
  // it out and through the coat, because what the player sees at idle is
  // PoseController's arms-down. Everything else still measures from the load
  // pose, so the two are passed separately.
  applyPose(targetRoot, hold ?? reference);
  const restWorld = new Map(bones.map((b) => [b.name, b.getWorldQuaternion(new THREE.Quaternion())]));
  applyPose(targetRoot, reference);

  const times = clip.tracks.find((t) => t.name.endsWith(".quaternion"))?.times;
  if (!times) return;

  const mixer = new THREE.AnimationMixer(targetRoot);
  const action = mixer.clipAction(clip);
  action.play();
  const values = new Map(bones.map((b) => [b.name, new Float32Array(times.length * 4)]));
  const parentWorld = new THREE.Quaternion();
  for (let i = 0; i < times.length; i++) {
    mixer.setTime(0);
    mixer.setTime(times[i]);
    targetRoot.updateMatrixWorld(true);
    // Parent first, and apply each correction before solving its child: the
    // shoulder's own fix changes the arm's parent frame, so solving the whole
    // chain against the uncorrected pose leaves the hand further out than
    // doing nothing at all.
    for (const bone of bones) {
      bone.parent!.getWorldQuaternion(parentWorld);
      const local = parentWorld.invert().multiply(restWorld.get(bone.name)!).normalize();
      local.toArray(values.get(bone.name)!, i * 4);
      bone.quaternion.copy(local);
      bone.updateWorldMatrix(false, true);
    }
  }
  action.stop();
  mixer.uncacheClip(clip);

  for (const bone of bones) {
    clip.tracks.push(new THREE.QuaternionKeyframeTrack(
      `${bone.name}.quaternion`, times as Float32Array, values.get(bone.name)!));
  }
}

/** Strip the whole-body turn out of the clip, keeping the torso twist.
 *
 *  The library slash is a full-body pivot: measured on the finished clip, the
 *  shoulder line swings through 88 degrees and back inside one 0.38 s attack.
 *  In a hero shot that is the power of the swing; from a fixed iso camera, on a
 *  character that must keep facing the thing it is hitting, it reads as the
 *  hero spinning away and flailing — which is exactly what looked "wrong in
 *  motion" while every still frame looked fine.
 *
 *  Only the yaw of the pelvis is removed (swing-twist decomposition about the
 *  model's up axis). The spine and shoulders keep their twist, so the cut still
 *  winds up and unwinds; the character just no longer turns its back. */
function removeBodyYaw(clip: THREE.AnimationClip, reference: PoseSnapshot | null) {
  const track = clip.tracks.find((t) => t.name === "Hips.quaternion");
  const rest = reference?.get("Hips")?.quaternion;
  if (!track || !rest) return;
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();
  const delta = new THREE.Quaternion();
  const twist = new THREE.Quaternion();
  const restInverse = rest.clone().invert();
  for (let i = 0; i < track.values.length; i += 4) {
    q.fromArray(track.values, i);
    delta.copy(q).multiply(restInverse);
    // twist component of delta about up
    const axis = new THREE.Vector3(delta.x, delta.y, delta.z);
    const projected = up.clone().multiplyScalar(axis.dot(up));
    twist.set(projected.x, projected.y, projected.z, delta.w);
    if (twist.lengthSq() < 1e-8) continue;
    twist.normalize();
    delta.multiply(twist.invert());
    delta.multiply(rest).normalize().toArray(track.values, i);
  }
}

/** Blend the clip back toward the character's own standing pose, per bone. */
function dampStance(clip: THREE.AnimationClip, reference: PoseSnapshot | null) {
  if (!reference) return;
  const q = new THREE.Quaternion();
  const rest = new THREE.Quaternion();
  for (const track of clip.tracks) {
    const [bone, prop] = track.name.split(".");
    const weight = weightFor(bone);
    if (weight >= 1) continue;
    const saved = reference.get(bone);
    if (!saved) continue;
    if (prop === "quaternion") {
      rest.copy(saved.quaternion);
      for (let i = 0; i < track.values.length; i += 4) {
        q.fromArray(track.values, i);
        rest.clone().slerp(q, weight).normalize().toArray(track.values, i);
      }
    } else if (prop === "position") {
      for (let i = 0; i < track.values.length; i += 3) {
        track.values[i] = saved.position.x + (track.values[i] - saved.position.x) * weight;
        track.values[i + 1] = saved.position.y + (track.values[i + 1] - saved.position.y) * weight;
        track.values[i + 2] = saved.position.z + (track.values[i + 2] - saved.position.z) * weight;
      }
    }
  }
}

/** Drop the pelvis until the lower foot sits back on the floor, frame by frame.
 *
 *  The donor is a different build from our characters — its legs are longer
 *  relative to its torso — so a faithful retarget still leaves the feet in the
 *  air: measured at 0.11-0.28 torso lengths (5-14 cm) above the bind foot line
 *  across all three actions, which reads as a character hovering in a crouch.
 *  These are in-place attacks with at least one foot planted, so pinning the
 *  lower foot to where it rests is both safe and what the eye expects. */
function plantFeet(targetRoot: THREE.Object3D, clip: THREE.AnimationClip) {
  const hipsTrack = clip.tracks.find((t) => t.name === "Hips.position");
  if (!hipsTrack) return;
  const feet = ["LeftToeBase", "RightToeBase", "LeftFoot", "RightFoot"]
    .map((n) => targetRoot.getObjectByName(n))
    .filter((b): b is THREE.Object3D => Boolean(b));
  if (!feet.length) return;

  // The track is in the hips' own local units and the measurements below are in
  // world units — on these models that is a factor of about 100 (bones are
  // authored in centimetres under a scaled root), so a correction applied
  // without this conversion silently amounts to half a millimetre.
  const hipsBone = targetRoot.getObjectByName("Hips");
  const parentScaleY = hipsBone?.parent
    ? hipsBone.parent.getWorldScale(new THREE.Vector3()).y || 1
    : 1;

  const scratch = new THREE.Vector3();
  const originY = () => targetRoot.getWorldPosition(scratch).y;
  const lowestFoot = () => {
    let min = Infinity;
    for (const foot of feet) min = Math.min(min, foot.getWorldPosition(new THREE.Vector3()).y);
    return min - originY();
  };

  // ground line from the character's own rest pose, before the clip touches it
  targetRoot.updateMatrixWorld(true);
  const ground = lowestFoot();

  const mixer = new THREE.AnimationMixer(targetRoot);
  const action = mixer.clipAction(clip);
  action.play();
  // measure every frame first: editing the track while sampling would feed
  // each correction into the next frame's interpolation
  const lift = new Float32Array(hipsTrack.times.length);
  for (let i = 0; i < hipsTrack.times.length; i++) {
    mixer.setTime(0);
    mixer.setTime(hipsTrack.times[i]);
    targetRoot.updateMatrixWorld(true);
    lift[i] = ground - lowestFoot();
  }
  action.stop();
  mixer.uncacheClip(clip);
  for (let i = 0; i < lift.length; i++) hipsTrack.values[i * 3 + 1] += lift[i] / parentScaleY;
}

/** A snapshot of every bone's local transform. */
export type PoseSnapshot = Map<string, { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3 }>;

export function snapshotPose(root: THREE.Object3D): PoseSnapshot {
  const out: PoseSnapshot = new Map();
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) {
      out.set(o.name, { position: o.position.clone(), quaternion: o.quaternion.clone(), scale: o.scale.clone() });
    }
  });
  return out;
}

function applyPose(root: THREE.Object3D, pose: PoseSnapshot) {
  root.traverse((o) => {
    const saved = pose.get(o.name);
    if (saved) {
      o.position.copy(saved.position);
      o.quaternion.copy(saved.quaternion);
      o.scale.copy(saved.scale);
    }
  });
  root.updateMatrixWorld(true);
}

/** Run fn with the character standing in its reference pose, then put it back.
 *
 *  Both the retarget and the foot planting read the character's rest pose as
 *  their reference, and by the time the donor has downloaded the character is
 *  not in it: the idle is playing and PoseController has pulled the arms down
 *  out of the wide Meshy A-pose. Retargeting against that tilts the whole clip
 *  by the arms-down rotation and plants the feet against a moving floor.
 *
 *  The reference is the pose the character loads in, captured by the renderer
 *  before PoseController touches it — NOT `Skeleton.pose()`. The stored bind
 *  matrices put these rigs a full torso below their standing height, so
 *  planting against them buries the character in the floor. */
function withPose<T>(root: THREE.Object3D, pose: PoseSnapshot | null, fn: () => T): T {
  if (!pose) return fn();
  const current = snapshotPose(root);
  applyPose(root, pose);
  try {
    return fn();
  } finally {
    applyPose(root, current);
  }
}

const donors = new Map<string, Promise<{ scene: THREE.Object3D; clip: THREE.AnimationClip } | null>>();

function loadDonor(file: string) {
  const cached = donors.get(file);
  if (cached) return cached;
  const promise = new GLTFLoader()
    .loadAsync(`${ANIMS}${file}?v=${ANIM_VERSION}`)
    .then((gltf) => {
      const clip = gltf.animations[0];
      if (!clip) return null;
      gltf.scene.updateMatrixWorld(true);
      return { scene: gltf.scene, clip };
    })
    .catch((error) => {
      console.error(`Failed to load attack donor ${file}`, error);
      return null;
    });
  donors.set(file, promise);
  return promise;
}

export interface ClassAttack {
  clip: THREE.AnimationClip;
  /** phase (0..1 of the attack window) -> clip time in seconds. */
  timeAt(phase: number): number;
}

/** Loads the class's attack, retargeted onto this character's skeleton. */
export async function loadClassAttack(
  targetRoot: THREE.Object3D,
  style: ClassCombatStyle,
  reference: PoseSnapshot | null = null,
  /** The pose the free arm and head should hold — the character idle. Defaults
   *  to the reference when the caller has no separate idle (the animation room). */
  hold: PoseSnapshot | null = null,
): Promise<ClassAttack | null> {
  const def = ACTIONS[style];
  if (!def) return null;
  const donor = await loadDonor(def.file);
  if (!donor) return null;
  targetRoot.updateMatrixWorld(true);
  // Keep the hips track, then flatten it horizontally.
  //
  // Dropping it outright looks broken: these actions crouch and lunge, so the
  // legs fold while the pelvis stays pinned at bind height and the feet ride up
  // off the floor — measured in the metro at 0.5 torso lengths, which reads as a
  // hunched, half-sitting character. The vertical component has to stay. What
  // has to go is the travel (the slash alone drifts 14 units sideways in donor
  // space), because the sim owns where the character actually is.
  const retargeted = withPose(targetRoot, reference, () =>
    retargetAnimationClip(targetRoot, donor.scene, donor.clip, "Attack", {
      transferHipsPosition: true,
    }));
  if (!retargeted) return null;
  const hips = retargeted.tracks.find((t) => t.name === "Hips.position");
  if (hips) {
    const v = hips.values;
    const x = v[0];
    const z = v[2];
    for (let i = 0; i < v.length; i += 3) { v[i] = x; v[i + 2] = z; }
  }
  const clip = trimClip(retargeted, def.trim[0], def.trim[1]);
  dampStance(clip, reference);
  removeBodyYaw(clip, reference);
  withPose(targetRoot, reference, () => pinBones(targetRoot, clip, reference, hold));
  withPose(targetRoot, reference, () => plantFeet(targetRoot, clip));
  const duration = clip.duration;
  const warp = def.warp;
  return {
    clip,
    timeAt: (phase: number) => THREE.MathUtils.clamp(phase, 0, 1) ** warp * duration,
  };
}

export const attackSourceFor = (style: ClassCombatStyle) => ACTIONS[style]?.source ?? null;
