import * as THREE from "three";

const firstSkin = (root: THREE.Object3D) => {
  const skins: THREE.SkinnedMesh[] = [];
  root.traverse((object) => {
    if ((object as THREE.SkinnedMesh).isSkinnedMesh) skins.push(object as THREE.SkinnedMesh);
  });
  return skins[0] ?? null;
};

const bone = (skin: THREE.SkinnedMesh, name: string) =>
  skin.skeleton.bones.find((item) => item.name === name) ?? null;

/** Retarget a run clip from another Meshy character onto the target skeleton.
 * Bone names are shared, but the bind rotations and limb lengths are not, so
 * copying the source tracks directly would twist Ronin's arms and legs. */
export function retargetAnimationClip(
  targetRoot: THREE.Object3D,
  sourceRoot: THREE.Object3D,
  sourceClip: THREE.AnimationClip,
  outputName: string,
  options: {
    bones?: ReadonlySet<string>;
    lockSourceBones?: readonly string[];
    transferHipsPosition?: boolean;
  } = {},
) {
  const target = firstSkin(targetRoot);
  const source = firstSkin(sourceRoot);
  if (!target || !source) return null;

  targetRoot.updateMatrixWorld(true);
  sourceRoot.updateMatrixWorld(true);

  const targetHips = bone(target, "Hips");
  const targetHead = bone(target, "Head");
  const sourceHips = bone(source, "Hips");
  const sourceHead = bone(source, "Head");
  let scale = 1;
  if (targetHips && targetHead && sourceHips && sourceHead) {
    const targetHeight = targetHips.getWorldPosition(new THREE.Vector3())
      .distanceTo(targetHead.getWorldPosition(new THREE.Vector3()));
    const sourceHeight = sourceHips.getWorldPosition(new THREE.Vector3())
      .distanceTo(sourceHead.getWorldPosition(new THREE.Vector3()));
    if (sourceHeight > 0.0001) scale = targetHeight / sourceHeight;
  }

  const sourceBones = new Map(source.skeleton.bones.map((item) => [item.name, item]));
  const shared = target.skeleton.bones.filter((item) =>
    sourceBones.has(item.name) && (!options.bones || options.bones.has(item.name)),
  );
  const sourceRestWorld = new Map<string, THREE.Quaternion>();
  const targetRestWorld = new Map<string, THREE.Quaternion>();
  for (const targetBone of shared) {
    sourceRestWorld.set(targetBone.name, sourceBones.get(targetBone.name)!.getWorldQuaternion(new THREE.Quaternion()));
    targetRestWorld.set(targetBone.name, targetBone.getWorldQuaternion(new THREE.Quaternion()));
  }

  const frameCount = Math.max(2, ...sourceClip.tracks.map((track) => track.times.length));
  const times = new Float32Array(frameCount);
  const rotations = new Map(shared.map((item) => [item.name, new Float32Array(frameCount * 4)]));
  const hipsPositions = new Float32Array(frameCount * 3);
  const targetHipsRest = targetHips?.position.clone() ?? new THREE.Vector3();
  const sourceHipsRest = sourceHips?.position.clone() ?? new THREE.Vector3();
  const lockedSourceRest = new Map((options.lockSourceBones ?? []).flatMap((name) => {
    const item = sourceBones.get(name);
    return item ? [[name, {
      position: item.position.clone(),
      quaternion: item.quaternion.clone(),
      scale: item.scale.clone(),
    }] as const] : [];
  }));
  const mixer = new THREE.AnimationMixer(sourceRoot);
  const action = mixer.clipAction(sourceClip);
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();

  for (let frame = 0; frame < frameCount; frame++) {
    const time = frame * sourceClip.duration / (frameCount - 1);
    times[frame] = time;
    mixer.setTime(time);
    for (const [name, rest] of lockedSourceRest) {
      const item = sourceBones.get(name)!;
      item.position.copy(rest.position);
      item.quaternion.copy(rest.quaternion);
      item.scale.copy(rest.scale);
    }
    sourceRoot.updateMatrixWorld(true);
    const animatedWorld = new Map<string, THREE.Quaternion>();

    const solve = (targetBone: THREE.Bone): THREE.Quaternion => {
      const cached = animatedWorld.get(targetBone.name);
      if (cached) return cached;
      const sourceBone = sourceBones.get(targetBone.name)!;
      const sourceRest = sourceRestWorld.get(targetBone.name)!;
      const targetRest = targetRestWorld.get(targetBone.name)!;
      const sourceNow = sourceBone.getWorldQuaternion(new THREE.Quaternion());
      const worldDelta = sourceNow.multiply(sourceRest.clone().invert());
      const desiredWorld = worldDelta.multiply(targetRest).normalize();
      const parent = targetBone.parent;
      const parentWorld = parent && (parent as THREE.Bone).isBone && rotations.has(parent.name)
        ? solve(parent as THREE.Bone)
        : parent?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion();
      const local = parentWorld.clone().invert().multiply(desiredWorld).normalize();
      local.toArray(rotations.get(targetBone.name)!, frame * 4);
      animatedWorld.set(targetBone.name, desiredWorld);
      return desiredWorld;
    };

    for (const targetBone of shared) solve(targetBone);
    const sourceHipsNow = sourceHips?.position ?? sourceHipsRest;
    hipsPositions[frame * 3] = targetHipsRest.x + (sourceHipsNow.x - sourceHipsRest.x) * scale;
    hipsPositions[frame * 3 + 1] = targetHipsRest.y + (sourceHipsNow.y - sourceHipsRest.y) * scale;
    hipsPositions[frame * 3 + 2] = targetHipsRest.z + (sourceHipsNow.z - sourceHipsRest.z) * scale;
  }
  mixer.stopAllAction();

  const tracks: THREE.KeyframeTrack[] = shared.map((item) =>
    new THREE.QuaternionKeyframeTrack(`${item.name}.quaternion`, times, rotations.get(item.name)!),
  );
  if (targetHips && sourceHips && rotations.has("Hips") && options.transferHipsPosition !== false) {
    tracks.push(new THREE.VectorKeyframeTrack("Hips.position", times, hipsPositions));
  }
  return new THREE.AnimationClip(outputName, sourceClip.duration, tracks);
}

export const retargetRunClip = (
  targetRoot: THREE.Object3D,
  sourceRoot: THREE.Object3D,
  sourceClip: THREE.AnimationClip,
) => retargetAnimationClip(targetRoot, sourceRoot, sourceClip, "Run");
