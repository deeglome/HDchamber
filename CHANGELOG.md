# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### ...

## [1.5.0-beta] - 2026-01-31

## EXTERNAL

### Added

- **Credits** at the bottom right along with version. It also includes a link to HDchamber repo on GitHub.

- **New Pause/Resume button**: now animation can be stopped and resumed with this button.

- **New Zoom In/Out buttons** for better experience in zooming from mobile devices.

- **A maximum and minimum** value for rotation speed (min = -3; max = 3).

- **First rotation tools** in rotation dropmenu:
  - Generate random rotation
  - Clear rotation (resets everything to zero).

- **Logic** to update **axes button icons**.

### Changed

- **Font** from Verdana to Chakra Petch.

- **Opacity** of version and credits.

- **Button icons with new ones**: now most of them are "homemade" and with *.svg extension.

- **Logo**

- **Zoom threshold**: now zooming with mouse wheel is more natural and easier.

## INTERNAL

### Fixed

- **Rendering animation**: now tic() function is invoked recursively only when there is an actual rotation. Other features are frozen until next resume, though. 

## [1.4.1-beta] - 2025-07-09

## EXTERNAL

### Changed

- **GUI icons**: perspective/orthogonal view icon, wiki icon, cross section mode icon, last-coordinate mode icon.

- **Wikipage transition**: Introduces a toggleWikipage function to handle showing and hiding the wiki page with a transition effect. Updates the wiki button click handler to use this new function for improved UI behavior.

### Fixed

- **Rotation dropmenu bug**: Using addEventListener('click', ...) was causing multiple event handlers to stack when the script ran more than once, leading to duplicated toggles. This made the dropdown instantly open and close on even-numbered clicks. Replaced it with onclick assignment to ensure only one handler is attached at a time and restore expected toggle behavior.

## [1.4.0-beta] - 2025-07-08

## EXTERNAL

### Added

- **Axes button feature**: now axes button actually works.
  Added three modes:
    - Axes off
    - Axes on and constrained to world
    - Axes on and constrained to mesh

- **Last-coordinate mode**: it shows the last-coordinate value of every vertex next to each one.

- **Camera handler button (with no feature)**: a button that will control position and orientation of the camera.

- **Technical data**: a panel located at the bottom left of the GUI and shows which hyperplane cuts the mesh with its equation. This panel will be multi-purpose in the future.

- **favicon.ico**

- **Dynamic title**: now it shows the name of the animated mesh and in which number of dimensions is rotating.

- **CSS responsiveness** for mobile devices.

### Changed

- **README.md**: now it also contains the Netlify link, features, currently supported meshes and a guide to download HDchamber locally.

- **Rotation dropmenu**: now all of possible plane buttons are generated and set to 0 and each label is followed by its angular speed value (e.g. "XY | 0.49"). Removed '+' and '-' buttons.

- **Rotation scope logic**: now only planes with non-zero speed are considered.

## INTERNAL

### Changed

- **Code refactoring**: see commits to deepen.

### Removed

- **Hypersphere flatCells**: they were too difficult to implement.

## [1.3.0-alpha] - 2025-04-17

## EXTERNAL

### Added

- **Cross-section mode**: introduced support for cross-sectional visualization of multidimensional shapes intersected by hyperplanes. This includes a new cross-section.js module and integration with rendering logic. A new toolbar button enables or disables this mode dynamically.

- **Integrated Wiki system**: users can now access rich documentation for each mesh directly within the interface. This is powered by the new wiki.json file and dynamic UI rendering inside the wikipage panel.

- **Humanized mesh names**: technical mesh names (e.g., "4-Hypercube") are now automatically converted into human-readable labels (e.g., "Tesseract") throughout the UI via a new humanizeMeshName() function using Wiki data.

- **Mouse wheel zoom**: users can zoom in and out of the rendering canvas using the scroll wheel. The system handles thresholding and smooth scale control in app.js.

- **New buttons and icons**: added several toolbar buttons for cross-section mode, Wiki panel, and upcoming features like axis display and color mapping. Icons have been included in the icons/ directory and wired to the UI via index.html and CSS transitions.

- **Opacity management for cross-sections**: when cross-section mode is enabled, the background mesh is now rendered with softened opacity using goniometric transitions to enhance depth perception.

## INTERNAL

### Changed

- **Renamed** the data file from info.json to wiki.json to better reflect its function as a Wiki source.

- **Refactored mesh initialization logic**: replaced direct constructor calls (like new Hypercube) with a new selectMesh() dispatch function for improved clarity and modularity in app.js.

- **Mesh label rendering**: improved the < h1 > display title to use humanized names via Wiki metadata rather than raw technical identifiers (e.g., 4-Hypercube → Tesseract).

