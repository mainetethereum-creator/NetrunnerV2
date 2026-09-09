// One-handed sword slash, generated from whatever skeleton the character has.
//
// Replaces the earlier two-handed generator, which drove only eight bones
// (hips, spine, four arm bones) and derived the blade direction from the
// vector between the two wrists. That made the legs stand still through the
// whole swing and pointed the blade through the body at impact.
//
// This one animates the whole body — hips, spine, both arms, the wrist, and
// both legs — as a right-handed diagonal cut: weight back and torso coiled
// right on the wind-up, then hips and shoulders unwind left while the blade
// sweeps down across the target and the weight lands on the front foot.
//
// Poses are written as rotations about axes MEASURED FROM THE RIG (shoulder
// to shoulder, hips to head) rather than about model-space X/Y/Z, so the same
// numbers read correctly on rigs built with different axis conventions.

import * as THREE from "three";

// Front-loaded on purpose: the sim applies damage the instant the swing starts,
// so the blade has to arrive early or the number pops before the cut lands.
// Impact (column 4) sits at 26% of the clip — about 97 ms into a base 0.38 s
// attack window — and the rest of the time is recovery.
const TIMES = new Float32Array([0, 0.06, 0.13, 0.19, 0.23, 0.45, 0.90]);

/** [about the character's right axis, about up, about forward] in radians.
 *
 *  Signs, measured from the rig rather than assumed (the model faces -forward,
 *  its toes sit at forward -0.24):
 *    pitch  + leans back / swings a hanging limb forward
 *    yaw    + brings the RIGHT shoulder forward
 *    roll   + raises the right side
 *
 *  Rows are relative: a bone's row is applied on top of its animated parent,
 *  so [0,0,0] means "follow the parent" and the spine shares accumulate. */
export type Pose = readonly [number, number, number];

export type SwordMount = {
  hand: "right" | "left";
  /** Offset from the measured fist centre, in world centimetres. */
  position: [number, number, number];
  /** Local hand-space Euler angles, in degrees. */
  rotation: [number, number, number];
  scale: number;
};

export const TWO_HANDED_SWORD_MOUNT_STORAGE_KEY = "cyberbase:neon-sentinel:sword-mount";

export function copySwordMount(mount: SwordMount): SwordMount {
  return {
    hand: mount.hand,
    position: [...mount.position],
    rotation: [...mount.rotation],
    scale: mount.scale,
  };
}

export function isSwordMount(value: unknown): value is SwordMount {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  const vector = (item: unknown) => Array.isArray(item)
    && item.length === 3
    && item.every((component) => typeof component === "number" && Number.isFinite(component));
  return (candidate.hand === "right" || candidate.hand === "left")
    && vector(candidate.position)
    && vector(candidate.rotation)
    && typeof candidate.scale === "number"
    && Number.isFinite(candidate.scale);
}

export const DEFAULT_TWO_HANDED_SWORD_MOUNT: SwordMount = {
  hand: "right",
  position: [0, 0, 0],
  rotation: [0, 0, -180],
  scale: 1,
};

/** One row per bone, one column per keyframe in TIMES.
 *
 *  The right-arm rows are fitted, not guessed: a solver drove the chain to a
 *  target blade path (cocked high behind the right shoulder at 0.22, blade
 *  through the target at 0.34-0.46, low and across to the left at 0.62) with
 *  the elbow limited to flexing one way and penalised against the shoulder, so
 *  the cut is thrown from the shoulder instead of flicked from the elbow. The
 *  earlier table had the torso twisting the wrong way — it pulled the right
 *  shoulder back at impact, which is why the strike under-reached the wind-up.
 *  The sword hand now travels: hips-relative height -0.10 rest, +0.61 cocked,
 *  +0.07 at impact, and forward reach -0.54 (vs -0.05 before). */
