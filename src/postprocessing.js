import {
  DepthTexture,
  FloatType,
  GLSL3,
  Mesh,
  PlaneGeometry,
  RawShaderMaterial,
  Vector2,
  WebGLMultipleRenderTargets,
  WebGLRenderTarget,
} from 'three';

class PostProcessing {
  constructor({ enabled, samples }) {
    this.blurScale = 0.5;
    this.isEnabled = enabled;
    const plane = new PlaneGeometry(2, 2, 1, 1);
    plane.deleteAttribute('normal');
    plane.deleteAttribute('uv');
    const vertexShader = [
      'precision highp float;',
      'in vec3 position;',
      'out vec2 uv;',
      'void main() {',
      '  gl_Position = vec4(position.xy, 0, 1);',
      '  uv = position.xy * 0.5 + 0.5;',
      '}',
    ].join('\n');
    this.blurTargetA = new WebGLRenderTarget(window.innerWidth * this.blurScale, window.innerHeight * this.blurScale, {
      depthBuffer: false,
      samples,
      type: FloatType,
    });
    this.blurTargetB = new WebGLRenderTarget(this.blurTargetA.width, this.blurTargetA.height, {
      depthBuffer: false,
      samples,
      type: FloatType,
    });
    this.blur = new Mesh(
      plane,
      new RawShaderMaterial({
        glslVersion: GLSL3,
        uniforms: {
          direction: { value: new Vector2() },
          inputTexture: { value: null },
          resolution: { value: new Vector2(this.blurTargetA.width, this.blurTargetA.height) },
        },
        vertexShader,
        fragmentShader: [
          'precision highp float;',
          'in vec2 uv;',
          'out vec4 fragColor;',
          'uniform vec2 direction;',
          'uniform sampler2D inputTexture;',
          'uniform vec2 resolution;',
          'void main() {',
          '  vec2 off1 = vec2(1.3846153846) * direction;',
          '  vec2 off2 = vec2(3.2307692308) * direction;',
          '  vec3 color = texture(inputTexture, uv).rgb * 0.2270270270;',
          '  color += texture(inputTexture, uv + (off1 / resolution)).rgb * 0.3162162162;',
          '  color += texture(inputTexture, uv - (off1 / resolution)).rgb * 0.3162162162;',
          '  color += texture(inputTexture, uv + (off2 / resolution)).rgb * 0.0702702703;',
          '  color += texture(inputTexture, uv - (off2 / resolution)).rgb * 0.0702702703;',
          '  fragColor = vec4(color, 1.0);',
          '}',
        ].join('\n'),
      })
    );
    this.blur.frustumCulled = false;
    this.blur.matrixAutoUpdate = false;
    this.screenTarget = new WebGLMultipleRenderTargets(window.innerWidth, window.innerHeight, 2, {
      depthTexture: new DepthTexture(window.innerWidth, window.innerHeight, FloatType),
      samples,
      type: FloatType,
    });
    this.screen = new Mesh(
      plane,
      new RawShaderMaterial({
        glslVersion: GLSL3,
        uniforms: {
          cameraNear: { value: 0 },
          cameraFar: { value: 0 },
          resolution: this.blur.material.uniforms.resolution,
          blurTexture: { value: this.blurTargetB.texture },
          colorTexture: { value: this.screenTarget.texture[0] },
          depthTexture: { value: this.screenTarget.depthTexture },
          normalTexture: { value: this.screenTarget.texture[1] },
          opacity: { value: 0.5 },
          thickness: { value: 0.5 },
          depthBias: { value: 1 },
          depthScale: { value: 0.5 },
          normalBias: { value: 4 },
          normalScale: { value: 0.5 },
        },
        vertexShader,
        fragmentShader: [
          'precision highp float;',
          'in vec2 uv;',
          'out vec4 fragColor;',
          'uniform float cameraNear;',
          'uniform float cameraFar;',
          'uniform vec2 resolution;',
          'uniform sampler2D blurTexture;',
          'uniform sampler2D colorTexture;',
          'uniform sampler2D depthTexture;',
          'uniform sampler2D normalTexture;',
          'uniform float opacity;',
          'uniform float thickness;',
          'uniform float depthBias;',
          'uniform float depthScale;',
          'uniform float normalBias;',
          'uniform float normalScale;',
          '#define saturate(a) clamp(a, 0.0, 1.0)',
          'float LinearizeDepth(float depth) {',
          '  return cameraFar * cameraNear / ((cameraNear - cameraFar) * depth + cameraFar);',
          '}',
          'vec3 LinearToSRGB(const in vec3 value) {',
          '  return vec3(mix(pow(value.rgb, vec3(0.41666)) * 1.055 - vec3(0.055), value.rgb * 12.92, vec3(lessThanEqual(value.rgb, vec3(0.0031308)))));',
          '}',
          'vec3 SobelSample(const in sampler2D tex, const in vec2 uv, const in vec3 offset) {',
          '  vec3 pixelCenter = texture(tex, uv).rgb;',
          '  vec3 pixelLeft   = texture(tex, uv - offset.xz).rgb;',
          '  vec3 pixelRight  = texture(tex, uv + offset.xz).rgb;',
          '  vec3 pixelUp     = texture(tex, uv + offset.zy).rgb;',
          '  vec3 pixelDown   = texture(tex, uv - offset.zy).rgb;',
          '  return (',
          '    abs(pixelLeft    - pixelCenter)',
          '    + abs(pixelRight - pixelCenter)',
          '    + abs(pixelUp    - pixelCenter)',
          '    + abs(pixelDown  - pixelCenter)',
          '  );',
          '}',
          'float SobelSampleDepth(const in sampler2D tex, const in vec2 uv, const in vec3 offset) {',
          '  float pixelCenter = LinearizeDepth(texture(tex, uv).r);',
          '  float pixelLeft   = LinearizeDepth(texture(tex, uv - offset.xz).r);',
          '  float pixelRight  = LinearizeDepth(texture(tex, uv + offset.xz).r);',
          '  float pixelUp     = LinearizeDepth(texture(tex, uv + offset.zy).r);',
          '  float pixelDown   = LinearizeDepth(texture(tex, uv - offset.zy).r);',
          '  return (',
          '    abs(pixelLeft    - pixelCenter)',
          '    + abs(pixelRight - pixelCenter)',
          '    + abs(pixelUp    - pixelCenter)',
          '    + abs(pixelDown  - pixelCenter)',
          '  );',
          '}',
          'vec3 composite(const in vec2 uv) {',
          '  vec3 offset = vec3((1.0 / resolution.x), (1.0 / resolution.y), 0.0) * thickness;',
          '  float sobelDepth = SobelSampleDepth(depthTexture, uv, offset);',
          '  sobelDepth = pow(saturate(sobelDepth) * depthScale, depthBias);',
          '  vec3 sobelNormalVec = SobelSample(normalTexture, uv, offset);',
          '  float sobelNormal = sobelNormalVec.x + sobelNormalVec.y + sobelNormalVec.z;',
          '  sobelNormal = pow(sobelNormal * normalScale, normalBias);',
          '  vec3 blur = texture(blurTexture, uv).rgb;',
          '  vec3 color = texture(colorTexture, uv).rgb;',
          '  float depth = LinearizeDepth(texture(depthTexture, uv).r);',
          '  return mix(mix(color, vec3(0.0), saturate(max(sobelDepth, sobelNormal)) * opacity), blur, saturate(depth / 64.0));',
          '}',
          'void main() {',
          '  fragColor = vec4(LinearToSRGB(composite(uv)), 1.0);',
          '  if (fract(uv.y * resolution.y / 2.0) > 0.6) {',
          '    float vignette = smoothstep(-0.2, 0.2, 0.6 - distance(uv, vec2(0.5, 0.5)));',
          '    fragColor.rgb *= mix(vec3(1.0), vec3(0.8), 1.0 - vignette);',
          '  }',
          '}',
        ].join('\n'),
      })
    );
    this.screen.frustumCulled = false;
    this.screen.matrixAutoUpdate = false;
  }

