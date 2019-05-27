#define NUM_NEIGHBORS 6

ivec2 currentCoord = ivec2(gl_FragCoord.xy);
Node currentNode = fetchNode(gl_FragCoord.xy);

vec3 dnpos[NUM_NEIGHBORS];
vec2 dnuv[NUM_NEIGHBORS];
{	int i = 0;
	for (ivec2 co = ivec2(-1); co.y <= 1; ++co.y) {
		for (co.x = -1; co.x <= 1; ++co.x) {
			if (co.x != co.y) {
				Node nn = fetchNode(gl_FragCoord.xy + vec2(co));
				// handle pinned nodes
				nn.pos.z = mix(nn.pos.z, currentNode.pos.z, nn.pinned);
				nn.uv = mix(nn.uv, nn.pos.xy, nn.pinned);
				// compute the neighbor index
				int nbidx = i; // i = 0,1
				if (co.y == 0) nbidx = (co.x == -1) ? 5 : 2;
				else if (i >= 4) nbidx = 8 - i; // i = 4,5 -> nbidx = 4,3
				// compute the neighbor offsets
				dnpos[nbidx] = currentNode.pos - nn.pos;
				dnuv[nbidx] = currentNode.uv - nn.uv;
				++i;
			}
		}
	}
}

float energy = 0.0; // in case you want to see it
vec2 gradient = vec2(0.0);
// compute energy gradient for each neighbor triangle
for (int i = 0, j = NUM_NEIGHBORS - 1; i < NUM_NEIGHBORS; j = i++) {
	float neighborEnergy;
	gradient += pixelWidth * computeGradient(
		dnpos[j], dnpos[i], dnuv[j], dnuv[i], neighborEnergy);
	energy += neighborEnergy;
}
energy *= 0.5 / float(NUM_NEIGHBORS);

float maxStepSize = 0.0;
// compute maximum step size (before triangle flips)
for (int i = 0, j = NUM_NEIGHBORS - 1; i < NUM_NEIGHBORS; j = i++) {
	float aduv = dnuv[j].x * dnuv[i].y - dnuv[i].x * dnuv[j].y;
	float djXg = dnuv[j].x * gradient.y - gradient.x * dnuv[j].y;
	float dgXi = gradient.x * dnuv[i].y - dnuv[i].x * gradient.y;
	float den = djXg + dgXi;
	if (den > 0.0) {
		float aduv0offset = aduv / den;
		if (maxStepSize > 0.0)
		     maxStepSize = min(maxStepSize, aduv0offset);
		else maxStepSize = aduv0offset;
	}
}

float minStepSize = 0.0;
int maxSearchSteps = 20;
// Perform ternary search on gradient line to find optimum
while (maxStepSize - minStepSize > 1.0e-6 * maxStepSize && --maxSearchSteps != 0) {
	float third1 = mix(minStepSize, maxStepSize, 1.0 / 3.0);
	float third2 = mix(minStepSize, maxStepSize, 2.0 / 3.0);
	vec2 duv1 = third1 * gradient, duv2 = third2 * gradient;
	
	float e1 = 0.0, e2 = 0.0;
	for (int j = NUM_NEIGHBORS - 1, i = 0; i < NUM_NEIGHBORS; j = i++) {
		e1+=computeEnergy(dnpos[j],dnpos[i],dnuv[j]-duv1,dnuv[i]-duv1);
		e2+=computeEnergy(dnpos[j],dnpos[i],dnuv[j]-duv2,dnuv[i]-duv2);
	}
	if (e1 < e2) maxStepSize = third2;
	else minStepSize = third1;
}
float stepSize = mix(minStepSize, maxStepSize, 0.5);

// boundary handling
float mobility = 1.0 - currentNode.pinned;
if (fixBoundary && onGlobalBorder(currentCoord)) mobility = 0.0;
stepSize *= mobility;

newCorrectionOffset = currentNode.uvo.xyxy;
// ensure convergence by only ever moving 1 vertex per neighborhood
if (   (currentCoord.x & 1) == (iterationIdx & 1)
    && (currentCoord.y & 1) == ((iterationIdx >> 1) & 1) )
	newCorrectionOffset.xy -= stepSize * gradient;