const POSES: Record<string, readonly Pose[]> = {
  // hips lead the coil and the weight transfer
  Hips: [[0, 0, 0], [0.02, -0.06, -0.01], [0.05, -0.12, -0.02], [-0.04, 0.10, 0.02], [-0.07, 0.16, 0.04], [-0.02, 0.06, 0.01], [0, 0, 0]],

  // spine adds most of the twist; split evenly over however many spine bones
  // the rig has (see SPINE_CHAIN) and accumulated up the chain
  spine: [[0, 0, 0], [0.04, -0.20, -0.02], [0.08, -0.42, -0.04], [-0.06, 0.34, 0.05], [-0.12, 0.56, 0.08], [-0.03, 0.18, 0.02], [0, 0, 0]],


  // sword arm: cocks up behind the shoulder, then cuts down across the body
  RightShoulder: [[0, 0, 0], [0.18, -0.18, -0.18], [0.18, -0.18, -0.16], [-0.18, -0.18, -0.18], [-0.09, -0.08, -0.18], [-0.05, 0.02, -0.18], [0, 0, 0]],
  RightArm: [[0, 0, 0], [0.49, -0.91, 0.12], [0.52, -0.78, 0.12], [0.04, -0.59, 0.20], [0.02, -0.29, 0.10], [0, -0.08, 0.04], [0, 0, 0]],
  RightForeArm: [[0, 0, 0], [1.67, -0.35, 0.20], [2.00, -0.14, -0.07], [1.47, 0.06, -0.20], [0.98, 0.13, -0.20], [0.42, 0.11, -0.18], [0, 0, 0]],
  // wrist: cocked back on the wind-up, snapped through on the cut. Cosmetic —
  // the blade follows the forearm-to-hand line, which the wrist does not move.
  RightHand: [[0, 0, 0], [-0.12, 0, 0], [-0.22, 0, 0], [0.10, 0, 0], [0.22, 0, 0], [0.08, 0, 0], [0, 0, 0]],

  // The free arm and the head are deliberately absent: the strike is thrown
  // with the right arm alone, and the rows that swung the left arm dragged it
  // through the coat. See FROZEN in class-actions.ts, same rule for the Meshy
  // clips.
  // orthodox stance: weight loads on the back (right) leg through the wind-up
  // and lands on the front (left) foot as the blade arrives
  RightUpLeg: [[0, 0, 0], [-0.10, 0, 0], [-0.16, 0, 0], [-0.21, 0, 0], [-0.26, 0, 0], [-0.10, 0, 0], [0, 0, 0]],
  RightLeg: [[0, 0, 0], [-0.16, 0, 0], [-0.26, 0, 0], [-0.18, 0, 0], [-0.10, 0, 0], [-0.08, 0, 0], [0, 0, 0]],
  LeftUpLeg: [[0, 0, 0], [0.12, 0, 0], [0.18, 0, 0], [0.28, 0, 0], [0.38, 0, 0], [0.16, 0, 0], [0, 0, 0]],
  LeftLeg: [[0, 0, 0], [-0.08, 0, 0], [-0.12, 0, 0], [-0.20, 0, 0], [-0.28, 0, 0], [-0.12, 0, 0], [0, 0, 0]],
};

/** Both spine naming conventions in this project, hips-end first. */
const SPINE_CHAIN = ["Spine02", "Spine01", "Spine", "Spine1", "Spine2"];

function firstSkin(root: THREE.Object3D): THREE.SkinnedMesh | null {
  let found: THREE.SkinnedMesh | null = null;
  root.traverse((o) => {
    if (!found && (o as THREE.SkinnedMesh).isSkinnedMesh) found = o as THREE.SkinnedMesh;
  });
  return found;
}

