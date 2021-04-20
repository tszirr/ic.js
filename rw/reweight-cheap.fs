uniform vec2 cropOffset;
uniform vec2 size;

uniform bool hasMore;      // more higher layers in the cascade

uniform sampler2D curr; // current layer in the cascade
uniform sampler2D next; // higher layer in the cascade

uniform float oneOverK;    // 1/kappa
uniform float currScale;   // N/kappa
uniform float cascadeBase; // lowest level brightness

uniform bool colorCorrection;

#define LUMINANCE_NRM vec3(0.212671, 0.715160, 0.072169)
float luminance(vec3 c) {
	// match what you have in the renderer
	return dot(c, LUMINANCE_NRM);
	// e.g. also possible: return max(max(c.x, c.y), c.z);
}

// average of <r>-radius pixel block in <layer> at <coord> (only using r=0 and r=1)
vec3 sampleReliability(vec2 coord, vec2 size, const int r) {
	vec3 val = vec3(0.0);
	int y = -r;
	for (int i = 0; i < 3; ++i) { // WebGL requires static loops
		int x = -r;
		for (int j = 0; j < 3; ++j) { // WebGL requires static loops
            vec2 cc = (coord + vec2(x, y)) / size;
			vec3 c = hasMore ? texture2D(next, cc, 0.).rgb : texture2D(curr, cc, 0.).aaa;
			val += c;
			if (++x > r) break;
		}
		if (++y > r) break;
	}
	return val / float((2*r+1)*(2*r+1));
}

vec3 mapping(vec3 x) {
	for (int i = 0; i < 3; ++i)
		if (x[i] > 1.0)
			x = 1.0 + log(x);
	return x;
}
vec3 inverse_mapping(vec3 x) {
    for (int i = 0; i < 3; ++i)
		if (x[i] > 1.0)
			x = exp(x - 1.0);
	return x;
}

float minComponent(vec3 x) {
	return min(min(x.x, x.y), x.z);
}
float maxComponent(vec3 x) {
	return max(max(x.x, x.y), x.z);
}

void main() {
	vec2 c = gl_FragCoord.xy - cropOffset;

	// current result
	gl_FragColor = texture2D(curr, c/size, 0.);

	/* sample counting-based reliability estimation */

	// reliability in 3x3 pixel block (see robustness)
	vec3 globalReliability = sampleReliability(gl_FragCoord.xy, size, 1);
	// reliability of curent pixel
	vec3 localReliability = sampleReliability(gl_FragCoord.xy, size, 0);

	vec3 reliability = globalReliability;
	/*if (reliability > 0.0)*/ {
		//vec3 fittingEstimate = max(inverse_mapping(reliability), vec3(1.0));
		//vec3 fittingCoeff = mapping(fittingEstimate)
		//    / mapping(currScale * fittingEstimate);
		vec3 warpedDev = mapping(gl_FragColor.xyz / cascadeBase - inverse_mapping(reliability));
		vec3 fittingCoeff = reliability / max(warpedDev, reliability + 0.00001);
		fittingCoeff = max(fittingCoeff, sqrt(1.0 / currScale));

		reliability = currScale * fittingCoeff * min(globalReliability, localReliability);
		reliability = inverse_mapping(reliability);
		reliability *= cascadeBase;
	}

//    gl_FragColor.rgb = vec3(reliability);
//    return;
	
	// allow re-weighting to be disabled esily for the viewer demo
	if (oneOverK < 1.e6) {
        if (!hasMore)
            gl_FragColor.rgb = vec3( luminance(gl_FragColor.rgb) );
        vec3 clamped = min(gl_FragColor.rgb, reliability);

		// color correction
		float colorBase = minComponent(clamped);
		float colorSpan = maxComponent(clamped) - colorBase;
		if (colorCorrection && colorSpan > 0.001) {
			vec3 clampingColor = inverse_mapping(localReliability);
			float satc = 1.0 - minComponent(clampingColor) / maxComponent(clampingColor);
			// note: this leads to quite a bit of color variance!
			float sato = 1.0 - minComponent(gl_FragColor.rgb) / maxComponent(gl_FragColor.rgb);
			satc = max(satc, sato);
			if (1.0 - satc > 0.001) {
				float maxCorrection = (satc * colorBase) / (colorSpan * (1.0 - satc));
				if (maxCorrection < 1.0) {
					if (true)
						clamped = maxCorrection * (clamped - vec3(colorBase)) + vec3(colorBase);
					else {
						float correction = satc * (colorSpan * maxCorrection + colorBase);
						//correction /= (clamped - vec3(colorBase));
						//clamped = correction * (clamped - vec3(colorBase)) + vec3(colorBase);
						clamped = min(clamped, vec3(correction + colorBase));
					}
				}
			}
		}

		gl_FragColor.rgb = 2.0 * gl_FragColor.rgb / (gl_FragColor.rgb / clamped + 1.0);
		//gl_FragColor.rgb = inverse_mapping( 2.0 * mapping(gl_FragColor.rgb) / (mapping(gl_FragColor.rgb) / mapping(clamped) + 1.0) );
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