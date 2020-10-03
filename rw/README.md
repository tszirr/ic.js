# ic.js/rw - Reweighting Firefly Samples for Improved Finite-Sample Monte Carlo Estimates

[![Online Tool](https://cg.ivd.kit.edu/publications/2018/rwmc/tool.jpg)](https://cg.ivd.kit.edu/publications/2018/rwmc/tool/rw.html)
[![Example for the bathroom scene](https://cg.ivd.kit.edu/publications/2018/rwmc/bathroom.jpg)](https://cg.ivd.kit.edu/publications/2018/rwmc/tool/rw.html?example=bathroom)
[![Example for the flashlight scene](https://cg.ivd.kit.edu/publications/2018/rwmc/flashlight.jpg)](https://cg.ivd.kit.edu/publications/2018/rwmc/tool/rw.html?example=flashlight)
[![Example for the torus scene](https://cg.ivd.kit.edu/publications/2018/rwmc/torus.jpg)](https://cg.ivd.kit.edu/publications/2018/rwmc/tool/rw.html?example=torus)

An implementation of the Monte Carlo Outlier / "Firefly" Handling
technique by re-weighting of framebuffer cascades, as described in
the paper
[Reweighting Firefly Samples for Improved Finite-Sample Monte Carlo Estimates](https://cg.ivd.kit.edu/rwmc.php).

### HDR Image Utilities ###

In this repository, you find the following additional HDR image processing modules:
* [EXRLoader.js](EXRLoader.js): added ZIP decoding (based on [pako](https://github.com/nodeca/pako)), fixed PIZ decoding, basic image writer (for saving/downloading HDR images)
* [PFMLoader.js](PFMLoader.js): Loader for the [PFM image format](http://www.pauldebevec.com/Research/HDR/PFM/)

### Based on ###

This implementation would not have been possible without the work of many others, in particular the following existing codebases:
* [EXRLoader.js](https://github.com/mrdoob/three.js/blob/dev/examples/js/loaders/EXRLoader.js) (extended in this repo by fixed PIZ, ZIP decoding & basic writer)
* [pako](https://github.com/nodeca/pako)
* [three.js](https://github.com/mrdoob/three.js)
* [dat.gui](https://github.com/dataarts/dat.gui)