/** Axes taken from the rig, so the poses above are rig-convention agnostic. */
function bodyAxes(bones: Map<string, THREE.Bone>) {
  const world = (n: string) => bones.get(n)?.getWorldPosition(new THREE.Vector3()) ?? null;
  const hips = world("Hips");
  const head = world("Head") ?? world("neck");
  const rs = world("RightShoulder") ?? world("RightArm");
  const ls = world("LeftShoulder") ?? world("LeftArm");
  const up = hips && head ? head.clone().sub(hips).normalize() : new THREE.Vector3(0, 1, 0);
  const right = rs && ls ? rs.clone().sub(ls).normalize() : new THREE.Vector3(1, 0, 0);
  // re-orthogonalise: shoulders are rarely exactly perpendicular to the spine
  right.addScaledVector(up, -right.dot(up)).normalize();
  const forward = new THREE.Vector3().crossVectors(right, up).normalize();
  return { up, right, forward };
}

/** Builds a clip from a pose table like POSES above. Shared with the other
 *  class attacks (class-attacks.ts) — they differ only in their tables, not in
 *  how a table becomes bone rotations. */
export function buildPoseClip(
  targetRoot: THREE.Object3D,
  name: string,
  TIMES: Float32Array,
  POSES: Record<string, readonly Pose[]>,
): THREE.AnimationClip | null {
  const skin = firstSkin(targetRoot);
  if (!skin) return null;
  targetRoot.updateMatrixWorld(true);

  const bones = new Map(skin.skeleton.bones.map((b) => [b.name, b]));
  const { up, right, forward } = bodyAxes(bones);

  const spine = SPINE_CHAIN.filter((n) => bones.has(n));
  const share = spine.length ? 1 / spine.length : 1;

  // resolve every row of POSES onto bones this rig actually has
  const rows = new Map<string, readonly Pose[]>();
  for (const [name, pose] of Object.entries(POSES)) {
    if (name === "spine") {
      for (const s of spine) {
        rows.set(s, pose.map((p) => [p[0] * share, p[1] * share, p[2] * share] as const));
      }
    } else if (bones.has(name)) {
      rows.set(name, pose);
    }
  }
  if (!rows.size) return null;

  const restWorld = new Map(
    skin.skeleton.bones.map((b) => [b.name, b.getWorldQuaternion(new THREE.Quaternion())]),
  );
  const values = new Map([...rows.keys()].map((n) => [n, new Float32Array(TIMES.length * 4)]));

  const q = new THREE.Quaternion();
  const tmp = new THREE.Quaternion();

  for (let frame = 0; frame < TIMES.length; frame++) {
    // Rows chain: a bone's rotation is its own row applied on top of whatever
    // its parent is already doing. So the spine shares add up into one full
    // twist, the shoulders ride the torso, and a row of zeros means "just
    // follow the parent" instead of "stay pinned to the bind pose" — which is
    // what made the elbow fight the shoulder in the first version.
    const deltas = new Map<string, THREE.Quaternion>();
    const deltaOf = (bone: THREE.Bone): THREE.Quaternion => {
      const cached = deltas.get(bone.name);
      if (cached) return cached;
      const parent = bone.parent;
      const parentDelta = parent && (parent as THREE.Bone).isBone && bones.has(parent.name)
        ? deltaOf(parent as THREE.Bone)
        : new THREE.Quaternion();
      const pose = rows.get(bone.name)?.[frame];
      let delta = parentDelta;
      if (pose) {
        const [pitch, yaw, roll] = pose;
        // rotation about the measured body axes, applied yaw→pitch→roll
        q.setFromAxisAngle(up, yaw);
        q.multiply(tmp.setFromAxisAngle(right, pitch));
        q.multiply(tmp.setFromAxisAngle(forward, roll));
        delta = parentDelta.clone().multiply(q).normalize();
      }
      deltas.set(bone.name, delta);
      return delta;
    };

    for (const bone of skin.skeleton.bones) {
      const slot = values.get(bone.name);
      if (!slot) continue;
      const rest = restWorld.get(bone.name);
      if (!rest) continue;
      const desired = deltaOf(bone).clone().multiply(rest).normalize();
      const parent = bone.parent;
      const parentWorld = parent && (parent as THREE.Bone).isBone && restWorld.has(parent.name)
        ? deltaOf(parent as THREE.Bone).clone().multiply(restWorld.get(parent.name)!)
        : parent?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion();
      parentWorld.invert().multiply(desired).normalize().toArray(slot, frame * 4);
    }
  }

  const tracks = [...values].map(
    ([name, v]) => new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, TIMES, v),
  );
  return new THREE.AnimationClip(name, TIMES[TIMES.length - 1], tracks);
}

