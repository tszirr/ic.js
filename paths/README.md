# ic.js/paths - Monte Carlo Path Visualization

![Example visualization for paths sampled in MCMC with and without stratification for the flashlight scene](http://alphanew.net/extern/github/icjs-path-vis.jpg)

A simplistic light transport path visualizer, visually comparing two representative subsets of paths sampled in a Monte Carlo simulation.

### CSV output format (Example for mitsuba)

```C++
std::ostringstream line;
// MC weight (RGB color)
line << value[0] << ", " << value[1] << ", " << value[2] << ",\n"
// Vertex count (excluding virtual 2nd camera & emitter vertices)
	<< current->vertexCount() - 2 << "\n";
// Coordinates of path vertices (excluding virtual 2nd camera & emitter vertices)
for (int i = 1, ie = (int) current->vertexCount() - 1; i < ie; ++i) {
	Point p = current->vertex(i)->getPosition();
	line << ",\t" << p[0] << ", "<< p[1] << ", " << p[2];
}
line << ",\n";
```

### Based on ###

This implementation would not have been possible without the work of many others, in particular the following existing codebases:
* [three.js](https://github.com/mrdoob/three.js)
* [dat.gui](https://github.com/dataarts/dat.gui)
