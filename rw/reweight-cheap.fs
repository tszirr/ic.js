uniform vec2 cropOffset;
uniform vec2 size;

uniform sampler2D curr; // current layer in the cascade

uniform float oneOverK;    // 1/kappa
uniform float currScale;   // N/kappa
uniform float cascadeBase; // lowest level brightness

#define LUMINANCE_NRM vec3(0.212671, 0.715160, 0.072169)
float luminance(vec4 c) {
	// match what you have in the renderer
	return dot(c.xyz, LUMINANCE_NRM);
	// e.g. also possible: return max(max(c.x, c.y), c.z);
}

// average of <r>-radius pixel block in <layer> at <coord> (only using r=0 and r=1)
float sampleLayer(sampler2D layer, vec2 coord, vec2 size, const int r, float scale) {
	float val = 0.0;
	int y = -r;
	for (int i = 0; i < 3; ++i) { // WebGL requires static loops
		int x = -r;
		for (int j = 0; j < 3; ++j) { // WebGL requires static loops
			float c = texture2D(layer, (coord + vec2(x, y)) / size, 0.).a;
			c *= scale;
			val += c;
			if (++x > r) break;
		}
		if (++y > r) break;
	}
	return val / float((2*r+1)*(2*r+1));
}

float mapping(float x) {
    return x > 1.0 ? 1.0 + log(x) : x;
}
float inverse_mapping(float x) {
    return x > 1.0 ? exp(x - 1.0) : x;
}

void main() {
	vec2 c = gl_FragCoord.xy - cropOffset;

	// current result
	gl_FragColor = texture2D(curr, c/size, 0.);

	/* sample counting-based reliability estimation */

	// reliability in 3x3 pixel block (see robustness)
	float globalReliability = sampleLayer(curr, gl_FragCoord.xy, size, 1, currScale);
	// reliability of curent pixel
	float localReliability = sampleLayer(curr, gl_FragCoord.xy, size, 0, currScale);

    float fittingCoeff = globalReliability / currScale
        / mapping(currScale * inverse_mapping(globalReliability / currScale));

	float reliability = fittingCoeff * min(globalReliability, localReliability);
    if (reliability > 1.0)
        reliability = exp(reliability - 1.0);
    reliability *= cascadeBase;

//    gl_FragColor.rgb = vec3(reliability);
//    return;
	
	// allow re-weighting to be disabled esily for the viewer demo
	if (oneOverK < 1.e6) {
        gl_FragColor.rgb = vec3(luminance(gl_FragColor));
        gl_FragColor.rgb = min(gl_FragColor.rgb, reliability); // todo: rescale components
    }
}

/* This source code may be used freely under either the CC0 license (public domain)
   or the MIT License, i.e. with or without copyright notice.
*/
/*
   Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in the
Software without restriction, including without limitation the rights to use, copy,
modify, merge, publish, distribute, sublicense, and/or sell copies of the Software,
and to permit persons to whom the Software is furnished to do so, subject to the
following conditions:

   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.

*/