export function createOneHandedSlashClip(targetRoot: THREE.Object3D): THREE.AnimationClip | null {
  return buildPoseClip(targetRoot, "Attack", TIMES, POSES);
}

/** The shipped sword art. `01-up` is the blade pointing up with the handle at
 *  the bottom, which is the orientation the quad below is built for — verified
 *  from the pixels, the crossguard sits 70% of the way down the image. */
const SWORD_SPRITE = "/game/weapons/sword/01-up.webp";
/** Where the fist closes on the sprite, measured from the top.
 *
 *  Read off the pixels: the crossguard is the widest row at 70%, and below it
 *  the handle runs as an even band to the pommel at 100%. A hand grips right
 *  under the guard with the pommel showing below the fist, so the fist centre
 *  is ~79% — not the middle of the handle, which left the character holding the
 *  blade with the whole grip above the glove. */
const SWORD_GRIP = 0.79;
/** Blade length as a fraction of the torso, so it scales with the character. */
const SWORD_LENGTH = 1.5;

let swordTexture: THREE.Texture | null = null;

function rigObject(root: THREE.Object3D, name: string): THREE.Object3D | null {
  const exact = root.getObjectByName(name);
  if (exact) return exact;
  const wanted = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  let found: THREE.Object3D | null = null;
  root.traverse((object) => {
    if (found) return;
    const canonical = object.name
      .toLowerCase()
      .replace(/^mixamorig:?/, "")
      .replace(/[^a-z0-9]/g, "");
    if (canonical === wanted) found = object;
  });
  return found;
}

/** The character's sword: the painted blade on a quad in the right hand.
 *
 *  A sprite rather than modelled geometry because that is what the art is —
 *  8 renders of one blade — and at 60 px tall on screen a painted sword reads
 *  better than anything buildable from boxes. The quad spins about its own
 *  length so it always presents its face to the camera; without that it goes
 *  edge-on and vanishes every time the character turns side-on. */
export function createOneHandedSword(targetRoot: THREE.Object3D) {
  const hand = rigObject(targetRoot, "RightHand");
  const hips = rigObject(targetRoot, "Hips");
  const head = rigObject(targetRoot, "Head");
  if (!hand || !hips || !head) return null;

  targetRoot.updateMatrixWorld(true);
  const unit = Math.max(
    0.25,
    hips.getWorldPosition(new THREE.Vector3()).distanceTo(head.getWorldPosition(new THREE.Vector3())),
  );
  const group = new THREE.Group();
  group.name = "GeneratedOneHandedSword";

  if (!swordTexture) {
    swordTexture = new THREE.TextureLoader().load(SWORD_SPRITE);
    swordTexture.colorSpace = THREE.SRGBColorSpace;
    swordTexture.anisotropy = 4;
  }
  // Unlit on purpose: the render already carries its own lighting, and the
  // scene lights would double it.
  const material = new THREE.MeshBasicMaterial({
    map: swordTexture, transparent: true, alphaTest: 0.05,
    side: THREE.DoubleSide, toneMapped: false, depthWrite: false,
  });

  const height = unit * SWORD_LENGTH;
  const width = height * (124 / 512); // sprite aspect
  const blade = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  // slide the quad so the grip band, not the middle of the image, is at the hand
  blade.position.y = height * (SWORD_GRIP - 0.5);
  group.add(blade);
  gripToHand(group, hand, targetRoot);

  const cameraLocal = new THREE.Vector3();
  return {
    group,
    setVisible(v: boolean) { group.visible = v; },
    /** Turn the quad about the blade axis to face the camera. */
    update(_dt?: number, _attacking?: boolean, camera?: THREE.Object3D) {
      if (!group.visible || !camera || !group.parent) return;
      group.parent.updateWorldMatrix(true, false);
      group.parent.worldToLocal(cameraLocal.copy(camera.position));
      cameraLocal.sub(group.position);
      group.rotation.set(0, Math.atan2(cameraLocal.x, cameraLocal.z), 0);
    },
    dispose() {
      group.parent?.remove(group);
      blade.geometry.dispose();
      material.dispose();
    },
  };
}

