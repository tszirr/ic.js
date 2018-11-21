uniform vec2 offset;
uniform vec2 size;
uniform float exposure;
//varying vec4 gl_Position; 

void main() {
    vec2 c = gl_FragCoord.xy - offset;
    if (c.x < 0. || c.y < 0. || c.x >= size.x || c.y >= size.y)
        discard;

    gl_FragColor = vec4(c/size * exposure, 0, 1);
}