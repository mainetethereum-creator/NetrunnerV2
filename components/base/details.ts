import * as T from "three";

export function addRefugeSurfaceDetails(scene: T.Scene) {
  const shadowCanvas = document.createElement("canvas"); shadowCanvas.width = shadowCanvas.height = 128;
  const ctx = shadowCanvas.getContext("2d")!;
  const radial = ctx.createRadialGradient(64, 64, 10, 64, 64, 64);
  radial.addColorStop(0, "rgba(3,13,12,.8)"); radial.addColorStop(0.48, "rgba(3,13,12,.5)"); radial.addColorStop(1, "rgba(3,13,12,0)");
  ctx.fillStyle = radial; ctx.fillRect(0, 0, 128, 128);
  const shadowTexture = new T.CanvasTexture(shadowCanvas);
  const shadowMat = new T.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: 0.6, polygonOffset: true, polygonOffsetFactor: -1 });
  const contacts = [
    [-5.4, 0.2, 4.4, 2.9], [5.1, 0.2, 4.4, 2.9], [10.3, 2.1, 4.1, 5], [-10.5, 4.1, 3.8, 4.2],
    [-7.3, -4.6, 1.8, 1.5], [0, -5.2, 1.8, 1.5], [8, -4.7, 1.8, 1.5],
    [-8.4, -6.4, 8.5, 3], [0, -6.8, 7, 3],
    [-11.35, -1.2, 2.5, 10], [11.35, -1.2, 2.5, 10],
  ];
  const shadows = new T.InstancedMesh(new T.PlaneGeometry(1, 1), shadowMat, contacts.length);
  const transform = new T.Object3D();
  contacts.forEach(([x, z, w, d], i) => {
    transform.position.set(x, 0.095, z); transform.rotation.set(-Math.PI / 2, 0, 0); transform.scale.set(w, d, 1); transform.updateMatrix(); shadows.setMatrixAt(i, transform.matrix);
  }); scene.add(shadows);

  // A worn road stencil provides human scale and breaks the repeated slab grid.
  const stencil = document.createElement("canvas"); stencil.width = 1024; stencil.height = 256;
  const c = stencil.getContext("2d")!;
  c.fillStyle = "#b6b195"; c.font = "bold 124px monospace"; c.textAlign = "center"; c.fillText("REFUGE  /  01", 512, 158);
  let seed = 913;
  const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  c.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 1800; i++) { c.globalAlpha = rand() * 0.85; c.fillRect(rand() * 1024, rand() * 256, rand() * 9 + 1, rand() * 4 + 1); }
  const stencilTexture = new T.CanvasTexture(stencil); stencilTexture.colorSpace = T.SRGBColorSpace;
  const stencilMesh = new T.Mesh(new T.PlaneGeometry(5.5, 1.37), new T.MeshBasicMaterial({ map: stencilTexture, transparent: true, opacity: 0.36, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  stencilMesh.rotation.x = -Math.PI / 2; stencilMesh.position.set(0, 0.079, 7.6); scene.add(stencilMesh);

  // Water stains on the foot of the buildings. One shared small decal, six planes.
  const stainCanvas = document.createElement("canvas"); stainCanvas.width = stainCanvas.height = 128;
  const s = stainCanvas.getContext("2d")!;
  for (let i = 0; i < 80; i++) {
    const x = rand() * 128, h = rand() * 112;
    const g = s.createLinearGradient(0, 128 - h, 0, 128); g.addColorStop(0, "rgba(17,28,21,0)"); g.addColorStop(1, "rgba(17,28,21,.28)");
    s.fillStyle = g; s.fillRect(x, 128 - h, 1 + rand() * 5, h);
  }
  const stainTexture = new T.CanvasTexture(stainCanvas);
  const stainMat = new T.MeshBasicMaterial({ map: stainTexture, transparent: true, depthWrite: false, opacity: 0.7 });
  for (const x of [-11, -5.3, -2.7, 2.7]) {
    const mesh = new T.Mesh(new T.PlaneGeometry(0.55, 1.7), stainMat); mesh.position.set(x, 0.88, x < -3 ? -6.54 : -6.85); scene.add(mesh);
  }

  const leafShape = new T.Shape(); leafShape.moveTo(0, -0.5); leafShape.quadraticCurveTo(-0.48, -0.1, 0, 0.5); leafShape.quadraticCurveTo(0.48, -0.1, 0, -0.5);
  const geometry = new T.ShapeGeometry(leafShape, 3);
  const pos = geometry.getAttribute("position");
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.abs(pos.getX(i)) * 0.25);
  geometry.computeVertexNormals();
  const leafMaterial = new T.MeshStandardMaterial({ color: "#89904d", roughness: 0.95, side: T.DoubleSide });
  const windTime = { value: 0 };
  leafMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.windTime = windTime;
    shader.vertexShader = `uniform float windTime;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `
      #include <begin_vertex>
      transformed.x += sin(windTime*1.3 + instanceMatrix[3].x*2.1 + instanceMatrix[3].z)*.07*(position.y+.5);
    `);
  };
  const leaves = new T.InstancedMesh(geometry, leafMaterial, 420);
  for (let i = 0; i < 420; i++) {
    const side = i < 210 ? -5.4 : 5.1;
    transform.position.set(side + (rand() - 0.5) * 2.5, 0.75 + rand() * 0.9, 0.2 + (rand() - 0.5) * 1.0);
    transform.rotation.set(-Math.PI / 3 + rand() * 1.5, rand() * 6.28, rand() * 6.28);
    const scale = 0.15 + rand() * 0.25; transform.scale.set(scale, scale * 1.7, scale); transform.updateMatrix(); leaves.setMatrixAt(i, transform.matrix);
    leaves.setColorAt(i, new T.Color().setHSL(0.15 + rand() * 0.07, 0.22 + rand() * 0.24, 0.27 + rand() * 0.18));
  }
  leaves.receiveShadow = true; scene.add(leaves);
  return { update(time: number) { windTime.value = time; } };
}