/** A real 3D greatsword mounted for Mixamo's two-handed clips.
 *
 * Mixamo authors the weapon transform on the RIGHT hand. The left hand is
 * animated to meet a sufficiently long handle, but the line between the two
 * wrist bone origins is not the handle axis (the palms bend around the grip).
 * Therefore the sword inherits the right-hand quaternion exactly like the
 * original animation expects; its long grip passes through the left palm.
 */
export function createTwoHandedGreatSword(
  targetRoot: THREE.Object3D,
  importedSword: THREE.Object3D | null = null,
) {
  const rightHand = rigObject(targetRoot, "RightHand");
  const leftHand = rigObject(targetRoot, "LeftHand");
  const hips = rigObject(targetRoot, "Hips");
  const head = rigObject(targetRoot, "Head");
  if (!rightHand || !leftHand || !hips || !head) return null;

  targetRoot.updateMatrixWorld(true);
  const unit = Math.max(
    0.25,
    hips.getWorldPosition(new THREE.Vector3()).distanceTo(head.getWorldPosition(new THREE.Vector3())),
  );

  if (importedSword) {
    const group = new THREE.Group();
    group.name = "ImportedTwoHandedGreatSword";
    targetRoot.add(group);

    // The extraction script normalizes the original Ronin weapon to 1.82
    // torso units, points it along +Y, and places its origin inside the grip.
    // Runtime only has to scale that normalized asset to this character.
    importedSword.position.set(0, 0, 0);
    importedSword.quaternion.identity();
    importedSword.scale.setScalar(unit);
    importedSword.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of sourceMaterials) {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.emissiveIntensity = 1.35;
          material.envMapIntensity = 1.2;
        }
      }
    });
    group.add(importedSword);

    return mountTwoHandedSword(targetRoot, rightHand, leftHand, group, () => {
      disposeObject3D(importedSword);
    });
  }

  const handleLength = unit * 0.34;
  const bladeLength = unit * 1.48;
  const bladeWidth = unit * 0.15;
  const bladeThickness = unit * 0.025;
  const guardWidth = unit * 0.46;

  const bladeMaterial = new THREE.MeshStandardMaterial({
    color: 0xaec7cf,
    emissive: 0x0a171c,
    emissiveIntensity: 0.45,
    metalness: 0.58,
    roughness: 0.22,
  });
  const edgeMaterial = new THREE.MeshStandardMaterial({
    color: 0xe4f8ff,
    emissive: 0x17282d,
    emissiveIntensity: 0.35,
    metalness: 0.5,
    roughness: 0.12,
  });
  const darkMetal = new THREE.MeshStandardMaterial({
    color: 0x17232a,
    metalness: 0.88,
    roughness: 0.3,
  });
  const gripMaterial = new THREE.MeshStandardMaterial({
    color: 0x101316,
    metalness: 0.25,
    roughness: 0.82,
  });
  const neonMaterial = new THREE.MeshBasicMaterial({
    color: 0x39f4ee,
    toneMapped: false,
  });
  const materials = [bladeMaterial, edgeMaterial, darkMetal, gripMaterial, neonMaterial];
  const geometries: THREE.BufferGeometry[] = [];
  const group = new THREE.Group();
  group.name = "GeneratedTwoHandedGreatSword";
  targetRoot.add(group);

  const add = <T extends THREE.BufferGeometry>(geometry: T, material: THREE.Material) => {
    geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);
    return mesh;
  };

  // The right hand sits at local Y=0. Mixamo places the left hand farther
  // along this grip; guard and blade continue in the same authored direction.
  const grip = add(
    new THREE.CylinderGeometry(unit * 0.035, unit * 0.039, handleLength, 12),
    gripMaterial,
  );
  grip.position.y = handleLength * 0.43;

  for (let ring = 0; ring < 5; ring++) {
    const wrap = add(
      new THREE.TorusGeometry(unit * 0.041, unit * 0.006, 6, 12),
      darkMetal,
    );
    wrap.rotation.x = Math.PI / 2;
    wrap.position.y = handleLength * (0.08 + ring * 0.17);
  }

  const pommel = add(new THREE.OctahedronGeometry(unit * 0.068, 0), darkMetal);
  pommel.position.y = -unit * 0.075;
  const pommelCore = add(new THREE.OctahedronGeometry(unit * 0.035, 0), neonMaterial);
  pommelCore.position.copy(pommel.position);

  const guardY = handleLength * 0.92;
  const guard = add(
    new THREE.BoxGeometry(guardWidth, unit * 0.055, unit * 0.085),
    darkMetal,
  );
  guard.position.y = guardY;
  const guardCore = add(
    new THREE.BoxGeometry(unit * 0.13, unit * 0.072, unit * 0.1),
    neonMaterial,
  );
  guardCore.position.y = guardY;

  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-bladeWidth * 0.42, 0);
  bladeShape.lineTo(-bladeWidth * 0.5, bladeLength * 0.1);
  bladeShape.lineTo(-bladeWidth * 0.34, bladeLength * 0.86);
  bladeShape.lineTo(0, bladeLength);
  bladeShape.lineTo(bladeWidth * 0.34, bladeLength * 0.86);
  bladeShape.lineTo(bladeWidth * 0.5, bladeLength * 0.1);
  bladeShape.lineTo(bladeWidth * 0.42, 0);
  bladeShape.closePath();
  const bladeGeometry = new THREE.ExtrudeGeometry(bladeShape, {
    depth: bladeThickness,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: unit * 0.008,
    bevelThickness: unit * 0.006,
  });
  bladeGeometry.translate(0, 0, -bladeThickness / 2);
  const blade = add(bladeGeometry, bladeMaterial);
  blade.position.y = guardY + unit * 0.045;

  // Raised central fuller gives the blade depth and keeps the neon character
  // language without relying on a flat billboard texture.
  const fuller = add(
    new THREE.BoxGeometry(unit * 0.05, bladeLength * 0.72, bladeThickness * 1.8),
    neonMaterial,
  );
  fuller.position.y = guardY + bladeLength * 0.43;
  const edgeLeft = add(
    new THREE.BoxGeometry(unit * 0.018, bladeLength * 0.76, bladeThickness * 1.45),
    edgeMaterial,
  );
  edgeLeft.position.set(-bladeWidth * 0.4, guardY + bladeLength * 0.43, 0);
  edgeLeft.rotation.z = -0.012;
  const edgeRight = add(
    new THREE.BoxGeometry(unit * 0.018, bladeLength * 0.76, bladeThickness * 1.45),
    edgeMaterial,
  );
  edgeRight.position.set(bladeWidth * 0.4, guardY + bladeLength * 0.43, 0);
  edgeRight.rotation.z = 0.012;

  return mountTwoHandedSword(targetRoot, rightHand, leftHand, group, () => {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
  });
}

