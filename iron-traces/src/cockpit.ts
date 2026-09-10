import * as T from "three";
/** A bounded, procedural gunner compartment, not a scanned historical interior. */
export class Cockpit {
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(47, 1, 0.015, 10);
  mount = new T.Group();
  details = new T.Group();
  wheel = new T.Group();
  breech = new T.Group();
  port = new T.Group();
  width = 1;
  light = new T.PointLight(0xdad8bc, 3.0, 3, 2);
  constructor() {
    this.scene.add(new T.HemisphereLight(0xb2b8a8, 0x292820, 0.95));
    this.light.position.set(-0.3, 0.35, 0.12);
    this.scene.add(this.light, this.mount);
    this.mount.add(this.port, this.details);
    this.details.add(this.wheel, this.breech);
    const paint = this.material("#747565", 0.9),
      dark = this.material("#292d28", 0.88),
      steel = this.material("#454b44", 0.46, 0.6),
      rubber = this.material("#171c19", 0.95),
      brass = this.material("#857657", 0.48, 0.5);
    const plate = (
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      m: T.Material = paint,
      parent: T.Object3D = this.details,
    ) => {
      const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    };
    // The four armour plates surround a real hole. Their depth creates a visible reveal.
    plate(6, 2, 0.18, 0, 1.15, -0.92, paint, this.port);
    plate(6, 2, 0.24, 0, -1.11, -0.86, paint, this.port);
    plate(2, 3, 0.23, -2.4, 0, -0.86, dark, this.port);
    plate(2, 3, 0.23, 2.4, 0, -0.86, dark, this.port);
    for (const side of [-1, 1]) {
      const wall = plate(0.3, 2, 2.4, side * 1.03, -0.4, -0.05, dark);
      wall.rotation.y = side * -0.17;
      const rail = plate(0.055, 1.2, 0.09, side * 0.66, -0.14, -0.6, steel);
      rail.rotation.z = side * 0.1;
      for (let i = 0; i < 7; i++) {
        const bolt = new T.Mesh(
          new T.CylinderGeometry(0.022, 0.022, 0.016, 6),
          steel,
        );
        bolt.rotation.x = Math.PI / 2;
        bolt.position.set(side * 0.63, -0.5 + i * 0.155, -0.565);
        this.details.add(bolt);
      }
    }
    plate(2, 0.13, 1.6, 0, 0.68, -0.1, dark);
    plate(2, 0.13, 1.5, 0, -0.72, -0.1, dark);
    // Fasteners around the observation housing make its armour thickness readable.
    for (const y of [-0.135, 0.16])
      for (const x of [-0.34, -0.17, 0.17, 0.34]) {
        const bolt = new T.Mesh(
          new T.CylinderGeometry(0.005, 0.006, 0.008, 6),
          steel,
        );
        bolt.rotation.x = Math.PI / 2;
        bolt.position.set(x, y, -0.7);
        this.details.add(bolt);
      }
    // Heavy gun breech occupies the lower right of the gunner's position.
    this.breech.position.set(0.3, -0.25, -0.95);
    this.breech.scale.setScalar(0.8);
    plate(0.3, 0.23, 0.52, 0, 0, 0, steel, this.breech);
    plate(0.37, 0.09, 0.26, 0, 0.14, -0.02, dark, this.breech);
    plate(0.08, 0.3, 0.08, 0.19, 0.02, 0.13, brass, this.breech);
    for (let i = 0; i < 4; i++)
      plate(0.32, 0.015, 0.055, 0, -0.08 + i * 0.045, 0.28, dark, this.breech);
    const wheelRim = new T.Mesh(
      new T.TorusGeometry(0.135, 0.015, 8, 36),
      steel,
    );
    this.wheel.add(wheelRim);
    for (let i = 0; i < 3; i++) {
      const spoke = plate(0.015, 0.25, 0.016, 0, 0, 0, steel, this.wheel);
      spoke.rotation.z = (i * Math.PI) / 3;
    }
    const grip = new T.Mesh(
      new T.CylinderGeometry(0.023, 0.027, 0.09, 12),
      rubber,
    );
    grip.rotation.x = Math.PI / 2;
    grip.position.set(0.09, 0.07, 0.04);
    this.wheel.add(grip);
    this.wheel.position.set(-0.27, -0.22, -0.85);
    this.wheel.scale.setScalar(0.65);
    const tube = new T.Mesh(
      new T.TorusGeometry(0.23, 0.021, 8, 32, Math.PI),
      rubber,
    );
    tube.rotation.z = 0.4;
    tube.position.set(-0.65, -0.56, -0.4);
    this.details.add(tube);
    const label = document.createElement("canvas");
    label.width = 512;
    label.height = 256;
    const ctx = label.getContext("2d")!;
    ctx.fillStyle = "#242922";
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = "#9c9c80";
    ctx.lineWidth = 5;
    ctx.strokeRect(10, 10, 492, 236);
    ctx.fillStyle = "#bfb99b";
    ctx.font = "25px Georgia";
    ctx.fillText("M4   /   GUNNER", 34, 59);
    ctx.font = "17px sans-serif";
    ctx.fillText("75 MM     •     CREW 07", 34, 99);
    ctx.fillText("KEEP HATCH CLOSED", 34, 158);
    ctx.fillText("CHECK BREECH BEFORE FIRING", 34, 193);
    const texture = new T.CanvasTexture(label);
    texture.colorSpace = T.SRGBColorSpace;
    const plaque = new T.Mesh(
      new T.PlaneGeometry(0.29, 0.145),
      new T.MeshBasicMaterial({ map: texture }),
    );
    plaque.position.set(0, 0.245, -0.85);
    plaque.scale.setScalar(0.8);
    this.details.add(plaque);
    const gaugeFace = this.makeGauge();
    gaugeFace.position.set(-0.43, -0.15, -0.92);
    gaugeFace.scale.setScalar(0.65);
    this.details.add(gaugeFace);
  }
  material(color: string, roughness: number, metalness = 0) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#c2c2b4";
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 850; i++) {
      ctx.fillStyle = i % 3 ? "#444b4030" : "#f1e6c53a";
      ctx.fillRect((i * 47) % 128, (i * 83) % 128, (i % 4) + 1, 1);
    }
    const map = new T.CanvasTexture(canvas);
    map.colorSpace = T.SRGBColorSpace;
    map.wrapS = map.wrapT = T.RepeatWrapping;
    return new T.MeshStandardMaterial({ color, map, roughness, metalness });
  }
  makeGauge() {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const x = c.getContext("2d")!;
    x.fillStyle = "#151c19";
    x.fillRect(0, 0, 256, 256);
    x.strokeStyle = "#c9c5a9";
    x.lineWidth = 3;
    x.beginPath();
    x.arc(128, 128, 108, 0, Math.PI * 2);
    x.stroke();
    for (let i = 0; i < 24; i++) {
      x.save();
      x.translate(128, 128);
      x.rotate((i / 24) * Math.PI * 2);
      x.fillStyle = "#b8bda0";
      x.fillRect(-1, -95, 2, i % 3 === 0 ? 15 : 7);
      x.restore();
    }
    x.strokeStyle = "#d7b875";
    x.lineWidth = 4;
    x.beginPath();
    x.moveTo(128, 128);
    x.lineTo(84, 58);
    x.stroke();
    x.fillStyle = "#abae93";
    x.textAlign = "center";
    x.font = "16px Georgia";
    x.fillText("OIL", 128, 181);
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    return new T.Mesh(
      new T.CircleGeometry(0.09, 40),
      new T.MeshBasicMaterial({ map: tex }),
    );
  }
  resize(aspect: number) {
    this.camera.aspect = aspect;
    this.details.scale.setScalar(0.6);
    const ratio = Math.min(1, aspect / (16 / 9));
    for (const part of this.details.children) {
      if (part.userData.layoutX === undefined)
        part.userData.layoutX = part.position.x;
      part.position.x = part.userData.layoutX * ratio;
    }
    this.camera.updateProjectionMatrix();
    this.width =
      Math.tan(T.MathUtils.degToRad(this.camera.fov / 2)) *
      0.82 *
      aspect *
      0.63;
    // Update only the side plates, preserving a 63%-wide viewing aperture at any aspect.
    const left = this.port.children[2],
      right = this.port.children[3];
    left.position.x = -this.width - 1;
    right.position.x = this.width + 1;
  }
  render(
    renderer: T.WebGLRenderer,
    time: number,
    speed: number,
    shotAge: number,
    turret: number,
    hull: number,
  ) {
    const motion = Math.min(1, Math.abs(speed) / 7);
    this.mount.position.y = Math.sin(time * 19) * motion * 0.002;
    this.mount.rotation.z = Math.sin(time * 13) * motion * 0.0015;
    this.wheel.rotation.z = (turret - hull) * 3;
    this.breech.position.z = -0.95 + Math.max(0, 0.09 - shotAge * 0.45);
    this.light.intensity = 3.0 + Math.max(0, 0.13 - shotAge) * 2;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    renderer.autoClear = true;
  }
}
