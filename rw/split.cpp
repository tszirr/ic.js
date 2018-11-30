/* allocate a cascade of framebuffers for your samples */
int const cascadeBufferCount = 6;              // paper default value
Framebuffer cascadeBuffers[cascadeBufferCount];
float cascadeStart = 1;                        // paper default value
float cascadeBase = 8;                         // paper default value

struct CascadeSlice {
    Framebuffer *lower, *upper;
    float weightLower, weightUppper;
};

/* add your samples to the returned two framebuffers,
   weighted by the corresponding returned weights */
CascadeSlice getCascadeSliceForSampleLuminance(float luminance) {
    float lowerScale = cascadeStart;
    float upperScale = lowerScale * cascadeBase;
    int baseIndex = 0;

    /* find adjacent layers in cascade for <luminance> */
    for ( ; !(luminance < upperScale) && baseIndex < cascadeBufferCount - 1; ++baseIndex) {
        lowerScale = upperScale;
        upperScale *= cascadeBase;
    }

    // buffers are (<baseIndex>, <baseIndex>+1)
    CascadeSlice slice = { cascadeBuffers[baseIndex], cascadeBuffers[baseIndex+1] };

    /* weight for lower buffer */
    if (luminance <= lowerScale)
        slice.weightLower = 1.0f;
    else if (luminance < upperScale)
        slice.weightLower = std::max( 0.0f,
            (lowerScale / luminance - lowerScale / upperScale) / (1 - lowerScale / upperScale) );
    else // Inf, NaN ...
        slice.weightLower = 0.0f;
    
    /* weight for higher buffer */
    if (luminance < upperScale)
        slice.weightUppper = std::max(0.0f, 1 - slice.weightLower);
    else // out of cascade range, we don't expect this to converge
        slice.weightUppper = upperScale / luminance;

    return slice;
}