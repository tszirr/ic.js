varying vec2 coord;

void main() {
    gl_Position	= vec4(position, 1.0);
    coord = position.xy * .5 + vec2(.5);
}