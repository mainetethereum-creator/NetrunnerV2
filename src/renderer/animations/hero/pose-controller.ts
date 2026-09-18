import * as THREE from "three";

const LIMB = new THREE.Vector3(0, 1, 0);

export class PoseController {
  private bones: Record<string, THREE.Object3D> = {};
  private idle: Record<string, THREE.Quaternion> = {};

  constructor(root: THREE.Object3D) {
    const aliases: Array<[string, THREE.Object3D]> = [];
    root.traverse((object) => {
      if (!(object as THREE.Bone).isBone) return;
      this.bones[object.name] = object;
      const bare = object.name.replace(/^.*[:|]/, "").replace(/^mixamorig/i, "");
      if (bare !== object.name) aliases.push([bare, object]);
    });
    for (const [bare, bone] of aliases) if (!(bare in this.bones)) this.bones[bare] = bone;
  }

  buildIdle(root: THREE.Object3D) {
    root.updateMatrixWorld(true);
    const rootPosition = root.getWorldPosition(new THREE.Vector3());
    for (const side of ["Left", "Right"] as const) {
      const shoulder = this.bones[`${side}Arm`];
      if (!shoulder) continue;
      const direction = Math.sign(shoulder.getWorldPosition(new THREE.Vector3()).x - rootPosition.x)
        || (side === "Left" ? -1 : 1);
      this.aim(`${side}Arm`, new THREE.Vector3(direction * .30, -1, .08), root);
      this.aim(`${side}ForeArm`, new THREE.Vector3(direction * .22, -1, .12), root);
    }
  }

  private aim(name: string, direction: THREE.Vector3, root: THREE.Object3D) {
    const bone = this.bones[name];
    if (!bone || !bone.parent) return;
    const world = bone.getWorldQuaternion(new THREE.Quaternion());
    world.premultiply(new THREE.Quaternion().setFromUnitVectors(LIMB.clone().applyQuaternion(world).normalize(), direction.clone().normalize()));
    this.idle[name] = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world);
    bone.quaternion.copy(this.idle[name]);
    root.updateMatrixWorld(true);
  }

  apply(weight: number) {
    if (weight <= .001) return;
    for (const name in this.idle) this.bones[name]?.quaternion.slerp(this.idle[name], weight);
  }
}
