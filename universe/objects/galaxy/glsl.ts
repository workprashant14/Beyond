/** Shared GLSL for the galaxy shaders. */
export const NOISE = /* glsl */ `
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float a = 0.5, s = 0.0;
    for (int i = 0; i < 3; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; }
    return s;
  }
  // Distance LOD: far galaxies are a few dozen pixels wide, so one noise octave is indistinguishable and ~3x cheaper.
  uniform float uDetail;
  float fbmL(vec2 p) { return uDetail > 0.5 ? fbm(p) : vnoise(p); }
  // soft shoulder so bright cores do not clip to white
  vec3 tone(vec3 c, float exposure) { return 1.0 - exp(-c * exposure); }
`;

/** Round-point fragment shader shared by the resolved-star layers. */
export const STAR_VERT = /* glsl */ `
  uniform float uPx;
  uniform float uSize;      // galaxy radius * pixel scale
  attribute vec3 aColor;
  attribute float aSize;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float px = aSize * uSize / max(-mv.z, 1.0);
    px = clamp(px, 1.0, 4.0) * uPx;
    vAlpha = clamp(aSize * uSize / max(-mv.z, 1.0), 0.35, 1.0);
    vColor = aColor;
    gl_PointSize = px;
    gl_Position = projectionMatrix * mv;
  }
`;
export const STAR_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float a = exp(-d * d * 5.0) * vAlpha * 0.85;
    gl_FragColor = vec4(vColor, a);
  }
`;
