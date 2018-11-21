uniform vec2 offset;
uniform vec2 size;
uniform float exposure;

uniform sampler2D picture;

void main() {
    vec2 c = gl_FragCoord.xy - offset;
    if (c.x < 0. || c.y < 0. || c.x >= size.x || c.y >= size.y)
        discard;

    gl_FragColor = texture2D(picture, c/size, 0.);
    gl_FragColor.xyz *= exposure;
}