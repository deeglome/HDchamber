# HDchamber (Hyper-Dimensional Chamber)

<p align="center">
  <img src="./public/logotype_full_pathed.svg" alt="Logo" width="500px">
</p>

> 🆕 **HDchamber isn't just vanilla JavaScript anymore!**

HDchamber is a rendering environment built in THREE.js and partly compiled in WebAssembly using Emscripten and Eigen. It's a place where geometric figures from higher dimensions are brought to life and can be studied. HDchamber page is online and hosted on [Netlify](https://hdchamber.netlify.app/).

## Features

- Real-time rendering of hyper-dimensional geometric objects with adjustable dimension count (from 2D up to 6D).
- Geometries handler menu
- Rotation handler menu
- Wiki for each geometry
- Orbit Controls and zoom
- Color Mapping Mode
- Axes Mode
- Cross Section Mode

## Currently supported geometries

- **Hypercube**: the n-dimensional analog of square and cube.

- **Simplex**: the n-dimensional analog of equilateral triangle and regular tetrahedron.

- **Hypersphere**: the n-dimensional analog of circle and sphere.

- **Torus**: the n-dimensional analog of annulus and torus in 3D.

- **Orthoplex**: the n-dimensional analog of square and regular octahedron.

- **Hyperspherinder**: the n-dimensional analog of cylinder. It's an extrusion of a (n-1)-hypersphere along the last dimension.

- **Hypercone**: the n-dimensional analog of cone whose basis is a (n-1)-hypersphere.

## How to Run HDchamber Locally!

### Requirements

1) An IDE or Text Editor like [Visual Studio Code](https://code.visualstudio.com/)
2) [Eigen C++ library](https://libeigen.gitlab.io/) used by `geolib.cpp` for linear algebra computations. If you're using Linux you can install it from your distro package manager. Alternatively, you can clone the repo from the link
3) [Emscripten](https://emscripten.org/docs/getting_started/downloads.html) to compile `wasm.cpp` in WebAssembly
4) [npm](https://www.npmjs.com/package/npm) to run your localhost

### Getting Started
Clone HDchamber repo to your local machine using the following command:

```bash
# Replace '/path/to/HDchamber' with your real path (for instance '~/HDchamber')
git clone -b wasm-three https://github.com/deeglome/HDchamber.git /path/to/HDchamber
```

Next, run these commands in your directory:

```bash
# In /path/to/HDchamber
npm install;
cd src;
make wasm;
npm run dev;
```

Make sure `Makefile` constants are matched. These are the default values:

```bash
# In /path/to/HDchamber/src/Makefile
EIGEN = /usr/include/eigen3
EMSDK = ~/emsdk
```

That's all! Enjoy analyzing higher dimensions!
