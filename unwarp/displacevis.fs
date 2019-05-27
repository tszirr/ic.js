#version 300 es

uniform sampler2D displaceTex;

uniform float fixHeight;
uniform float fixInterval;
uniform bool fixBoundary;

in vec2 coord;

out vec4 fragColor;

void main() {
    float height = texture(displaceTex, coord).x;
    fragColor = vec2(height, 1.0).xxxy;

    float pinned = fixInterval > 0.0 ? max(1.0 - abs(height - fixHeight) / fixInterval, 0.0) : 0.0;
    fragColor.xyz = mix(fragColor.xyz, vec3(1.0, 0.0, 0.0), pinned);
}
