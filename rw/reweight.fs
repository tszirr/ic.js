uniform vec2 cropOffset;
uniform vec2 size;

uniform sampler2D picture;
uniform bool hasPicture;
uniform bool hasMore;

uniform sampler2D prev;
uniform sampler2D curr;
uniform sampler2D next;

uniform float oneOverK;
uniform float currScale;
uniform float cascadeBase;

float luminance(vec4 c) {
	// match what you have in the renderer
	return dot(c.xyz, vec3(0.212671, 0.715160, 0.072169));
	// e.g. also possible: return max(max(c.x, c.y), c.z);
}

vec4 sampleLayer(sampler2D layer, vec2 coord, vec2 size, const int r, float scale) {
	vec4 val = vec4(0);
	int y = -r;
	for (int i = 0; i < 3; ++i) {
		int x = -r;
		for (int j = 0; j < 3; ++j) {
			vec4 c = texture2D(layer, (coord + vec2(x, y)) / size, 0.);
			c *= scale;
			val += c;
			if (++x > r) break;
		}
		if (++y > r) break;
	}
	return val;
}

float sampleReliability(vec2 coord, vec2 size, const int r) {
	vec4 rel = sampleLayer(curr, coord, size, r, currScale);
	if (hasPicture)
		rel += sampleLayer(prev, coord, size, r, currScale * cascadeBase);
	if (hasMore)
		rel += sampleLayer(next, coord, size, r, currScale / cascadeBase);
	return luminance(rel);
}

void main() {
	vec2 c = gl_FragCoord.xy - cropOffset;

	// current result
	if (hasPicture)
		gl_FragColor = texture2D(picture, c/size, 0.);
	else
		gl_FragColor = vec4(0);

	float optimizeForError = max(min(oneOverK, 1.), .0);

	float globalReliability = sampleReliability(gl_FragCoord.xy, size, 1);
	float localReliability = sampleReliability(gl_FragCoord.xy, size, 0);

	float reliability = globalReliability - oneOverK;
	if (reliability >= 0.)
		reliability = min(reliability, localReliability - oneOverK);

	float betterVarianceOrLessBias = mix(mix(1., cascadeBase, .6), 1., optimizeForError);
	float colorReliability = max(luminance(gl_FragColor) * currScale * betterVarianceOrLessBias, .05 * currScale);
	
	reliability = (reliability + colorReliability) * .5;
	reliability = clamp(reliability, 0., 1.);
	
	gl_FragColor += reliability * texture2D(curr, c/size, 0.);
}