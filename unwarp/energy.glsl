#version 300 es

uniform sampler2D displaceTex, correctionOffsetTex;
uniform ivec2 resolution; uniform vec2 pixelWidth;

uniform float displacementScale;
uniform float fixHeight;
uniform float fixInterval;
uniform bool fixBoundary;

uniform int iterationIdx;

out vec4 newCorrectionOffset;

float areaPreservePow(float x) { return x * x * x; }
float areaPreservePowDeriv(float x) { return 3.0 * x * x; }

float lengthSquared(vec2 x) { return dot(x,x); }

vec2 computeGradient(vec3 dnpos1, vec3 dnpos2,
	vec2 dnuv1, vec2 dnuv2, out float energy)
{
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
	, vec2 dnuv1, vec2 dnuv2)
{
	float energy;
	computeGradient(dnpos1, dnpos2, dnuv1, dnuv2, energy);
	return energy;
}

float mixExp(float a, float b, float s) {
	return pow(a, 1.0 - s) * pow(b, s);
}
vec2 mixExp(vec2 a, vec2 b, float s) {
	return pow(a, vec2(1.0 - s)) * pow(b, vec2(s));
}

struct Node {
	vec3 pos;
	vec2 uv;
	vec2 uvo;
	float pinned;
};
Node fetchNode(vec2 coord)
{
	Node n;
	coord *= pixelWidth;
	vec2 wrapCoord = fract(coord);
	float height = textureLod(displaceTex, wrapCoord, 0.0).x;
	n.pos = vec3(coord, displacementScale * height);
	n.uvo = textureLod(correctionOffsetTex, wrapCoord, 0.0).xy;
	n.pinned = fixInterval > 0.0 ? max(1.0 - abs(height - fixHeight) / fixInterval, 0.0) : 0.0; // textureLod(pinTex, wrapCoord, 0.0).x;
	n.uv = n.uvo + coord;
	return n;
}

bool onGlobalBorder(ivec2 c)
{
	return c.x == 0 || c.y == 0 || c.x == resolution.x - 1 || c.y == resolution.y - 1;
}

#if 1

vec2 computePinningGradient(vec2 duv, float pinned, out float energy) {
	vec2 mobilityCoeff = 0.1 * pinned * vec2(resolution);
	float mobilityEnergyCoeff = 1.0 / max(1.0 - lengthSquared(duv * mobilityCoeff), 0.0);
	energy = 0.5 * mobilityEnergyCoeff;
	return mobilityEnergyCoeff * mobilityEnergyCoeff * (duv * mobilityCoeff * mobilityCoeff);
}

#else

vec2 computePinningGradient(vec2 duv, float pinned, out float energy) {
  float maxMobility = pinned > 0.0 ? min(0.01 / pinned, 1.0) : 1.0;
	float mobilityEnergyCoeff = maxMobility / max(maxMobility * maxMobility - lengthSquared(duv), 0.0);
	energy = 0.5 * maxMobility * mobilityEnergyCoeff;
	return mobilityEnergyCoeff * mobilityEnergyCoeff * duv;
}

#endif