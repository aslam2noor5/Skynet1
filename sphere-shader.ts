/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
const vs = `#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
  varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

uniform float time;

uniform vec4 inputData;
uniform vec4 outputData;

vec3 calc( vec3 pos ) {

  vec3 dir = normalize( pos );
  vec3 p = dir + vec3( time, 0., 0. );
  return pos +
    1. * inputData.x * inputData.y * dir * (.5 + .5 * sin(inputData.z * pos.x + time)) +
    1. * outputData.x * outputData.y * dir * (.5 + .5 * sin(outputData.z * pos.y + time))
  ;
}

vec3 spherical( float r, float theta, float phi ) {
  return r * vec3(
    cos( theta ) * cos( phi ),
    sin( theta ) * cos( phi ),
    sin( phi )
  );
}

void main() {
  #include <uv_vertex>
  #include <color_vertex>
  #include <morphinstance_vertex>
  #include <morphcolor_vertex>
  #include <batching_vertex>
  #include <beginnormal_vertex>
  #include <morphnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <defaultnormal_vertex>
  #include <normal_vertex>
  #include <begin_vertex>

  float inc = 0.001;

  float r = length( position );
  float theta = ( uv.x + 0.5 ) * 2. * PI;
  float phi = -( uv.y + 0.5 ) * PI;

  vec3 np = calc( spherical( r, theta, phi )  );

  vec3 tangent = normalize( calc( spherical( r, theta + inc, phi ) ) - np );
  vec3 bitangent = normalize( calc( spherical( r, theta, phi + inc ) ) - np );
  transformedNormal = -normalMatrix * normalize( cross( tangent, bitangent ) );

  vNormal = normalize( transformedNormal );

  transformed = np;

  #include <morphtarget_vertex>
  #include <skinning_vertex>
  #include <displacementmap_vertex>
  #include <project_vertex>
  #include <logdepthbuf_vertex>
  #include <clipping_planes_vertex>
  vViewPosition = - mvPosition.xyz;
  #include <worldpos_vertex>
  #include <shadowmap_vertex>
  #include <fog_vertex>
  #ifdef USE_TRANSMISSION
    vWorldPosition = worldPosition.xyz;
  #endif
}`;

const fs = `precision highp float;

uniform float time;
uniform vec4 inputData;
uniform vec4 outputData;

varying vec3 vViewPosition;
varying vec3 vNormal;
varying vec2 vUv;

void main() {
    // Use the distance from the center in view space for a 2D radial effect
    vec2 uv = vViewPosition.xy * 1.2;
    float r = length(uv);

    // Combine audio data for overall intensity
    float inputIntensity = (inputData.x + inputData.y) * 0.5;
    float outputIntensity = (outputData.x + outputData.y) * 0.5;
    float audioIntensity = max(inputIntensity, outputIntensity);

    // Colors
    vec3 coreColor = vec3(0.8, 0.9, 1.0);      // Bright, slightly blue core
    vec3 waveColor = vec3(0.1, 0.4, 1.0);      // Glowing blue waveform color
    vec3 finalColor = vec3(0.0);

    // --- Central Core ---
    // A bright, glowing core that pulses with audio
    float coreGlow = pow(1.0 - smoothstep(0.0, 0.3, r), 2.0);
    finalColor += coreColor * coreGlow * (1.0 + audioIntensity * 2.0);

    // --- Radiating Waveforms ---
    // Animate waves moving outward over time
    float waveSpeed = time * -5.0;
    // Wave frequency increases with output audio intensity
    float waveFrequency = 15.0 + outputIntensity * 25.0;
    
    // Create sine wave pattern based on distance from the center
    float wavePattern = sin(r * waveFrequency + waveSpeed);
    
    // Sharpen the sine wave into a glowing line using smoothstep
    float waveThickness = 0.01 + inputIntensity * 0.04;
    wavePattern = smoothstep(0.7, 0.7 + waveThickness, wavePattern);

    // --- Combine and Finalize ---
    // Add the waves to the final color
    // Fade the waves out as they move away from the center
    float waveFalloff = 1.0 - smoothstep(0.1, 0.9, r);
    finalColor += waveColor * wavePattern * waveFalloff * (1.0 + outputIntensity);

    // Fade the entire effect to black at the edges to blend smoothly
    finalColor *= (1.0 - smoothstep(0.8, 1.0, r));

    gl_FragColor = vec4(finalColor, 1.0);
}
`;

export {fs, vs};