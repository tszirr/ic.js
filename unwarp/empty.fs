#version 300 es

out vec4 fragColor;

void main() {
    float res = 16.;
    fragColor = (fract(gl_FragCoord.x / res) > .5) ^^ (fract(gl_FragCoord.y / res) > .5) ? vec4(.025) : vec4(.15);
}