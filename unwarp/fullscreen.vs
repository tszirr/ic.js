#version 300 es

out vec2 coord;

void main() {
    gl_Position	= modelMatrix * vec4(position, 1.0);
    coord = position.xy * .5 + vec2(.5);
}