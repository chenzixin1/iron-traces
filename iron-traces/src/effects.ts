import * as T from "three";
import { heightAt, type Event, type Tank } from "./simulation";
import { damageState } from "./damage";
type Particle = {
  p: T.Vector3;
  v: T.Vector3;
  age: number;
  life: number;
  size: number;
  kind: number;
  rotation: number;
  dark: number;
};
const CAP = 360;
export class BattleEffects {
  group = new T.Group();
  particles: Particle[] = [];
  private fireLights = [
    new T.PointLight(0xff7625, 0, 9, 2),
    new T.PointLight(0xff7625, 0, 9, 2),
  ];
  private ticks = new Map<number, number>();
  private deaths = new Map<number, number>();
  private geometry = new T.InstancedBufferGeometry();
  private offsets = new Float32Array(CAP * 3);
  private data = new Float32Array(CAP * 4);
  private shades = new Float32Array(CAP);
  private flashes: {
    light: T.PointLight;
    age: number;
    life: number;
    power: number;
  }[] = [];
  constructor() {
    this.group.add(...this.fireLights);
    const plane = new T.PlaneGeometry(1, 1);
    this.geometry.index = plane.index;
    this.geometry.attributes.position = plane.attributes.position;
    this.geometry.attributes.uv = plane.attributes.uv;
    this.geometry.setAttribute(
      "offset",
      new T.InstancedBufferAttribute(this.offsets, 3).setUsage(
        T.DynamicDrawUsage,
      ),
    );
    this.geometry.setAttribute(
      "info",
      new T.InstancedBufferAttribute(this.data, 4).setUsage(T.DynamicDrawUsage),
    );
    this.geometry.setAttribute(
      "shade",
      new T.InstancedBufferAttribute(this.shades, 1).setUsage(
        T.DynamicDrawUsage,
      ),
    );
    this.geometry.instanceCount = 0;
    const material = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: T.DoubleSide,
      toneMapped: false,
      vertexShader: `attribute vec3 offset; attribute vec4 info; attribute float shade;
        varying vec2 vUv; varying vec4 vInfo; varying float vShade;
        void main(){ vUv=uv;vInfo=info;vShade=shade;
          vec4 center=modelViewMatrix*vec4(offset,1.);
          vec2 q=position.xy; float a=info.w;
          q=mat2(cos(a),-sin(a),sin(a),cos(a))*q;
          if(info.z>0.5 && info.z<1.5) q.y*=1.7;
          center.xy+=q*info.x;gl_Position=projectionMatrix*center; }`,
      fragmentShader: `varying vec2 vUv;varying vec4 vInfo;varying float vShade;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
        void main(){vec2 q=(vUv-.5)*2.;float r=length(q);float fade=1.-vInfo.y;
          float n=noise(vUv*7.+vShade*13.)*.6+noise(vUv*15.)*.4;
          vec3 color;float alpha;
          if(vInfo.z<.5){
            alpha=smoothstep(1.,.15,r+n*.25)*fade*.62;
            color=mix(vec3(.12,.13,.12),vec3(.46,.43,.37),vShade)*(.75+n*.5);
          }else if(vInfo.z<1.5){
            float flame=length(vec2(q.x*(1.+vUv.y*.65),q.y));
            alpha=smoothstep(1.,.05,flame+n*.2)*fade*.95;
            color=mix(vec3(1.,.15,.015),vec3(1.,.88,.42),pow(max(0.,1.-r),1.3));
          }else {alpha=pow(max(0.,1.-r),2.)*fade;color=mix(vec3(1.,.37,.055),vec3(1.,.98,.8),fade);}
          if(alpha<.008)discard;gl_FragColor=vec4(color,alpha);
        }`,
    });
    const mesh = new T.Mesh(this.geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    this.group.add(mesh);
    for (let i = 0; i < 4; i++) {
      const light = new T.PointLight(0xff9a32, 0, 15, 2);
      this.group.add(light);
      this.flashes.push({ light, age: 1, life: 0, power: 0 });
    }
  }
  clear() {
    this.particles = [];
    for (const light of this.fireLights) light.intensity = 0;
    this.ticks.clear();
    this.deaths.clear();
    this.geometry.instanceCount = 0;
    for (const f of this.flashes) {
      f.light.intensity = 0;
      f.life = 0;
    }
  }
  private add(
    x: number,
    y: number,
    z: number,
    kind: number,
    size: number,
    life: number,
    v: T.Vector3,
    dark = 0.3,
  ) {
    if (this.particles.length >= CAP) {
      const old = this.particles.findIndex((p) => p.kind === 0);
      if (old < 0) return;
      this.particles.splice(old, 1);
    }
    this.particles.push({
      p: new T.Vector3(x, y, z),
      v,
      kind,
      size,
      life,
      age: 0,
      rotation:
        kind === 1 ? (Math.random() - 0.5) * 0.35 : Math.random() * 6.28,
      dark,
    });
  }
  emit(e: Event) {
    if (e.type === "supply" || e.type === "victory") return;
    const firing = e.type === "fire",
      destroy = e.type === "destroy",
      tank = e.owner !== undefined;
    const y = heightAt(e.x, e.z) + (firing ? 2.1 : tank ? 1.65 : 0.6);
    const flash = this.flashes.reduce((a, b) =>
      a.life - a.age < b.life - b.age ? a : b,
    );
    flash.light.position.set(e.x, y + 0.3, e.z);
    flash.age = 0;
    flash.life = destroy ? 0.7 : 0.2;
    flash.power = destroy ? 160 : 75;
    const v = () =>
      new T.Vector3(
        (Math.random() - 0.5) * 6,
        Math.random() * 5 + 1,
        (Math.random() - 0.5) * 6,
      );
    this.add(
      e.x,
      y,
      e.z,
      2,
      destroy ? 7 : firing ? 2.6 : 2,
      destroy ? 0.35 : 0.14,
      new T.Vector3(),
    );
    for (let i = 0; i < (destroy ? 18 : firing ? 4 : 12); i++)
      this.add(
        e.x,
        y,
        e.z,
        2,
        0.12 + Math.random() * 0.2,
        0.35 + Math.random() * 0.8,
        v().multiplyScalar(destroy ? 1.8 : 1),
      );
    for (let i = 0; i < (destroy ? 10 : firing ? 2 : 3); i++)
      this.add(
        e.x,
        destroy ? y + 1.4 : y,
        e.z,
        1,
        destroy ? 2 + Math.random() * 1.2 : 0.65,
        0.25 + Math.random() * (destroy ? 1.4 : 0.25),
        v().multiplyScalar(0.35),
      );
    for (let i = 0; i < (destroy ? 16 : firing ? 4 : 6); i++)
      this.add(
        e.x,
        y,
        e.z,
        0,
        0.65 + Math.random() * (destroy ? 1.5 : 0.6),
        1.2 + Math.random() * 2.5,
        v().multiplyScalar(0.35),
        destroy ? 0.12 : 0.8,
      );
  }
  update(
    tanks: Tank[],
    dt: number,
    time: number,
    camera: T.Camera,
    quality: "low" | "normal" | "high",
  ) {
    if (dt > 0) {
      for (const t of tanks) {
        const state = damageState(t);
        if (t.alive) this.deaths.delete(t.id);
        else if (!this.deaths.has(t.id)) this.deaths.set(t.id, time);
        const wreckAge = time - (this.deaths.get(t.id) ?? time);
        if (state === "intact" || wreckAge > 120) {
          this.ticks.delete(t.id);
          continue;
        }
        let tick = (this.ticks.get(t.id) ?? 0) + dt;
        const interval =
          quality === "low" ? 0.2 : quality === "high" ? 0.065 : 0.1;
        if (tick >= interval) {
          tick %= interval;
          const x = t.x - Math.sin(t.angle) * 1.2,
            z = t.z - Math.cos(t.angle) * 1.2,
            y = heightAt(x, z) + 1.65;
          const burning =
            (state === "burning" || state === "wreck") && wreckAge < 65;
          this.add(
            x + (Math.random() - 0.5) * 0.5,
            y + 0.25,
            z,
            0,
            burning ? 1.25 : 0.75,
            burning ? 5 : 3.6,
            new T.Vector3(0.3, burning ? 1.5 : 1, 0.1),
            burning ? 0.08 : 0.7,
          );
          if (burning) {
            for (let i = 0; i < 2; i++)
              this.add(
                x + (Math.random() - 0.5) * 1.1,
                y + 0.25,
                z + (Math.random() - 0.5) * 0.8,
                1,
                0.8 + Math.random() * 0.8,
                0.55 + Math.random() * 0.6,
                new T.Vector3(0.1, 1.2 + Math.random(), 0.05),
              );
          }
        }
        this.ticks.set(t.id, tick);
      }
      for (const p of this.particles) {
        p.age += dt;
        p.p.addScaledVector(p.v, dt);
        if (p.kind === 2) p.v.y -= 9.8 * dt;
        else if (p.kind === 0) {
          p.v.x += dt * 0.05;
          p.rotation += dt * 0.08;
        }
      }
      this.particles = this.particles.filter((p) => p.age < p.life);
      for (const f of this.flashes) {
        f.age += dt;
        f.light.intensity =
          f.age < f.life ? f.power * (1 - f.age / f.life) ** 2 : 0;
      }
    }
    const burning = tanks
      .filter((t) => {
        const state = damageState(t);
        return (
          (state === "burning" || state === "wreck") &&
          time - (this.deaths.get(t.id) ?? time) < 65
        );
      })
      .sort(
        (a, b) =>
          Math.hypot(a.x - camera.position.x, a.z - camera.position.z) -
          Math.hypot(b.x - camera.position.x, b.z - camera.position.z),
      );
    this.fireLights.forEach((light, i) => {
      const t = burning[i];
      light.intensity = t ? 12 + Math.sin(time * 17 + i) * 3 : 0;
      if (t)
        light.position.set(
          t.x - Math.sin(t.angle),
          heightAt(t.x, t.z) + 2.5,
          t.z - Math.cos(t.angle),
        );
    });
    // Back-to-front billboards keep dense smoke from drawing over nearer flames incorrectly.
    this.particles.sort(
      (a, b) =>
        b.p.distanceToSquared(camera.position) -
        a.p.distanceToSquared(camera.position),
    );
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      this.offsets.set(p.p.toArray(), i * 3);
      this.data.set(
        [
          p.size *
            (p.kind === 0
              ? 1 + p.age * 0.8
              : p.kind === 1
                ? 1 + p.age * 0.3
                : 1),
          p.age / p.life,
          p.kind,
          p.rotation,
        ],
        i * 4,
      );
      this.shades[i] = p.dark;
    }
    this.geometry.instanceCount = this.particles.length;
    for (const key of ["offset", "info", "shade"])
      this.geometry.attributes[key].needsUpdate = true;
  }
}
