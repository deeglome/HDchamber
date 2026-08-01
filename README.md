# HDchamber (Hyper-Dimensional Chamber)

<p align="center">
  <img src="./public/logotype_full_pathed.svg" alt="Logo" width="500px">
</p>

> 🆕 **HDchamber isn't just vanilla JavaScript anymore!**

HDchamber is a rendering environment built in THREE.js and partly compiled in WebAssembly using Emscripten. It's a place where geometric figures from higher dimensions are brought to life and can be studied. HDchamber page is online and hosted on [Netlify](https://hdchamber.netlify.app/).

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

Install an IDE or Text Editor like [Visual Studio Code](https://code.visualstudio.com/) if you haven't already.
Then clone HDchamber repo to your local machine using the following command (in bash shell):
```bash
# Replace /path/to with your real path
git clone https://github.com/deeglome/HDchamber.git /path/to/HDchamber
```

Also, you need to install Emscripten to compile `wasm.cpp` in WebAssembly. Start cloning its repo:
```bash
# Get the emsdk repo
git clone https://github.com/emscripten-core/emsdk.git /path/to/emsdk

# Enter that directory
cd emsdk
```
Run the following emsdk commands to get the latest tools from GitHub and set them as active:
```bash
# Fetch the latest version of the emsdk (not needed the first time you clone)
git pull

# Download and install the latest SDK tools.
./emsdk install latest

# Make the "latest" SDK "active" for the current user. (writes .emscripten file)
./emsdk activate latest

# Activate PATH and other environment variables in the current terminal
source ./emsdk_env.sh
```
All Emscripten guidelines are taken from its official [Documentation](https://emscripten.org/docs/getting_started/downloads.html). You can check there if you want.

Last but not least, since every time you'll open a new terminal you'll also have to activate Emscripten, I suggest you create an alias in your `.bashrc` file like the following:
```bash
# In .bashrc
alias emcc-activate='source /path/to/emsdk/emsdk_env.sh'
```
Next, run these commands in your directory (make sure you've already installed `npm`!):
```bash
# In /path/to/HDchamber
npm install;
cd src;

# After you've already run 'emcc-activate'
make wasm;
npm run dev;
```
That's all! Enjoy analyzing higher dimensions!
