void main() {
    float res = 16.;
    gl_FragColor = (fract(gl_FragCoord.x / res) > .5) ^^ (fract(gl_FragCoord.y / res) > .5) ? vec4(.025) : vec4(.15);
}