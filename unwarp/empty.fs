#version 300 es

in vec2 coord;

out vec4 fragColor;

void main() {
    float res = 16.;
    fragColor = (fract(gl_FragCoord.x / res) > .5) ^^ (fract(gl_FragCoord.y / res) > .5) ? vec4(.025) : vec4(.15);
    fragColor = mix(fragColor, vec4(.6, .7, .8, 1), min(2.0 * coord.x, 1.0) * coord.y );
}