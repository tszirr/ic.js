uniform vec2 cropOffset;
uniform vec2 size;

uniform sampler2D picture; // accumulated so far
uniform bool hasPicture;   // not the lowest layer
uniform bool hasMore;      // more higher layers in the cascade

uniform sampler2D prev; // lower layer in the cascade
uniform sampler2D curr; // current layer in the cascade
uniform sampler2D next; // higher layer in the cascade

uniform float oneOverK;    // 1/kappa
uniform float currScale;   // N/kappa / b^i_<curr>;
uniform float cascadeBase; // b

float luminance(vec4 c) {
	// match what you have in the renderer
	return dot(c.xyz, vec3(0.212671, 0.715160, 0.072169));
	// e.g. also possible: return max(max(c.x, c.y), c.z);
}

// average of <r>-radius pixel block in <layer> at <coord> (only using r=0 and r=1)
vec4 sampleLayer(sampler2D layer, vec2 coord, vec2 size, const int r, float scale) {
	vec4 val = vec4(0);
	int y = -r;
	for (int i = 0; i < 3; ++i) { // WebGL requires static loops
		int x = -r;
		for (int j = 0; j < 3; ++j) { // WebGL requires static loops
			vec4 c = texture2D(layer, (coord + vec2(x, y)) / size, 0.);
			c *= scale;
			val += c;
			if (++x > r) break;
		}
		if (++y > r) break;
	}
	return val / float((2*r+1)*(2*r+1));
}

// sum of reliabilities in <curr> layer, <prev> layer and <next> layer
float sampleReliability(vec2 coord, vec2 size, const int r) {
	vec4 rel = sampleLayer(curr, coord, size, r, currScale);
	if (hasPicture)
		// scale by N/kappa / b^i_<pref>
		rel += sampleLayer(prev, coord, size, r, currScale * cascadeBase);
	if (hasMore)
		// scale by N/kappa / b^i_<next>
		rel += sampleLayer(next, coord, size, r, currScale / cascadeBase);
	// reliability is simply the luminance of the brightness-normalized layer pixels
	return luminance(rel);
}

void main() {
	vec2 c = gl_FragCoord.xy - cropOffset;

	// current result (final composition of layers up to <curr>)
	if (hasPicture)
		gl_FragColor = texture2D(picture, c/size, 0.);
	else
		gl_FragColor = vec4(0);

	/* sample counting-based reliability estimation */

	// reliability in 3x3 pixel block (see robustness)
	float globalReliability = sampleReliability(gl_FragCoord.xy, size, 1);
	// reliability of curent pixel
	float localReliability = sampleReliability(gl_FragCoord.xy, size, 0);

	float reliability = globalReliability - oneOverK;
	// check if above minimum sampling threshold
	if (reliability >= 0.)
		// then use per-pixel reliability
		reliability = localReliability - oneOverK;

	/* color-based reliability estimation */

	float colorReliability = luminance(gl_FragColor) * currScale;

	// a minimum image brightness that we always consider reliable
	colorReliability = max(colorReliability, 0.05 * currScale);

	// if not interested in exact expected value estimation, can usually accept a bit
	// more variance relative to the image brightness we already have
	float optimizeForError = max(.0, min(1., oneOverK));
	// allow up to ~<cascadeBase> more energy in one sample to lessen bias in some cases
	colorReliability *= mix(mix(1., cascadeBase, .6), 1., optimizeForError);
	
	reliability = (reliability + colorReliability) * .5;
	reliability = clamp(reliability, 0., 1.);
	
	// allow re-weighting to be disabled esily for the viewer demo
	if (!(oneOverK < 1.e6))
		reliability = 1.;

	gl_FragColor += reliability * texture2D(curr, c/size, 0.);
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