function mountTwoHandedSword(
  targetRoot: THREE.Object3D,
  rightHand: THREE.Object3D,
  leftHand: THREE.Object3D,
  group: THREE.Group,
  disposeContents: () => void,
) {
  // Both gloves have no finger chain in the selected lightweight Mixamo LOD,
  // so bake a closed grip once before measuring their centres.
  closeFist(targetRoot, rightHand);
  closeFist(targetRoot, leftHand);

  const handScale = new THREE.Vector3();
  const euler = new THREE.Euler();
  const baseGrip = new THREE.Vector3();
  const offset = new THREE.Vector3();
  const setMount = (mount: SwordMount) => {
    const hand = mount.hand === "left" ? leftHand : rightHand;
    hand.updateWorldMatrix(true, false);
    hand.getWorldScale(handScale);
    if (group.parent !== hand) hand.add(group);
    group.scale.set(
      mount.scale / (handScale.x || 1),
      mount.scale / (handScale.y || 1),
      mount.scale / (handScale.z || 1),
    );
    baseGrip.copy(fistCentre(targetRoot, hand));
    offset.set(
      mount.position[0] / 100 / (handScale.x || 1),
      mount.position[1] / 100 / (handScale.y || 1),
      mount.position[2] / 100 / (handScale.z || 1),
    );
    group.position.copy(baseGrip).add(offset);
    euler.set(
      THREE.MathUtils.degToRad(mount.rotation[0]),
      THREE.MathUtils.degToRad(mount.rotation[1]),
      THREE.MathUtils.degToRad(mount.rotation[2]),
      "XYZ",
    );
    group.quaternion.setFromEuler(euler);
  };
  setMount(DEFAULT_TWO_HANDED_SWORD_MOUNT);

  return {
    group,
    setVisible(v: boolean) { group.visible = v; },
    setMount,
    update() { /* the hand bone supplies the complete weapon transform */ },
    dispose() {
      group.parent?.remove(group);
      disposeContents();
    },
  };
}

