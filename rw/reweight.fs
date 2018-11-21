//varying vec4 gl_Position; 

void main() {
    gl_FragColor = vec4(gl_FragCoord.x/512., gl_FragCoord.y/512., 0, 1);
}