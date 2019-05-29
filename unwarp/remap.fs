#version 300 es

uniform sampler2D colorTex, remapTex;
uniform vec2 remapOffset;

in vec2 coord;

out vec4 color;

void main() {
    color = texture(colorTex, coord + texture(remapTex, coord + remapOffset).xy);
}