function disposeObject3D(root: THREE.Object3D) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    mesh.geometry?.dispose();
    const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of sourceMaterials) {
      if (!material) continue;
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) value.dispose();
      }
      material.dispose();
    }
  });
}

/** Put a weapon IN the hand instead of near it.
 *
 *  The first version parented the blade to the model root and re-placed it each
 *  frame at the hand's position, pointing it along the forearm-to-hand line.
 *  That follows the arm but ignores the hand itself, so the fist never actually
 *  holds anything: the wrist rotates and the grip does not, and any pose where
 *  the forearm line is not the blade line reads as a sword floating past the
 *  palm.
 *
 *  Parenting to the bone fixes it — the weapon then inherits every wrist
 *  rotation for free. Two things have to be handled:
 *
 *  - **Scale.** These rigs are authored in centimetres under a scaled root, so
 *    a bone's world scale is ~100. Geometry sized in world metres has to be
 *    divided by that or the sword lands the size of a building.
 *  - **Axis.** Meshy bones point +Y down the limb, and the blade is modelled
 *    along +Y, so the grip needs only a small offset into the palm.
 */
export function gripToHand(group: THREE.Object3D, hand: THREE.Object3D, root: THREE.Object3D) {
  // a hand that holds something should look like it is holding something
  closeFist(root, hand);
  hand.updateWorldMatrix(true, false);
  const scale = hand.getWorldScale(new THREE.Vector3());
  hand.add(group);
  group.scale.set(1 / (scale.x || 1), 1 / (scale.y || 1), 1 / (scale.z || 1));
  // The bone's origin is the WRIST, so a weapon placed at it hangs off the
  // heel of the hand rather than sitting in the fist. Put it at the middle of
  // the hand instead, measured from the mesh — no guessed offset, and it lands
  // correctly on characters whose hands are different sizes.
  //
  // Note the units: group.position is in the hand bone's own space (these rigs
  // are authored in centimetres, so the bone's world scale is ~100), while the
  // group's CHILDREN are in metres because of the scale correction above. An
  // offset in metres written straight onto group.position comes out a hundred
  // times too small — it was silently doing nothing before this.
  group.position.copy(fistCentre(root, hand));
  // Turn the handle across the fist. The bone runs +Y down the limb, so an
  // unrotated weapon extends the ARM — which is why the blade sat pointing up
  // through the whole swing and read as waving a stick, rather than cutting.
  // A real grip runs across the palm; +90 about Z is the mount that makes the
  // measured blade path finish down and forward, the way a cut does.
  group.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
}

