# ic.js - Monte Carlo Render Viewing and Visualization Tools

This repository contains three.js-based WebGL/JavaScript tools
for visualizing various aspects of Monte Carlo Light Transport
in any modern browser.

Currently, the repository contains the following tools:
* [rw](rw):
An implementation of the Monte Carlo Outlier / "Firefly" Handling
technique by re-weighting of framebuffer cascades, as described in
the paper
[Reweighting Firefly Samples for Improved Finite-Sample Monte Carlo Estimates](https://cg.ivd.kit.edu/rwmc.php) (CGF 2018).
* [paths](paths):
A visualization tool for light transport paths constructed by e.g.
Monte Carlo Rendering algorithm.

Besides, because of shared code ancestry, the repository contains the following additional WebGL projects:
* [unwarp](unwarp):
An implementation of the distortion unwarping for displacement mapping
as described in the paper
[Distortion-free Displacement Mapping](https://cg.ivd.kit.edu/undistort.php) (HPG 2019).