  onResize(width, height) {
    const { blur, blurScale, blurTargetA, blurTargetB, screenTarget } = this;
    blurTargetA.setSize(width * blurScale, height * blurScale);
    blurTargetB.setSize(blurTargetA.width, blurTargetA.height);
    blur.material.uniforms.resolution.value.set(blurTargetA.width, blurTargetA.height);
    screenTarget.setSize(width, height);
  }

  render(renderer, scene, camera) {
    const { blur, blurTargetA, blurTargetB, screen, screenTarget } = this;
    renderer.setRenderTarget(screenTarget);
    renderer.render(scene, camera);
  
    blur.material.uniforms.direction.value.set(1, 0);
    blur.material.uniforms.inputTexture.value = screenTarget.texture[0];
    renderer.setRenderTarget(blurTargetA);
    renderer.render(blur, camera);
    blur.material.uniforms.direction.value.set(0, 1);
    blur.material.uniforms.inputTexture.value = blurTargetA.texture;
    renderer.setRenderTarget(blurTargetB);
    renderer.render(blur, camera);
  
    screen.material.uniforms.cameraNear.value = camera.near;
    screen.material.uniforms.cameraFar.value = camera.far;
    renderer.setRenderTarget(null);
    renderer.render(screen, camera);
  }
}

export default PostProcessing;
