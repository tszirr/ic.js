#version 300 es

uniform sampler2D offsetTex;

in vec2 coord;

out vec4 fragColor;

void main() {
    vec2 offset = texture(offsetTex, coord).xy;
    offset *= 50.0;
    fragColor = vec4(abs(offset), max(-offset.x, 0.0) + max(-offset.y, 0.0), 1.0);
}
