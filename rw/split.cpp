/*
  This code can be used in any Monte Carlo renderer to produce the
  framebuffer cascades processed and displayed by the reweighting tool:
  http://cg.ivd.kit.edu/publications/2018/rwmc/tool/rw.html
*/

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