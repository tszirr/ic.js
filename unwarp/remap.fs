#version 300 es

uniform sampler2D colorTex, remapTex;

in vec2 coord;

out vec4 color;

void main() {
    color = texture(colorTex, coord + texture(remapTex, coord).xy);
}
