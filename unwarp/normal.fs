#version 300 es

uniform sampler2D bumpMap;
uniform float bumpScale;

in vec2 coord;

out vec4 fragColor;

void main() {
    float stride = 0.5;
    vec2 du = stride * dFdx(coord), dv = stride * dFdy(coord);

    float heightX0 = texture(bumpMap, coord - du).x * bumpScale;
    float heightX1 = texture(bumpMap, coord + du).x * bumpScale;
    float heightY0 = texture(bumpMap, coord - dv).x * bumpScale;
    float heightY1 = texture(bumpMap, coord + dv).x * bumpScale;

    vec3 n = cross(vec3(du, heightX1-heightX0), vec3(dv, heightY1-heightY0));
    fragColor = vec4(n / n.z, 1.0) * 0.5 + 0.5;
}
