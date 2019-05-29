#version 300 es

uniform sampler2D displaceTex, correctionOffsetTex;
uniform ivec2 resolution; uniform vec2 pixelWidth;

uniform float displacementScale;
uniform float fixHeight;
uniform float fixInterval;
uniform bool fixBoundary;

uniform int iterationIdx;

out vec4 newCorrectionOffset;

float lengthSquared(vec2 x) { return dot(x,x); }

// CODE VIEW:
float areaPreservePow(float x) { return x * x * x; }
float areaPreservePowDeriv(float x) { return 3.0 * x * x; }

vec2 computeGradient(vec3 dnpos1, vec3 dnpos2,
	vec2 dnuv1, vec2 dnuv2, out float energy) {
	float adpos = length(cross(dnpos1, dnpos2));
	float aduv = dnuv1.x * dnuv2.y - dnuv2.x * dnuv1.y;

	float energyPart1 = 1.0 / (adpos * aduv);
	float energyPart2 =
		  lengthSquared(dnuv1 - dnuv2) * dot(dnpos1, dnpos2)
		+ lengthSquared(dnuv1) * dot(dnpos2 - dnpos1, dnpos2)
		+ lengthSquared(dnuv2) * dot(dnpos1, dnpos1 - dnpos2);
	float energyPart3Inner = adpos / aduv + aduv / adpos;
	float energyPart3 = areaPreservePow(energyPart3Inner);

	energy = energyPart1 * energyPart2 * energyPart3;
	return
		energyPart3 * (
		  (energyPart2 * energyPart1 / aduv)
		    * -vec2(dnuv2.y - dnuv1.y, dnuv1.x - dnuv2.x)
		  + energyPart1 * 2.0 * (
			  (dnuv1) * dot(dnpos2 - dnpos1, dnpos2)
			+ (dnuv2) * dot(dnpos1, dnpos1 - dnpos2)
		  )
		)
		+ energyPart1 * energyPart2 * (
		    areaPreservePowDeriv(energyPart3Inner)
		  * vec2(dnuv2.y - dnuv1.y, dnuv1.x - dnuv2.x)
		  * (1.0 / adpos - adpos / (aduv * aduv))
		);
}

float computeEnergy(vec3 dnpos1, vec3 dnpos2
	, vec2 dnuv1, vec2 dnuv2) {
	float energy;
	computeGradient(dnpos1, dnpos2, dnuv1, dnuv2, energy);
	return energy;
}

vec2 computePinningGradient(vec2 duv, float pinned, out float energy) {
	vec2 mobilityCoeff = pinned * vec2(resolution);
	float mobilityEnergyCoeff = 1.0 / max(1.0 - lengthSquared(duv * mobilityCoeff), 0.5e-32);
	energy = 0.5 * mobilityEnergyCoeff;
	return mobilityEnergyCoeff * mobilityEnergyCoeff * (duv * mobilityCoeff * mobilityCoeff);
}

bool onGlobalBorder(ivec2 c) {
	return c.x == 0 || c.y == 0 || c.x == resolution.x - 1 || c.y == resolution.y - 1;
}
