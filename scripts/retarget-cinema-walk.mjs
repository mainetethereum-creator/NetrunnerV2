import fs from 'node:fs';
import * as T from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

// Downloaded through Mixamo: Unarmed Walk Forward, 30 fps, no skin, no reduction.
const input = fs.readFileSync('output/trailer/mixamo/Unarmed-Walk-Forward.fbx');
const source = new FBXLoader().parse(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength), '');
const glb = fs.readFileSync('public/game/models/mixamo/neon-sentinel-mixamo-test.glb');
const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString());
const nodes = json.nodes.map(node => {
  const object = new T.Object3D(); object.name = T.PropertyBinding.sanitizeNodeName(node.name ?? '');
  if (node.translation) object.position.fromArray(node.translation);
  if (node.rotation) object.quaternion.fromArray(node.rotation);
  if (node.scale) object.scale.fromArray(node.scale);
  return object;
});
json.nodes.forEach((node, i) => node.children?.forEach(child => nodes[i].add(nodes[child])));
const target = new T.Group(); json.scenes[json.scene ?? 0].nodes.forEach(i => target.add(nodes[i]));
source.updateMatrixWorld(true); target.updateMatrixWorld(true);
const sourceBones = new Map(); source.traverse(bone => { if (bone.isBone) sourceBones.set(bone.name, bone); });
const pairs = [];
target.traverse(bone => {
  const from = sourceBones.get(bone.name);
  if (from) pairs.push({ bone, from, sourceRest: from.getWorldQuaternion(new T.Quaternion()).invert(), targetRest: bone.getWorldQuaternion(new T.Quaternion()), values: [] });
});
const hips = pairs.find(pair => pair.bone.name === 'mixamorigHips');
if (!hips || pairs.length < 20) throw new Error('Incomplete Mixamo skeleton mapping');
const sourceHeight = hips.from.getWorldPosition(new T.Vector3()).y;
const targetHipWorld = hips.bone.getWorldPosition(new T.Vector3());
const scale = targetHipWorld.y / sourceHeight;
const clip = source.animations[0], mixer = new T.AnimationMixer(source);
mixer.clipAction(clip).setLoop(T.LoopOnce, 1).play();
const motion = clip.tracks.find(track => track.name === 'mixamorigHips.position');
const first = new T.Vector3().fromArray(motion.values), last = new T.Vector3().fromArray(motion.values, motion.values.length - 3);
const travel = last.clone().sub(first); travel.y = 0;
const times = [], positions = [], frames = Math.round(clip.duration * 30);
for (let frame = 0; frame <= frames; frame++) {
  const time = Math.min(frame / 30, clip.duration); times.push(time);
  mixer.setTime(time); source.updateMatrixWorld(true);
  // Parent-first traversal: preserve animated world-space deltas across bind axes.
  for (const pair of pairs) {
    const world = pair.from.getWorldQuaternion(new T.Quaternion()).multiply(pair.sourceRest).multiply(pair.targetRest);
    const parent = pair.bone.parent.getWorldQuaternion(new T.Quaternion()).invert();
    pair.bone.quaternion.copy(parent.multiply(world)); pair.bone.updateMatrixWorld(true);
    pair.values.push(...pair.bone.quaternion.toArray());
  }
  const displacement = hips.from.position.clone().sub(first).addScaledVector(travel, -time / clip.duration).multiplyScalar(scale);
  // Keep the real vertical weight transfer relative to the source bind height.
  displacement.y += (first.y - sourceHeight) * scale;
  const local = hips.bone.parent.worldToLocal(targetHipWorld.clone().add(displacement));
  positions.push(...local.toArray());
}
const tracks = pairs.map(pair => new T.QuaternionKeyframeTrack(`${pair.bone.name}.quaternion`, times, pair.values));
tracks.push(new T.VectorKeyframeTrack('mixamorigHips.position', times, positions));
const result = new T.AnimationClip('Mixamo_Unarmed_Walk_Forward', clip.duration, tracks);
const output = { source: 'Mixamo / Unarmed Walk Forward', stride: travel.length() * scale, clip: T.AnimationClip.toJSON(result) };
fs.mkdirSync('public/game/animations', { recursive: true });
fs.writeFileSync('public/game/animations/sentinel-walk-v1.json', JSON.stringify(output));
console.log({ bones: pairs.length, duration: clip.duration, stride: output.stride });
