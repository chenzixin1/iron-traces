import { surfaceMaterial } from "./surface-material";
import { tankMaterial } from "./tank-material";
import { BattleEffects } from "./effects";
import { Cockpit } from "./cockpit";
import type { ViewMode } from "./view";
import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  Simulation,
  SIZE,
  BUILDINGS,
  WATER,
  BRIDGES,
  inRect,
  ROAD_Z,
  ROAD_X,
  FORESTS,
  SWAMP,
  SUPPLY,
  OBJECTIVE,
  heightAt,
  inSwamp,
  type Tank,
  type Event,
} from "./simulation";
const TAU = Math.PI * 2;
function rng(seed = 32) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
const rand = rng(417);
const box = new T.BoxGeometry(1, 1, 1),
  cyl = new T.CylinderGeometry(1, 1, 1, 14),
  ball = new T.IcosahedronGeometry(1, 1);
const dummy = new T.Object3D();
function mat(color: T.ColorRepresentation, roughness = 0.85, metalness = 0) {
  return new T.MeshStandardMaterial({ color, roughness, metalness });
}
class Batch {
  data = new Map<T.Material, T.BufferGeometry[]>();
  add(
    g: T.BufferGeometry,
    m: T.Material,
    x = 0,
    y = 0,
    z = 0,
    sx = 1,
    sy = 1,
    sz = 1,
    rx = 0,
    ry = 0,
    rz = 0,
  ) {
    dummy.position.set(x, y, z);
    dummy.rotation.set(rx, ry, rz);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    const clone = (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(
      dummy.matrix,
    );
    if (!this.data.has(m)) this.data.set(m, []);
    this.data.get(m)!.push(clone);
  }
  finish(parent: T.Object3D, shadow = true) {
    for (const [m, geos] of this.data) {
      const geometry = mergeGeometries(geos);
      const mesh = new T.Mesh(geometry, m);
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      parent.add(mesh);
      geos.forEach((g) => g.dispose());
    }
    this.data.clear();
  }
}
function noiseTexture(color: number) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const data = ctx.createImageData(256, 256),
    c = new T.Color(color);
  for (let i = 0; i < data.data.length; i += 4) {
    const n = 178 + rand() * 54;
    data.data[i] = n;
    data.data[i + 1] = n;
    data.data[i + 2] = n - 5;
    data.data[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = rand() > 0.4 ? "#afa58a40" : "#292b2440";
    ctx.fillRect(rand() * 256, rand() * 256, rand() * 11, 1);
  }
  const t = new T.CanvasTexture(canvas);
  t.colorSpace = T.SRGBColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  return t;
}
interface TankVisual {
  group: T.Group;
  turret: T.Group;
  barrel: T.Group;
  links: T.InstancedMesh;
  left: number;
  right: number;
  lastX: number;
  lastZ: number;
  lastAngle: number;
  dead: boolean;
}
export class World {
  footprintArea = 0;
  effects = new BattleEffects();
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(47, 1, 0.1, 350);
  renderer: T.WebGLRenderer;
  root = new T.Group();
  highDetail = new T.Group();
  vehicleRoot = new T.Group();
  effectsRoot = new T.Group();
  sun = new T.DirectionalLight(0xffe6bf, 3.25);
  tanks = new Map<number, TankVisual>();
  walls = new Map<number, T.Group>();
  wallDead = new Set<number>();
  trackCanvas = document.createElement("canvas");
  trackCtx: CanvasRenderingContext2D;
  trackTexture: T.CanvasTexture;
  trackDirty = false;
  trackTick = 0;
  fadeTick = 0;
  tracks = 0;
  lastTracks = new Map<number, { x: number; z: number; angle: number }>();
  cinematic = true;
  mode: ViewMode = "overhead";
  cockpit = new Cockpit();
  quality: "low" | "normal" | "high" = "normal";
  bulletMeshes = new Map<number, T.Mesh>();
  lastFrame = 0;
  shake = 0;
  aimRay = new T.Raycaster();
  aimPlane = new T.Plane(new T.Vector3(0, 1, 0), -1.3);
  aimPoint = new T.Vector3();
  target = new T.Vector3();
  camPos = new T.Vector3();
  ring!: T.Mesh;
  beacon!: T.Mesh;
  materials: T.Material[] = [];
  theme = "summer";
  terrainDetailMaterials: T.Material[] = [];
  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.info.autoReset = false;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene.background = new T.Color("#b7b7a0");
    this.scene.fog = new T.Fog("#b7b7a0", 75, 170);
    this.scene.add(new T.HemisphereLight(0xe9e6cf, 0x575441, 2.1));
    this.sun.position.set(-32, 65, 25);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -58,
      right: 58,
      top: 58,
      bottom: -58,
      near: 1,
      far: 150,
    });
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.035;
    this.scene.add(
      this.sun,
      this.sun.target,
      this.root,
      this.vehicleRoot,
      this.effectsRoot,
    );
    this.root.add(this.highDetail);
    this.highDetail.visible = false;
    this.trackCanvas.width = this.trackCanvas.height = 4096;
    this.trackCtx = this.trackCanvas.getContext("2d")!;
    this.trackCtx.fillStyle = "white";
    this.trackCtx.fillRect(0, 0, 4096, 4096);
    this.trackTexture = new T.CanvasTexture(this.trackCanvas);
    this.trackTexture.generateMipmaps = false;
    this.trackTexture.minFilter = T.LinearFilter;
    this.makeTerrain();
    this.makeWaterAndBridges();
    this.makeNature();
    this.makeBuildings();
    this.makeSupply();
    this.makeObjective();
    this.resize();
  }
  makeObjective() {
    this.ring = new T.Mesh(
      new T.RingGeometry(5.6, 5.75, 64),
      new T.MeshBasicMaterial({
        color: 0xd3bd7a,
        side: T.DoubleSide,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.set(OBJECTIVE.x, 0.3, OBJECTIVE.z);
    this.root.add(this.ring);
    this.beacon = new T.Mesh(
      new T.CylinderGeometry(0.06, 0.06, 5, 8),
      mat("#78704d"),
    );
    this.beacon.position.set(OBJECTIVE.x, 2.5, OBJECTIVE.z);
    this.root.add(this.beacon);
    const flag = new T.Mesh(
      new T.PlaneGeometry(1.6, 0.9),
      new T.MeshStandardMaterial({ color: 0xa49e72, side: T.DoubleSide }),
    );
    flag.position.set(OBJECTIVE.x + 0.8, 4.3, OBJECTIVE.z);
    this.root.add(flag);
  }
  loadLevel(sim: Simulation, theme = "summer") {
    this.theme = theme;
    // Keep the renderer, cockpit and particle pool; release only scene-owned resources.
    this.disposeGroup(this.root);
    for (const material of this.terrainDetailMaterials) {
      for (const value of Object.values(material)) if (value instanceof T.Texture) value.dispose();
      material.dispose();
    }
    this.terrainDetailMaterials = [];
    this.root = new T.Group();
    this.highDetail = new T.Group();
    this.highDetail.visible = this.quality === "high";
    this.root.add(this.highDetail);
    this.scene.add(this.root);
    this.walls.clear();
    this.wallDead.clear();
    const winter = theme === "winter", autumn = theme === "autumn";
    const sky = winter ? "#b7c2ca" : autumn ? "#b5ac99" : "#b7b7a0";
    this.scene.background = new T.Color(sky);
    this.scene.fog = new T.Fog(sky, winter ? 62 : 75, winter ? 155 : 190);
    this.sun.color.set(winter ? 0xe5efff : autumn ? 0xffd5a8 : 0xffe6bf);
    this.sun.intensity = winter ? 2.5 : 3.25;
    this.makeTerrain();
    this.makeWaterAndBridges();
    this.makeNature();
    this.makeBuildings();
    this.makeSupply();
    this.makeObjective();
    this.reset(sim);
  }
  makeTerrain() {
    const n = 2048,
      c = document.createElement("canvas");
    c.width = c.height = n;
    const ctx = c.getContext("2d")!;
    const pixels = ctx.createImageData(n, n);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const i = (y * n + x) * 4;
        const noise = rand() * 18,
          large = Math.sin(x * 0.017) * Math.cos(y * 0.019) * 5;
        pixels.data[i] = 112 + noise + large;
        pixels.data[i + 1] = 113 + noise + large;
        pixels.data[i + 2] = 76 + noise * 0.6;
        pixels.data[i + 3] = 255;
      }
    ctx.putImageData(pixels, 0, 0);
    const p = (v: number) => ((v + SIZE / 2) / SIZE) * n;
    ctx.strokeStyle = "#ada083";
    ctx.lineWidth = (8 / SIZE) * n;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let z = -SIZE / 2; z <= SIZE / 2; z++) {
      const x = Math.sin(z * 0.05) * 2;
      if (z === -SIZE / 2) ctx.moveTo(p(x), p(z));
      else ctx.lineTo(p(x), p(z));
    }
    ctx.stroke();
    ctx.lineWidth = (5 / SIZE) * n;
    for (const z of ROAD_Z) {
      ctx.beginPath();
      ctx.moveTo(0, p(z));
      ctx.lineTo(n, p(z));
      ctx.stroke();
    }
    for (const x of ROAD_X) {
      ctx.beginPath();
      ctx.moveTo(p(x), 0);
      ctx.lineTo(p(x), n);
      ctx.stroke();
    }
    ctx.fillStyle = "#666948";
    ctx.beginPath();
    ctx.ellipse(
      p(SWAMP.x),
      p(SWAMP.z),
      (SWAMP.rx / SIZE) * n,
      (SWAMP.rz / SIZE) * n,
      -0.2,
      0,
      TAU,
    );
    ctx.fill();
    for (let i = 0; i < 1600; i++) {
      const a = rand() * TAU,
        r = 0.88 + rand() * 0.18;
      ctx.fillStyle = rand() > 0.5 ? "#63674735" : "#72775448";
      ctx.beginPath();
      ctx.ellipse(
        p(SWAMP.x + Math.cos(a) * SWAMP.rx * r),
        p(SWAMP.z + Math.sin(a) * SWAMP.rz * r),
        rand() * 24 + 4,
        rand() * 15 + 3,
        rand() * TAU,
        0,
        TAU,
      );
      ctx.fill();
    }
    for (let i = 0; i < 48000; i++) {
      const x = rand() * n,
        y = rand() * n;
      ctx.fillStyle = rand() > 0.5 ? "#e4d6ac12" : "#292e201b";
      ctx.fillRect(x, y, rand() * 4 + 0.5, rand() * 2 + 0.5);
    }
    for (const f of FORESTS) {
      ctx.fillStyle = "#49523a88";
      ctx.fillRect(
        p(f.x - f.w / 2),
        p(f.z - f.d / 2),
        (f.w / SIZE) * n,
        (f.d / SIZE) * n,
      );
    }
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 8;
    const geometry = new T.PlaneGeometry(SIZE + 100, SIZE + 100, 180, 180);
    geometry.rotateX(-Math.PI / 2);
    const pos = geometry.attributes.position,
      uv = geometry.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        z = pos.getZ(i);
      pos.setY(i, heightAt(x, z));
      uv.setXY(i, (x + SIZE / 2) / SIZE, 1 - (z + SIZE / 2) / SIZE);
    }
    geometry.computeVertexNormals();
    const grassDetail=surfaceMaterial("grass"), roadDetail=surfaceMaterial("gravel"), mudDetail=surfaceMaterial("mud");
    this.terrainDetailMaterials.push(grassDetail, roadDetail, mudDetail);
    const material = new T.MeshStandardMaterial({
      map: tex,
      color: 0xffffff,
      roughness: 0.98,
      bumpMap: this.trackTexture,
      bumpScale: 0.2,
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.trackInk = { value: this.trackTexture };
      shader.uniforms.grassDetail = {value:grassDetail.map};
      shader.uniforms.roadDetail = {value:roadDetail.map};
      shader.uniforms.mudDetail = {value:mudDetail.map};
      shader.fragmentShader =
        "uniform sampler2D trackInk; uniform sampler2D grassDetail; uniform sampler2D roadDetail; uniform sampler2D mudDetail;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        vec2 detailUv=vMapUv*128.0;
        float roadMix=smoothstep(.012,.038,diffuseColor.r-diffuseColor.g);
        vec2 worldXZ=vec2((vMapUv.x-.5)*${SIZE.toFixed(1)},(.5-vMapUv.y)*${SIZE.toFixed(1)});
        float wet=1.0-smoothstep(.7,1.0,length((worldXZ-vec2(${SWAMP.x.toFixed(1)},${SWAMP.z.toFixed(1)}))/vec2(${SWAMP.rx.toFixed(1)},${SWAMP.rz.toFixed(1)})));
        vec3 detail=mix(texture2D(grassDetail,detailUv).rgb,texture2D(roadDetail,detailUv).rgb,roadMix);
        detail=mix(detail,texture2D(mudDetail,detailUv).rgb,wet);
        diffuseColor.rgb=mix(diffuseColor.rgb,detail,.62);
        ${this.theme === "winter" ? "diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.82,.87,.9),.83);" : this.theme === "autumn" ? "diffuseColor.rgb*=vec3(1.14,.94,.77);" : ""}
        diffuseColor.rgb *= mix(0.33,1.0,texture2D(trackInk,vMapUv).r);`,
      );
    };
    const ground = new T.Mesh(geometry, material);
    ground.receiveShadow = true;
    this.root.add(ground);
    const mud = new T.Mesh(
      new T.CircleGeometry(1, 48),
      new T.MeshStandardMaterial({
        color: 0x73785e,
        bumpMap: mudDetail.bumpMap,
        bumpScale: .035,
        roughness: 0.32,
        metalness: 0.08,
        transparent: true,
        opacity: 0.37,
        depthWrite: false,
      }),
    );
    mud.rotation.x = -Math.PI / 2;
    mud.position.set(SWAMP.x, 0.18, SWAMP.z);
    mud.scale.set(SWAMP.rx * 0.84, SWAMP.rz * 0.8, 1);
    this.root.add(mud);
    const stones = new Batch(), extraStones = new Batch(),
      stone = mat("#8c8976");
    for (let i = 0; i < 6500; i++) {
      let x = (rand() - 0.5) * (SIZE - 4),
        z = (rand() - 0.5) * (SIZE - 4);
      if (Math.abs(x) < 3 || WATER.some(r=>inRect({x,z},r)) || BRIDGES.some(r=>inRect({x,z},r))) continue;
      const s = 0.03 + rand() * 0.13;
      (i < 650 ? stones : extraStones).add(
        ball,
        stone,
        x,
        heightAt(x, z) + s * 0.3,
        z,
        s,
        s * 0.55,
        s * 1.3,
        0,
        rand() * 6,
        0,
      );
    }
    stones.finish(this.root, false);
    extraStones.finish(this.highDetail, false);
  }
  makeWaterAndBridges() {
    const steel = mat("#4a504b", .66, .5), deck = surfaceMaterial("gravel", 381);
    const bridgeBatch = new Batch();
    for (const r of WATER) {
      const mesh = new T.Mesh(new T.PlaneGeometry(r.w, r.d), new T.MeshStandardMaterial({color: this.theme === "river" ? 0x456878 : 0x536a69, roughness:.28, metalness:.24}));
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(r.x,.24,r.z);
      this.root.add(mesh);
      // Fine current streaks keep water readable from the traditional camera.
      const ripples = new Batch(), foam = mat("#8ba7a7", .5);
      for(let i=0;i<120;i++) ripples.add(box,foam,r.x+(rand()-.5)*r.w,.255,r.z+(rand()-.5)*r.d,.08,.006,1+rand()*3);
      ripples.finish(this.root,false);
    }
    for (const r of BRIDGES) {
      bridgeBatch.add(box,deck,r.x,.14,r.z,r.w,.2,r.d);
      const alongX = r.w > r.d, length = alongX ? r.w : r.d, width = alongX ? r.d : r.w;
      for (const side of [-1,1]) {
        for(let i=0;i<=8;i++) {
          const along=-length/2+i*length/8, cross=side*(width/2-.45);
          bridgeBatch.add(box,steel,r.x+(alongX?along:cross),2.2,r.z+(alongX?cross:along),.35,4,.35);
        }
        for(const y of [1.1,3.9]) bridgeBatch.add(box,steel,r.x+(alongX?0:side*(width/2-.45)),y,r.z+(alongX?side*(width/2-.45):0),alongX?length:.25,.28,alongX?.25:length);
        for(let i=0;i<8;i++) {
          const along=-length/2+(i+.5)*length/8, cross=side*(width/2-.45), segment=length/8;
          const beam=new T.Mesh(box,steel);
          const start=new T.Vector3(r.x+(alongX?along-segment/2:cross),1.1,r.z+(alongX?cross:along-segment/2));
          const end=new T.Vector3(r.x+(alongX?along+segment/2:cross),3.9,r.z+(alongX?cross:along+segment/2));
          const direction=end.clone().sub(start);
          beam.position.copy(start.add(end).multiplyScalar(.5));beam.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction.clone().normalize());beam.scale.set(.22,direction.length(),.22);this.root.add(beam);
        }
      }
    }
    bridgeBatch.finish(this.root);
    if (!BRIDGES.length) { steel.dispose(); for(const v of Object.values(deck)) if(v instanceof T.Texture)v.dispose(); deck.dispose(); }
  }
  makeNature() {
    const trees = new Batch(), extraLeaves = new Batch(),
      trunk = surfaceMaterial("bark");
    const leafCanvas = document.createElement("canvas");
    leafCanvas.width = leafCanvas.height = 256;
    const lc = leafCanvas.getContext("2d")!;
    for (let i = 0; i < 1300; i++) {
      const a = rand() * TAU,
        r = Math.sqrt(rand()) * 113,
        x = 128 + Math.cos(a) * r,
        y = 128 + Math.sin(a) * r;
      const tone = 70 + rand() * 100;
      lc.fillStyle = `rgb(${tone * 0.83},${tone},${tone * 0.53})`;
      lc.beginPath();
      lc.ellipse(x, y, 3 + rand() * 8, 2 + rand() * 5, rand() * TAU, 0, TAU);
      lc.fill();
      lc.strokeStyle='rgba(202,202,136,.32)';lc.lineWidth=.6;
      lc.beginPath();lc.moveTo(x-3,y);lc.lineTo(x+4,y);lc.stroke();
    }
    const leafTex = new T.CanvasTexture(leafCanvas);
    leafTex.colorSpace = T.SRGBColorSpace;
    leafTex.anisotropy = 4;
    const leaves = (this.theme === "winter" ? [0xcbd3d1, 0xb6c4c3, 0xe4e8e0] : this.theme === "autumn" ? [0xcba45c, 0xa98a51, 0xb8733d] : [0xc3bd8b, 0xa4b38a, 0xd2c797]).map(
      (color) =>
        new T.MeshStandardMaterial({
          color,
          map: leafTex,
          alphaTest: 0.5,
          side: T.DoubleSide,
          roughness: 1,
        }),
    );
    const card = new T.PlaneGeometry(1, 1);
    const addTree = (x: number, z: number, scale: number) => {
      const h = heightAt(x, z);
      trees.add(
        cyl,
        trunk,
        x,
        h + 2.2 * scale,
        z,
        0.18 * scale,
        4.4 * scale,
        0.18 * scale,
      );
      for (let branch = 0; branch < 8; branch++) {
        const a = branch * 2.399;
        trees.add(cyl, trunk, x + Math.sin(a) * .5 * scale,
          h + (2.5 + branch * .25) * scale, z + Math.cos(a) * .5 * scale,
          .055 * scale, 1.6 * scale, .055 * scale, Math.cos(a) * .7, 0, Math.sin(a) * .7);
      }
      for (let j = 0; j < 14; j++) {
        const a = j * 2.399,
          cx = x + Math.sin(a) * 1.25 * scale,
          cy = h + (3.6 + rand() * 2) * scale,
          cz = z + Math.cos(a) * 1.25 * scale;
        const lm = leaves[Math.floor(rand() * leaves.length)];
        for (let k = 0; k < 15; k++)
          (j < 7 && k < 3 ? trees : extraLeaves).add(
            card,
            lm,
            cx,
            cy,
            cz,
            (1.0 + rand() * 1.4) * scale,
            (1.1 + rand() * 1.2) * scale,
            1,
            k % 3 === 2 ? Math.PI / 2 : (k % 3) * 0.3,
            k * 2.399 + a,
            0,
          );
      }
    };
    for (const f of FORESTS)
      for (let i = 0; i < Math.min(65, (f.w * f.d) / 13); i++)
        addTree(
          f.x + (rand() - 0.5) * f.w,
          f.z + (rand() - 0.5) * f.d,
          0.8 + rand() * 0.5,
        );
    for (let i = 0; i < 80; i++) {
      const a = rand() * TAU,
        r = SIZE * 0.74 + rand() * 20;
      addTree(Math.sin(a) * r, Math.cos(a) * r, 1 + rand());
    }
    trees.finish(this.root);
    extraLeaves.finish(this.highDetail);
    card.dispose();
    const grass = new Batch(), extraGrass = new Batch(),
      gm = mat(this.theme === "winter" ? "#c9d0c7" : this.theme === "autumn" ? "#8b794b" : "#6f7848");
    const blade = new T.PlaneGeometry(0.08, 0.5);
    for (let i = 0; i < 90000; i++) {
      const x = (rand() - 0.5) * (SIZE - 4),
        z = (rand() - 0.5) * (SIZE - 4);
      if (Math.abs(x - Math.sin(z * 0.05) * 2) < 5 || inSwamp(x, z) || WATER.some(r=>inRect({x,z},r)) || BRIDGES.some(r=>inRect({x,z},r))) continue;
      (i < 9000 ? grass : extraGrass).add(
        blade,
        gm,
        x,
        heightAt(x, z) + 0.16,
        z,
        1,
        0.5 + rand(),
        1,
        0,
        rand() * TAU,
        0,
      );
    }
    gm.side = T.DoubleSide;
    grass.finish(this.root, false);
    extraGrass.finish(this.highDetail, false);
    blade.dispose();
  }
  makeBuildings() {
    const b = new Batch(),
      plaster = surfaceMaterial("plaster"),
      stone = surfaceMaterial("brick", 57),
      roof = surfaceMaterial("roof"),
      wood = surfaceMaterial("wood"),
      dark = mat("#383b31");
    if (this.theme === "winter") {
      roof.bumpScale = .015; roof.color.set("#d8dfdf"); roof.emissive.set("#b5c0c7"); roof.emissiveIntensity = .45;
    }
    for (const { x, z, w, d } of BUILDINGS) {
      const h = 5.2;
      const y = heightAt(x, z);
      b.add(box, plaster, x, y + h / 2, z, w, h, d);
      b.add(box, stone, x, y + 0.4, z, w + 0.1, 0.8, d + 0.1);
      // Individual stone courses, corner quoins and window shutters remain inside
      // the building footprint used by collision (only shallow facade relief).
      for (const side of [-1, 1]) {
        for (let row = 0; row < 7; row++)
          for (let col = 0; col < Math.floor(w / .6); col++)
            b.add(box, stone, x - w / 2 + .3 + col * .6, y + .22 + row * .19,
              z + side * (d / 2 + .025), .55, .15, .045);
        for (const dx of [-w * .3, w * .3]) {
          b.add(box, dark, x + dx, y + 3.4, z + side * (d / 2 + .03), 1.1, 1.1, .06);
          for (const shutter of [-1, 1])
            for (let slat = 0; slat < 8; slat++)
              b.add(box, wood, x + dx + shutter * .72, y + 2.91 + slat * .14,
                z + side * (d / 2 + .08), .3, .1, .08);
        }
        for (let tile = 0; tile < Math.ceil(d / .35); tile++)
          for (let row = 0; row < 10; row++) {
            const dx = (row + .5) * (w / 2 + .45) / 10;
            b.add(box, roof, x + side * dx, y + h + 2.65 - dx * 2.6 / (w / 2 + .45),
              z - d / 2 + tile * .35, (w / 2 + .45) / 10, .055, .32,
              0, 0, -side * Math.atan2(2.6, w / 2 + .45));
          }
      }
      const roofShape = new T.Shape();
      roofShape.moveTo(-w / 2 - 0.45, 0);
      roofShape.lineTo(w / 2 + 0.45, 0);
      roofShape.lineTo(0, 2.6);
      roofShape.closePath();
      const rg = new T.ExtrudeGeometry(roofShape, {
        depth: d + 0.8,
        bevelEnabled: false,
      });
      b.add(rg, roof, x, y + h, z - d / 2 - 0.4);
      rg.dispose();
      b.add(box, wood, x, y + 1.2, z + d / 2 + 0.015, 1.6, 2.4, 0.06);
      for (const dx of [-w * 0.3, w * 0.3]) {
        b.add(box, dark, x + dx, y + 3.4, z + d / 2 + 0.025, 1.1, 1.1, 0.06);
        b.add(box, wood, x + dx, y + 3.4, z + d / 2 + 0.055, 0.07, 1.1, 0.03);
        b.add(box, wood, x + dx, y + 3.4, z + d / 2 + 0.055, 1.1, 0.07, 0.03);
      }
      b.add(box, stone, x + w * 0.25, y + h + 2.4, z - 0.8, 0.8, 2.5, 0.85);
    }
    // Wooden field fences sit outside the playable collision routes.
    for (let z = 24; z < 45; z += 3) {
      b.add(box, wood, -39, 0.7, z, 0.16, 1.5, 0.16);
      b.add(box, wood, -39, 0.9, z + 1.5, 0.12, 0.12, 3);
      b.add(box, wood, -39, 0.45, z + 1.5, 0.12, 0.12, 3);
    }
    b.finish(this.root);
  }
  makeSupply() {
    const b = new Batch(),
      cloth = mat("#777b52"),
      wood = surfaceMaterial("wood", 95),
      steel = mat("#565c49");
    const { x, z } = SUPPLY;
    b.add(box, cloth, x, 0.7, z, 3.8, 1.4, 2.8);
    b.add(cyl, steel, x + 2.5, 0.55, z + 1, 0.48, 1.1, 0.48);
    b.add(cyl, steel, x + 2.5, 0.55, z - 0.1, 0.48, 1.1, 0.48);
    for (let i = 0; i < 4; i++)
      b.add(
        box,
        wood,
        x - 2.8,
        0.35 + (i % 2) * 0.7,
        z + Math.floor(i / 2) * 1.1,
        0.9,
        0.65,
        0.9,
      );
    b.finish(this.root);
    const sign = document.createElement("canvas");
    sign.width = 256;
    sign.height = 128;
    const ctx = sign.getContext("2d")!;
    ctx.fillStyle = "#d5c9a7";
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = "#536047";
    ctx.fillRect(118, 16, 20, 56);
    ctx.fillRect(99, 35, 58, 19);
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SUPPLY", 128, 105);
    const mesh = new T.Mesh(
      new T.PlaneGeometry(2, 1),
      new T.MeshStandardMaterial({
        map: new T.CanvasTexture(sign),
        side: T.DoubleSide,
      }),
    );
    mesh.position.set(x, 2, z + 1.45);
    this.root.add(mesh);
  }
  makeTank(t: Tank) {
    const group = new T.Group(),
      turret = new T.Group(),
      barrel = new T.Group();
    this.vehicleRoot.add(group);
    group.scale.x = 0.9;
    group.add(turret);
    turret.position.y = 1.7;
    turret.add(barrel);
    barrel.position.set(0, 0.46, 0.6);
    const player = t.id === 0,
      paint = tankMaterial(player ? "#63664a" : "#84745a", 130 + t.id);

    const rubber = mat("#30332d", 0.96),
      metal = tankMaterial("#494a40", 200 + t.id, true),
      rust = mat("#6b6048", 0.9, 0.3),
      canvas = mat("#898366");
    const b = new Batch();
    b.add(
      new RoundedBoxGeometry(1, 1, 1, 2, 0.1),
      paint,
      0,
      1.05,
      0,
      2.6,
      0.7,
      4.6,
    );
    b.add(box, paint, 0, 1.55, -0.25, 2.45, 0.7, 3.25);
    b.add(box, paint, 0, 1.45, 1.6, 2.45, 0.65, 1.4, 0.4);
    b.add(box, paint, 0, 1.32, -2, 2.45, 0.65, 0.65, -0.24);
    b.add(box, metal, 0, 1.94, -1.1, 1.55, 0.07, 1.1);
    for (let i = 0; i < 9; i++)
      b.add(box, rubber, 0, 1.99, -1.55 + i * 0.11, 1.35, 0.025, 0.04);
    for (const side of [-1, 1]) {
      b.add(
        new RoundedBoxGeometry(1, 1, 1, 2, 0.14),
        rubber,
        side * 1.35,
        0.73,
        0,
        0.57,
        1.13,
        4.55,
      );
      b.add(box, paint, side * 1.35, 1.38, 0, 0.73, 0.08, 4.75);
      for (let j = 0; j < 6; j++) {
        b.add(
          cyl,
          paint,
          side * 1.65,
          0.67,
          -1.75 + j * 0.7,
          0.4,
          0.1,
          0.4,
          0,
          0,
          Math.PI / 2,
        );
        b.add(
          cyl,
          metal,
          side * 1.72,
          0.67,
          -1.75 + j * 0.7,
          0.14,
          0.12,
          0.14,
          0,
          0,
          Math.PI / 2,
        );
      }
      for (let j = 0; j < 3; j++)
        b.add(box, paint, side * 1.69, 0.93, -1.4 + j * 1.4, 0.14, 0.36, 0.85);
      b.add(
        cyl,
        metal,
        side * 1.66,
        0.81,
        2,
        0.38,
        0.12,
        0.38,
        0,
        0,
        Math.PI / 2,
      );
      b.add(
        cyl,
        metal,
        side * 1.66,
        0.81,
        -2,
        0.38,
        0.12,
        0.38,
        0,
        0,
        Math.PI / 2,
      );
      b.add(cyl, metal, side * 0.86, 1.73, 1.75, 0.13, 0.13, 0.13, Math.PI / 2);
      b.add(box, canvas, side * 0.95, 1.72, -1.75, 0.5, 0.5, 0.65);
    }
    for (let i = 0; i < 12; i++)
      b.add(
        ball,
        rust,
        ((i % 6) - 2.5) * 0.39,
        1.72,
        Math.floor(i / 6) * 3.5 - 1.7,
        0.037,
        0.028,
        0.037,
      );
    // Separate weld beads, bolt rows, wheel studs, deck louvers and stowage straps.
    for (const side of [-1, 1]) {
      for (let j = 0; j < 48; j++) {
        b.add(ball, rust, side * 1.23, 1.78, -1.7 + j * .07, .026, .025, .036);
        b.add(box, metal, side * .66, 2.0, -1.6 + j * .022, .5, .027, .012);
      }
      for (let wheel = 0; wheel < 6; wheel++)
        for (let stud = 0; stud < 8; stud++) {
          const a = stud * TAU / 8;
          b.add(ball, metal, side * 1.79, .67 + Math.cos(a) * .22,
            -1.75 + wheel * .7 + Math.sin(a) * .22, .023, .032, .032);
        }
      for (let strap = 0; strap < 3; strap++)
        b.add(box, metal, side * .95 + (strap - 1) * .15, 1.98, -1.75, .035, .035, .66);
    }
    b.finish(group);
    const tb = new Batch();
    tb.add(
      new T.CylinderGeometry(player ? 0.84 : 0.8, 1.13, 0.9, player ? 20 : 6),
      paint,
      0,
      0.33,
      0,
      1,
      1,
      1,
    );
    tb.add(cyl, paint, 0, 0.86, -0.12, 0.49, 0.18, 0.49);
    tb.add(cyl, metal, 0, 0.96, -0.12, 0.36, 0.025, 0.36);
    tb.add(box, paint, 0.5, 0.85, -0.48, 0.23, 0.21, 0.23);
    tb.add(cyl, metal, -0.67, 1.32, -0.56, 0.013, 1.6, 0.013);
    tb.add(box, paint, 0, 0.44, 0.92, 0.88, 0.55, 0.48);
    tb.finish(turret);
    const gun = new Batch();
    gun.add(cyl, paint, 0, 0, 1.65, 0.095, 3.3, 0.095, Math.PI / 2);
    gun.add(cyl, metal, 0, 0, 3.28, 0.115, 0.19, 0.115, Math.PI / 2);
    gun.add(cyl, rubber, 0, 0, 3.38, 0.07, 0.01, 0.07, Math.PI / 2);
    gun.finish(barrel);
    const markings = document.createElement("canvas");
    markings.width = markings.height = 128;
    const ctx = markings.getContext("2d")!;
    ctx.fillStyle = "#dedbc4";
    if (player) {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5 - Math.PI / 2,
          r = i % 2 === 0 ? 50 : 21;
        ctx.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(50, 15, 28, 98);
      ctx.fillRect(15, 50, 98, 28);
      ctx.fillStyle = "#33382f";
      ctx.fillRect(57, 15, 14, 98);
      ctx.fillRect(15, 57, 98, 14);
    }
    ctx.globalCompositeOperation = "destination-out";
    for(let i=0;i<180;i++)ctx.fillRect(rand()*128,rand()*128,rand()*3,rand()*2);
    ctx.globalCompositeOperation = "source-over";
    const mark = new T.Mesh(
      new T.PlaneGeometry(0.85, 0.85),
      new T.MeshStandardMaterial({
        map: new T.CanvasTexture(markings),
        transparent: true,
        depthWrite: false,
        roughness: 1,
      }),
    );
    mark.rotation.x = -Math.PI / 2;
    mark.position.set(0, 1.06, -0.12);
    turret.add(mark);
    if (player) for (const side of [-1,1]) {
      const badge=mark.clone();badge.rotation.set(0, side*Math.PI/2,0);
      badge.position.set(side*1.235,1.65,-.3);badge.scale.setScalar(.8);group.add(badge);
    }
    // Each animated shoe contains 10 pieces instead of one plain box. Merge the
    // shoe once, then instance all 100 shoes: geometry detail rises 10x, calls do not.
    const shoeParts: T.BufferGeometry[] = [];
    const shoe = (x: number, y: number, z: number, w: number, h: number, d: number) => {
      shoeParts.push(box.clone().scale(w, h, d).translate(x, y, z));
    };
    shoe(0, 0, 0, 1, 1, 1);
    shoe(0, .65, 0, .95, .35, .2);
    for (const side of [-1, 1]) {
      shoe(side * .44, 0, -.42, .15, 1.25, .15);
      shoe(side * .44, 0, .42, .15, 1.25, .15);
      shoe(side * .2, -.7, 0, .12, .5, .25);
      shoe(side * .3, .6, .28, .1, .25, .12);
    }
    const shoeGeometry = mergeGeometries(shoeParts);
    shoeParts.forEach(g => g.dispose());
    const links = new T.InstancedMesh(shoeGeometry, tankMaterial("#534a3e", 300 + t.id, true), 100);
    links.castShadow = true;
    group.add(links);
    const v = {
      group,
      turret,
      barrel,
      links,
      left: 0,
      right: 0,
      lastX: t.x,
      lastZ: t.z,
      lastAngle: t.angle,
      dead: false,
    };
    this.tanks.set(t.id, v);
    this.updateTank(t, 0);
    return v;
  }
  reset(sim: Simulation) {
    this.effects.clear();
    this.effectsRoot.add(this.effects.group);
    for (const v of this.tanks.values()) this.disposeGroup(v.group);
    this.tanks.clear();
    for (const w of this.walls.values()) this.disposeGroup(w);
    this.walls.clear();
    this.wallDead.clear();
    this.lastTracks.clear();
    this.tracks = 0;
    this.trackCtx.fillStyle = "white";
    this.trackCtx.fillRect(0, 0, 4096, 4096);
    this.trackTexture.needsUpdate = true;
    for (const mesh of this.bulletMeshes.values()) {
      this.effectsRoot.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as T.Material).dispose();
    }
    this.bulletMeshes.clear();
    for (const t of [sim.player, ...sim.enemies]) this.makeTank(t);
    const model = this.tanks.get(0)!;
    const hullAngle = model.group.rotation.y,
      turretAngle = model.turret.rotation.y;
    this.footprintArea = 0;
    for (let hull = 0; hull < 8; hull++)
      for (let turret = 0; turret < 24; turret++) {
        model.group.rotation.y = (hull * Math.PI) / 4;
        model.turret.rotation.y = (turret * Math.PI) / 12;
        model.group.updateMatrixWorld(true);
        const size = new T.Box3()
          .setFromObject(model.group, true)
          .getSize(new T.Vector3());
        this.footprintArea = Math.max(this.footprintArea, size.x * size.z);
      }
    model.group.rotation.y = hullAngle;
    model.turret.rotation.y = turretAngle;
    model.group.updateMatrixWorld(true);
    for (const w of sim.walls) {
      const g = new T.Group(),
        b = new Batch();
      g.position.set(w.x, heightAt(w.x, w.z), w.z);
      const colors = [surfaceMaterial("brick", 12), surfaceMaterial("brick", 13), surfaceMaterial("brick", 14)];
      for (let row = 0; row < 6; row++)
        for (let col = 0; col < 6; col++) {
          const x = -w.w / 2 + ((col + 0.5) * w.w) / 6;
          b.add(
            box,
            colors[(row + col) % 3],
            x,
            row * 0.35 + 0.175,
            0,
            w.w / 6 - 0.025,
            0.325,
            0.84,
          );
        }
      b.finish(g);
      this.root.add(g);
      this.walls.set(w.id, g);
    }
    this.updateCamera(sim.player, 1, true);
  }
  disposeGroup(g: T.Group) {
    const gs = new Set<T.BufferGeometry>(),
      ms = new Set<T.Material>(),
      textures = new Set<T.Texture>();
    g.traverse((o) => {
      if (o instanceof T.Mesh) {
        gs.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          ms.add(m);
          for (const value of Object.values(m)) if (value instanceof T.Texture) textures.add(value);
        }
      }
    });
    gs.forEach((v) => {
      if (v !== box && v !== cyl && v !== ball) v.dispose();
    });
    ms.forEach((v) => v.dispose());
    textures.forEach((v) => { if (v !== this.trackTexture) v.dispose(); });
    g.removeFromParent();
  }
  updateTank(t: Tank, time: number) {
    const v = this.tanks.get(t.id)!;
    const dx = t.x - v.lastX,
      dz = t.z - v.lastZ,
      da = t.angle - v.lastAngle;
    const travel = dx * Math.sin(t.angle) + dz * Math.cos(t.angle);
    v.left += travel + da * 1.35;
    v.right += travel - da * 1.35;
    v.lastX = t.x;
    v.lastZ = t.z;
    v.lastAngle = t.angle;
    v.group.position.set(t.x, heightAt(t.x, t.z), t.z);
    v.group.rotation.y = t.angle;
    v.turret.rotation.y = t.turret - t.angle;
    v.barrel.position.z = 0.6 - Math.max(0, 0.26 - (time - t.shot) * 0.8);
    v.group.rotation.z = Math.sin(time * 12) * Math.abs(t.speed) * 0.0018;
    const length = 6.8 + TAU * 0.56;
    for (let side = 0; side < 2; side++)
      for (let i = 0; i < 50; i++) {
        let s =
          ((((i / 50) * length + (side ? v.right : v.left)) % length) +
            length) %
          length;
        let z: number, y: number, a: number;
        if (s < 3.4) {
          z = -1.7 + s;
          y = 1.29;
          a = 0;
        } else if (s < 3.4 + Math.PI * 0.56) {
          const theta = (s - 3.4) / 0.56;
          z = 1.7 + Math.sin(theta) * 0.56;
          y = 0.73 + Math.cos(theta) * 0.56;
          a = theta;
        } else if (s < 6.8 + Math.PI * 0.56) {
          z = 1.7 - (s - 3.4 - Math.PI * 0.56);
          y = 0.17;
          a = Math.PI;
        } else {
          const theta = (s - 6.8 - Math.PI * 0.56) / 0.56;
          z = -1.7 - Math.sin(theta) * 0.56;
          y = 0.73 - Math.cos(theta) * 0.56;
          a = Math.PI + theta;
        }
        dummy.position.set(side ? 1.35 : -1.35, y, z);
        dummy.rotation.set(a, 0, 0);
        dummy.scale.set(0.62, 0.095, 0.21);
        dummy.updateMatrix();
        v.links.setMatrixAt(side * 50 + i, dummy.matrix);
      }
    v.links.instanceMatrix.needsUpdate = true;
    if (!t.alive && !v.dead) {
      v.dead = true;
      v.group.traverse((o) => {
        if (o instanceof T.Mesh) {
          const m = o.material as T.MeshStandardMaterial;
          if (m.color) m.color.multiplyScalar(0.35);
        }
      });
      v.turret.rotation.z = 0.09;
    }
  }
  stamp(t: Tank) {
    const prev = this.lastTracks.get(t.id);
    if (!prev) {
      this.lastTracks.set(t.id, { x: t.x, z: t.z, angle: t.angle });
      return;
    }
    const d = Math.hypot(t.x - prev.x, t.z - prev.z),
      a = t.angle - prev.angle;
    if (d + Math.abs(a) * 1.4 < 0.14) return;
    const steps = Math.min(16, Math.ceil((d + Math.abs(a) * 1.4) / 0.14)),
      ctx = this.trackCtx,
      k = 4096 / SIZE;
    for (let i = 1; i <= steps; i++) {
      const f = i / steps,
        heading = prev.angle + a * f,
        x = prev.x + (t.x - prev.x) * f,
        z = prev.z + (t.z - prev.z) * f;
      for (const side of [-1, 1]) {
        const px = (x + Math.cos(heading) * side * 1.35 + SIZE / 2) * k,
          pz = (z - Math.sin(heading) * side * 1.35 + SIZE / 2) * k;
        ctx.save();
        ctx.translate(px, pz);
        ctx.rotate(-heading);
        ctx.fillStyle = inSwamp(x, z) ? "#777777" : "#939393";
        ctx.fillRect(-0.3 * k, -0.045 * k, 0.6 * k, 0.09 * k);
        ctx.fillStyle = "#b0b0b0";
        ctx.fillRect(-0.3 * k, -0.14 * k, 0.055 * k, 0.29 * k);
        ctx.fillRect(0.245 * k, -0.14 * k, 0.055 * k, 0.29 * k);
        ctx.restore();
      }
      this.tracks++;
    }
    this.lastTracks.set(t.id, { x: t.x, z: t.z, angle: t.angle });
    this.trackDirty = true;
  }
  emit(event: Event) {
    this.effects.emit(event);
    if (event.owner === 0 && (event.type === "fire" || event.type === "hit"))
      this.shake = 0.15;
  }
  update(sim: Simulation, dt: number) {
    for (const t of [sim.player, ...sim.enemies]) {
      this.updateTank(t, sim.time);
      if (t.alive && sim.phase === "playing") this.stamp(t);
    }
    for (const w of sim.walls) {
      if (w.hp === 0 && !this.wallDead.has(w.id)) {
        this.wallDead.add(w.id);
        const g = this.walls.get(w.id)!;
        g.scale.y = 0.14;
        g.rotation.z = 0.025;
        g.rotation.y = 0.03;
      }
    }
    for (const b of sim.bullets) {
      let m = this.bulletMeshes.get(b.id);
      if (!m) {
        m = new T.Mesh(
          new T.SphereGeometry(0.1, 6, 4),
          new T.MeshBasicMaterial({ color: 0xffe5a0 }),
        );
        this.effectsRoot.add(m);
        this.bulletMeshes.set(b.id, m);
      }
      m.position.set(b.x, heightAt(b.x, b.z) + 1.5, b.z);
      m.scale.set(0.7, 0.7, 4);
      m.rotation.y = Math.atan2(b.vx, b.vz);
    }
    for (const [id, m] of this.bulletMeshes)
      if (!sim.bullets.some((b) => b.id === id)) {
        m.removeFromParent();
        m.geometry.dispose();
        (m.material as T.Material).dispose();
        this.bulletMeshes.delete(id);
      }
    if (sim.phase === "playing") {
      this.fadeTick += dt;
      if (this.fadeTick >= 1) {
        this.fadeTick = 0;
        this.trackCtx.fillStyle = "rgba(255,255,255,0.025)";
        this.trackCtx.fillRect(0, 0, 4096, 4096);
        this.trackDirty = true;
      }
    }
    this.trackTick += dt;
    if (this.trackDirty && this.trackTick > 0.1) {
      this.trackTexture.needsUpdate = true;
      this.trackTick = 0;
      this.trackDirty = false;
    }
    this.updateCamera(sim.player, dt);
    this.effects.update(
      [sim.player, ...sim.enemies],
      sim.phase === "playing" ? dt : 0,
      sim.time,
      this.camera,
      this.quality,
    );
    this.shake = Math.max(0, this.shake - dt);
    const interior = this.mode === "interior" && !this.cinematic;
    this.tanks.get(0)!.group.visible = !interior;
    this.ring.visible = !interior;
    (this.ring.material as T.MeshBasicMaterial).color.setHex(
      sim.kills === sim.enemies.length ? 0xc9d994 : 0xc6ae73,
    );
    this.renderer.info.reset();
    this.renderer.render(this.scene, this.camera);
    if (interior)
      this.cockpit.render(
        this.renderer,
        sim.time,
        sim.player.speed,
        sim.time - sim.player.shot,
        sim.player.turret,
        sim.player.angle,
      );
  }
  updateCamera(t: Tank, dt: number, snap = false) {
    this.sun.position.set(t.x - 32, 65, t.z + 25);
    this.sun.target.position.set(t.x, 0, t.z);
    this.sun.target.updateMatrixWorld();
    if (this.cinematic) {
      this.camPos.set(t.x + 13, 9, t.z + 13);
      this.target.set(t.x - 7, 1, t.z - 5);
    } else if (this.mode === "interior") {
      const s = Math.sin(t.turret),
        c = Math.cos(t.turret);
      const eye = 1.85 + heightAt(t.x, t.z);
      this.camPos.set(t.x + s * 0.2, eye, t.z + c * 0.2);
      this.target.set(t.x + s * 40, eye - 0.35, t.z + c * 40);
    } else if (this.mode === "overhead") {
      this.camPos.set(t.x, 36, t.z + 27);
      this.target.set(t.x, 0, t.z - 5);
    } else {
      const s = Math.sin(t.angle),
        c = Math.cos(t.angle);
      this.camPos.set(
        t.x - s * 12.5 + Math.cos(t.angle) * 2,
        7.3 + heightAt(t.x, t.z),
        t.z - c * 12.5 - Math.sin(t.angle) * 2,
      );
      this.target.set(t.x + s * 10, 1.3, t.z + c * 10);
    }
    this.camera.position.lerp(
      this.camPos,
      snap || this.mode === "interior" ? 1 : 1 - Math.exp(-dt * 7),
    );
    if (this.shake > 0)
      this.camera.position.y +=
        Math.sin(performance.now() * 0.09) *
        this.shake *
        (this.mode === "interior" ? 0.12 : 1);
    this.camera.lookAt(this.target);
  }
  aim(nx: number, ny: number, t: Tank) {
    this.aimRay.setFromCamera(new T.Vector2(nx, ny), this.camera);
    const p = this.aimRay.ray.intersectPlane(this.aimPlane, this.aimPoint);
    if (p && Math.hypot(p.x - t.x, p.z - t.z) > 1)
      return Math.atan2(p.x - t.x, p.z - t.z);
    return t.turret;
  }
  resize() {
    const w = innerWidth,
      h = innerHeight;
    const scale = this.quality === "low" ? 0.72 : 1;
    this.renderer.setPixelRatio(
      this.quality === "high"
        ? Math.min(Math.max(devicePixelRatio, 1.5), 2, 2560 / w, 1440 / h)
        : Math.min(devicePixelRatio, 1.5, 1920 / w, 1080 / h) * scale,
    );
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.cockpit.resize(this.camera.aspect);
  }
  setQuality(quality: "low" | "normal" | "high") {
    this.quality = quality;
    this.highDetail.visible = quality === "high";
    this.sun.castShadow = quality !== "low";
    const resolution = quality === "high" ? 4096 : 2048;
    if (this.sun.shadow.mapSize.x !== resolution) {
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
      this.sun.shadow.mapPass?.dispose();
      this.sun.shadow.mapPass = null;
      this.sun.shadow.mapSize.set(resolution, resolution);
      this.sun.shadow.needsUpdate = true;
    }
    this.resize();
  }
}
