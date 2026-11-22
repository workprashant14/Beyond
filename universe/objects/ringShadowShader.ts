import * as THREE from "three";
import type { IUniform } from "three";

/**
 * Fragment-shader patches that add Saturn's ring shadow on the globe and the globe's shadow on the rings to the standard lit materials.
 * They repeat the reference functions in utils/ringShadow.ts (tests/ringshadow.test.ts checks them against a brute-force ray march and
 * checks that the constants below match). World space, Sun at the origin. Only direct light is dimmed; ambient light is left as it is.
 */
export interface RingShadowUniforms {
  [key: string]: IUniform;
  uEnabled: IUniform<number>;
  uRingC: IUniform<THREE.Vector3>;
  uRingN: IUniform<THREE.Vector3>;
  uRingInner: IUniform<number>;
  uRingOuter: IUniform<number>;
  uRingTex: IUniform<THREE.Texture | null>;
  uGlobeC: IUniform<THREE.Vector3>;
  uGlobeR: IUniform<number>;
}

export const makeRingShadowUniforms = (): RingShadowUniforms => ({
  uEnabled: { value: 1 },
  uRingC: { value: new THREE.Vector3() },
  uRingN: { value: new THREE.Vector3(0, 1, 0) },
  uRingInner: { value: 1 },
  uRingOuter: { value: 2 },
  uRingTex: { value: null },
  uGlobeC: { value: new THREE.Vector3() },
  uGlobeR: { value: 1 },
});

/** Updates the uniforms for one frame (kept outside React components: it mutates shader state). */
export function setRingShadow(u: RingShadowUniforms, p: { center: THREE.Vector3; tiltRad: number; radius: number; texture: THREE.Texture; enabled: boolean }) {
  u.uRingC.value.copy(p.center);
  u.uGlobeC.value.copy(p.center);
  u.uRingN.value.set(-Math.sin(p.tiltRad), Math.cos(p.tiltRad), 0);
  u.uGlobeR.value = p.radius;
  u.uRingInner.value = p.radius * 1.3;
  u.uRingOuter.value = p.radius * 2.3;
  u.uRingTex.value = p.texture;
  u.uEnabled.value = p.enabled ? 1 : 0;
}

const DECL = `
varying vec3 vShadowWorld;
uniform float uEnabled;
uniform vec3 uRingC;
uniform vec3 uRingN;
uniform float uRingInner;
uniform float uRingOuter;
uniform sampler2D uRingTex;
uniform vec3 uGlobeC;
uniform float uGlobeR;
`;

function patch(shader: THREE.WebGLProgramParametersWithUniforms, u: RingShadowUniforms, body: string) {
  Object.assign(shader.uniforms, u);
  shader.vertexShader = shader.vertexShader
    .replace("void main() {", "varying vec3 vShadowWorld;\nvoid main() {")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\n  vShadowWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;");
  shader.fragmentShader = shader.fragmentShader
    .replace("void main() {", `${DECL}\nvoid main() {`)
    .replace("#include <opaque_fragment>", `${body}\n#include <opaque_fragment>`);
}

/** Globe: dimmed where the ring lies between the point and the Sun, scaled by the ring's own opacity at that radius. */
export function patchGlobe(shader: THREE.WebGLProgramParametersWithUniforms, u: RingShadowUniforms) {
  patch(shader, u, `
  if (uEnabled > 0.5) {
    vec3 s = normalize(-vShadowWorld);
    float denom = dot(s, uRingN);
    float shadow = 0.0;
    if (abs(denom) > 1e-4) {
      float t = -dot(vShadowWorld - uRingC, uRingN) / denom;
      if (t > 0.0) {
        vec3 H = vShadowWorld + s * t;
        float rho = length(H - uRingC);
        if (rho > uRingInner && rho < uRingOuter) shadow = texture2D(uRingTex, vec2(0.5 + 0.5 * rho / uRingOuter, 0.5)).a;
      }
    }
    outgoingLight *= 1.0 - 0.85 * shadow;
  }`);
}

/** Rings: dimmed inside the planet's shadow cone (point Sun, so a cylinder of the planet's radius), soft over 3% of the radius. */
export function patchRing(shader: THREE.WebGLProgramParametersWithUniforms, u: RingShadowUniforms) {
  patch(shader, u, `
  if (uEnabled > 0.5) {
    vec3 s = normalize(-vShadowWorld);
    vec3 oc = uGlobeC - vShadowWorld;
    float tca = dot(oc, s);
    float d = length(oc - s * tca);
    float sh = tca > 0.0 ? 1.0 - smoothstep(uGlobeR * 0.985, uGlobeR * 1.015, d) : 0.0;
    outgoingLight *= 1.0 - 0.9 * sh;
  }`);
}