/** Curl the open hand into a fist, once, in the mesh.
 *
 *  These rigs have no finger bones — `RightHand` is the last joint in the arm —
 *  so a grip cannot be posed. The hands are modelled open, which is why a
 *  weapon sitting in one reads as floating next to a flat palm.
 *
 *  So the fingers are folded in the geometry instead: vertices past the
 *  knuckles are drawn toward the middle of the hand, by an amount that ramps up
 *  along the finger, leaving the palm and wrist alone. It is baked at load and
 *  never animated, which suits a character that is always carrying its weapon.
 */
export function closeFist(root: THREE.Object3D, hand: THREE.Object3D, amount = 0.72) {
  const skin = firstSkin(root);
  if (!skin) return;
  const index = skin.skeleton.bones.indexOf(hand as THREE.Bone);
  if (index < 0) return;

  const position = skin.geometry.getAttribute("position") as THREE.BufferAttribute;
  const skinIndex = skin.geometry.getAttribute("skinIndex");
  const skinWeight = skin.geometry.getAttribute("skinWeight");
  if (!position || !skinIndex || !skinWeight) return;

  const toBone = skin.skeleton.boneInverses[index];
  const toMesh = toBone.clone().invert();
  const owned: number[] = [];
  const local = new THREE.Vector3();
  let reach = 0;
  for (let v = 0; v < position.count; v++) {
    let weight = 0;
    for (let s = 0; s < 4; s++) {
      if (skinIndex.getComponent(v, s) === index) weight += skinWeight.getComponent(v, s);
    }
    if (weight < 0.6) continue;
    owned.push(v);
    local.fromBufferAttribute(position, v).applyMatrix4(toBone);
    reach = Math.max(reach, local.y); // bones run +Y down the limb
  }
  if (owned.length < 20 || reach <= 0) return;

  // knuckles start a bit past halfway down the hand; everything beyond that is
  // finger and gets folded
  const knuckle = reach * 0.45;
  const centre = new THREE.Vector3(0, reach * 0.55, 0);
  const target = new THREE.Vector3();
  for (const v of owned) {
    local.fromBufferAttribute(position, v).applyMatrix4(toBone);
    if (local.y <= knuckle) continue;
    const t = Math.min(1, (local.y - knuckle) / (reach - knuckle)) ** 1.15;
    target.copy(centre);
    local.lerp(target, amount * t);
    position.setXYZ(v, ...local.applyMatrix4(toMesh).toArray());
  }
  position.needsUpdate = true;
  skin.geometry.computeBoundingSphere();
}

/** Middle of the hand, in the hand bone's local space.
 *
 *  Taken from the skin: the vertices the hand bone actually owns. Falls back to
 *  the bone origin if the mesh cannot be read. */
function fistCentre(root: THREE.Object3D, hand: THREE.Object3D): THREE.Vector3 {
  const centre = new THREE.Vector3();
  const skin = firstSkin(root);
  if (!skin) return centre;
  const index = skin.skeleton.bones.indexOf(hand as THREE.Bone);
  if (index < 0) return centre;

  const position = skin.geometry.getAttribute("position");
  const skinIndex = skin.geometry.getAttribute("skinIndex");
  const skinWeight = skin.geometry.getAttribute("skinWeight");
  if (!position || !skinIndex || !skinWeight) return centre;

  const vertex = new THREE.Vector3();
  let count = 0;
  for (let v = 0; v < position.count; v++) {
    let weight = 0;
    for (let s = 0; s < 4; s++) {
      if (skinIndex.getComponent(v, s) === index) weight += skinWeight.getComponent(v, s);
    }
    if (weight < 0.6) continue;
    centre.add(vertex.fromBufferAttribute(position, v));
    count++;
  }
  if (!count) return centre.set(0, 0, 0);
  centre.divideScalar(count);
  // mesh bind space -> hand bone space
  return centre.applyMatrix4(skin.skeleton.boneInverses[index]);
}