### Fixed

- **Dropmenu transition bug**: fixed an issue where mesh selector dropdowns would remain visible or misalign after toggling; now using transitionend events to toggle display: none cleanly.

- **Fallback Wiki behavior**: addressed crashes from missing Wiki data by introducing writeDefaultWikiPage() for meshes not yet included in wiki.json.

## [1.2.0-alpha] - 2025-03-27

## INTERNAL

### Added

- **Global object (app)**: a new global object named "app" has been introduced for centralized state and configuration management.
  Properties include:

  - initialTime, finalTime, and deltaTime for tracking and calculating time intervals.

  - angularSpeed for managing rotation speed.

  - dimensionsToRender alongside MIN_DIMENSIONS and MAX_DIMENSIONS for setting and validating dimensions.

  - isRendering to indicate the rendering state.

  - guiHandlers containing settings for GUI interactions such as projection mode, mesh selection, dimension selection, and rotation configuration.

- **Global constants**: CONTEXT_DIMENSION, DEPTH_MAPPING_DIMENSION, COLOR_MAPPING_DIMENSION, MAX_DRAWN_POINT_SIZE, BRIGHTNESS, FOG.

- **rotationScope(planes) function**: the rotationScope function added in geolib.js is designed to calculate the minimum context size required to handle rotations based on the axes provided.

- **SingletonMatrix.extendIn(dimensions)**: the function SingletonMatrix.extendIn(dimensions) is designed to adjust the size of the matrix managed by the SingletonMatrix class so that it conforms to a specified number of dimensions.

- **Integration of tools**: tools such as ESLint and Prettier have been added to ensure higher coding standards.

### Changed

- **Code refactoring**: properly renamed variables to maintain consistency (e.g. “shape” -> “mesh”). Better described the meaning of the conditions (e.g. instead of “this.nthDimension() > 2” it is preferable to write “this.nthDimension() >= DEPTH_MAPPING_DIMENSION” where “DEPTH_MAPPING_DIMENSION” = 3)

- **PointND.projectInto() method**: in the previous implementation, the projectInto() method relied on creating a temporary matrix for dimension reduction, involving manual transformations through nested loops or predefined matrices. The updated version replaces this with the .map method, enabling direct transformations of vertex coordinates. This change has improved the code’s clarity, efficiency, and performance by removing the need for temporary matrix creation and streamlining the logic for projections, whether orthogonal or perspective.

### Deprecated

- **Translation matrix**: translation matrices are a much more complex solution to a simple coordinate mapping of a point and can generate errors in the parameters of the “matrixPointMultiplication(matrix, point)” function.

## [1.1.0-alpha] - 2025-03-02

## EXTERNAL

### Added

- **Dimension handler button**: a button that allows you to change the number of dimensions in real time. It is located on the right side of the GUI.

- **Rotation handler button**: a button that allows you to manage elementary rotations described by planes (e.g. XY) in real time. You can add new ones, remove them, or change the angular velocity coefficient (which refers to the global variable “angle.” It is located in the left side of the GUI.

### Fixed

- **Coloured rendering logic**: previously it was based on mesh dimensions. But this excluded when the mesh has less dimensions than the world (e.g. a square with XW rotation). Now the logic depends on rotation scope, which is the min size of the sum of the elementary rotations.

## INTERNAL

### Changed

- **Matrix class**: improved Matrix class and its instance generation. Now Matrix class has Singleton design for a better performance (only one Matrix instance will be created and edited for multiuse).

### Removed

- **Old functions** that handled the creation of matrices such as “rotationsInNthDimension()” and “possibleRotationMainDiagonals().”

## [1.0.0-demo] - 2024-08-21

### Added

- Everything!

[unreleased]: https://github.com/dastroort/hdchamber/compare/v1.3.0-alpha...HEAD
[1.5.0-beta]: https://github.com/dastroort/hdchamber/compare/v1.4.1-beta...v1.5.0-beta
[1.4.1-beta]: https://github.com/dastroort/hdchamber/compare/v1.4.0-beta...v1.4.1-beta
[1.4.0-beta]: https://github.com/dastroort/hdchamber/compare/v1.3.0-alpha...v1.4.0-beta
[1.3.0-alpha]: https://github.com/dastroort/hdchamber/compare/v1.2.0-alpha...v1.3.0-alpha
[1.2.0-alpha]: https://github.com/dastroort/hdchamber/compare/v1.1.0-alpha...v1.2.0-alpha
[1.1.0-alpha]: https://github.com/dastroort/hdchamber/compare/v1.0.0...v1.1.0-alpha
[1.0.0-demo]: https://github.com/dastroort/hdchamber/releases/tag/v1.0.0
