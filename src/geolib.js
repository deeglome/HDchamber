const canvas = document.querySelector("canvas");
const CONTEXT_DIMENSION = 2;
let context = canvas.getContext(CONTEXT_DIMENSION + "d");
const screenDimensions = { width: window.innerWidth, height: (77.5 / 100) * window.innerHeight };
[canvas.width, canvas.height] = [screenDimensions.width, screenDimensions.height];

const DEFAULT_RENDER_SCALE = 200;
const DEFAULT_SIZE = 1.5;
const DEFAULT_COMPLEXITY = 8;
const cameraDistance = 3;
const DEFAULT_CAMERA_ZOOM = 2;
const axisIdentifiers = "xyzwvu";
const DEPTH_MAPPING_DIMENSION = 3;
const COLOR_MAPPING_DIMENSION = 4;
const MAX_DRAWN_POINT_SIZE = 8;
const BRIGHTNESS = 300;
const FOG = 0.5;

/**
 * Performs matrix multiplication with a hyper-dimensional point.
 *
 * @param {number[][]} matrix - The matrix where each row represents coefficients to multiply with the point's coordinates.
 * @param {PointND} point - An instance of the PointND class containing n-dimensional coordinates.
 * @throws {Error} If the dimensions of the matrix do not match the dimensions of the point.
 * @throws {Error} If the computed sum for any row results in NaN.
 * @returns {PointND} The transformed point as a new instance of PointND.
 */
function matrixPointMultiplication(matrix, point) {
  let resultCoordinates = [];
  const matrixColumns = matrix[0].length;
  if (matrixColumns !== point.nthDimension()) throw new Error(`Matrix multiplication cannot exist:\nmatrix length:\t${matrixColumns},\npoint length:\t${point.nthDimension()}`);

  matrix.forEach((row, rowIndex) => {
    let sum = row.reduce((sum, currentValue, valueIndex) => {
      return sum + currentValue * point.coordinates[valueIndex];
    }, 0);
    if (isNaN(sum)) throw new Error("sum is NaN");
    resultCoordinates[rowIndex] = sum;
  });
  return new PointND(...resultCoordinates);
}

/**
 * Determines how “bulky” the composition of rotations is. In other words, it returns the minimum number of dimensions in which the composition of rotations exists.
 *
 * @param {string[]} planes - An array of planes, where each plane is represented as a pair of axis identifiers.
 * @throws {Error} If there is a plane which doesn't include at least one of its axes in `axisIdentifiers`.
 * @returns {number} The scope index incremented by one.
 */
function rotationScope(planes, angularSpeeds) {
  let scopeIndex = 0;

  planes.forEach((plane) => {
    const speed = angularSpeeds[planes.indexOf(plane)];

    if (speed && speed !== 0) {
      const i1 = axisIdentifiers.indexOf(plane[0]);
      const i2 = axisIdentifiers.indexOf(plane[1]);

      if (i1 === -1 || i2 === -1) throw new Error(`Invalid axis in plane: ${plane}`);
      scopeIndex = Math.max(scopeIndex, i1, i2);
    }
  });

  return scopeIndex > 0 ? scopeIndex + 1 : 0;
}

/**
 * Represents a singleton matrix, ensuring that only one instance exists at any time.
 * It supports matrix operations such as translation and rotation, with additional features like extending dimensions.
 *
 * @param {number} rows - Number of rows in the matrix.
 * @param {number} cols - Number of columns in the matrix.
 * @throws {Error} If attempting to instantiate directly while an instance already exists.
 */

function enableColorLegend() {
  const colorLegend = document.querySelector("legend");
  if (colorLegend.classList.contains("hidden")) colorLegend.classList.remove("hidden");
}

function disableColorLegend() {
  const colorLegend = document.querySelector("legend");
  if (!colorLegend.classList.contains("hidden")) colorLegend.classList.add("hidden");
}

function setLegendCoordinate(dimensions) {
  const coordinateToMap = axisIdentifiers[dimensions - 1].toUpperCase();
  const colorLegendLabel = document.querySelector("legend label");
  colorLegendLabel.innerHTML = coordinateToMap + " Coordinate";
}

// Funzione helper per generare tutte le combinazioni di 'comboSize' elementi da un array
function combinations(array, comboSize) {
  const result = [];
  function combine(start, combo) {
    if (combo.length === comboSize) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < array.length; i++) {
      combo.push(array[i]);
      combine(i + 1, combo);
      combo.pop();
    }
  }
  combine(0, []);
  return result;
}
class SingletonMatrix {
  static #instance = null;

  constructor(rows, cols) {
    if (SingletonMatrix.#instance) {
      throw new Error("Use init() method.");
    }
    this.rows = rows;
    this.cols = cols;
    this.value = Array(rows)
      .fill()
      .map(() => Array(cols).fill(0));
    this.#setDefault(rows, cols);
  }

  /**
   * Initializes the singleton matrix instance only if there isn't one already; otherwise, the existing one is returned.
   *
   * @static
   * @param {number} rows - Number of rows in the matrix.
   * @param {number} [cols=rows] - Number of columns in the matrix (default: same as rows).
   * @returns {SingletonMatrix}
   */
  static init(rows, cols = rows) {
    if (!SingletonMatrix.#instance) {
      SingletonMatrix.#instance = new SingletonMatrix(rows, cols);
    }
    return SingletonMatrix.#instance;
  }

  /**
   * Sets default values in the matrix (identity matrix by default).
   *
   * @private
   * @param {number} rows - Number of rows in the matrix.
   * @param {number} cols - Number of columns in the matrix.
   */
  #setDefault(rows, cols) {
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        if (i === j) {
          this.value[i][j] = 1;
        } else {
          this.value[i][j] = 0;
        }
      }
    }
  }

  /**
   * Sets specific flags and parameters for matrix operations such as translation or rotation.
   *
   * @param {string} flag - Operation type ('t' for translation, 'r' for rotation).
   * @param {*} param - Parameters for the operation (e.g., vector or rotation details).
   * @param {boolean} [reset=true] - Whether to reset the matrix before applying the operation (default: true).
   * @throws {Error} If the operation flag is invalid or the parameters are incorrect.
   */
  set(flag, param, reset = true) {
    if (!SingletonMatrix.#instance) {
      throw new Error("There is no instance.");
    }
    if (reset) {
      this.reset();
    }
    switch (flag) {
      case "t":
        this.setTranslation(param);
        break;
      case "r":
        if (typeof param !== "object") {
          throw new Error("Param for rotation must be an array: [stamp, angle]");
        }
        this.setRotation(param[0], param[1]);
        break;
      default:
        throw new Error("Invalid flag.");
    }
    this.#update();
  }

  /**
   * Destroys the singleton matrix instance.
   *
   * @throws {Error} If attempting to destroy a non-existent instance.
   */
  destroy() {
    if (!SingletonMatrix.#instance) {
      throw new Error("Cannot destroy a null instance.");
    }
    SingletonMatrix.#instance = null;
  }

  /**
   * Resets the matrix to its default state.
   */
  reset() {
    let rows = this.rows;
    let cols = this.cols;
    this.destroy();
    SingletonMatrix.#instance = new SingletonMatrix(rows, cols);
  }

  /**
   * Updates matrix dimensions after modifications.
   *
   * @private
   */
  #update() {
    this.rows = this.value.length;
    this.cols = this.value[0].length;
  }

  /**
   * Applies a translation operation to the matrix using a vector.
   *
   * @param {number[]} vector - Translation vector matching the matrix dimensions.
   * @throws {Error} If the vector dimensions are incompatible with the matrix.
   */
  setTranslation(vector) {
    if (vector.length !== this.rows || vector.length !== this.cols) throw new Error(`Invalid vector value (${vector.length}): Matrix${this.rows}x${this.cols}`);
    for (let i = 0; i < this.rows; i++) {
      this.value[i][this.cols] = vector[i];
    }
  }

  /**
   * Applies a rotation operation to the matrix based on a stamp and an angle.
   *
   * @param {string} stamp - Two-character string specifying axis identifiers for rotation.
   * @param {number} angle - Rotation angle in radians.
   * @throws {Error} If the matrix is not square or the stamp/angle is invalid.
   */
  setRotation(stamp, angle) {
    if (this.rows !== this.cols) throw new Error("Not given a square matrix.");
    const mainDiagonalStamp = this.#generateMainDiagonal(stamp, this.rows);
    const sinesLeft = [-Math.sin(angle), Math.sin(angle)];

    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        let isInDiagonal = i === j;
        let thereIsCosine = mainDiagonalStamp[j] === "cos";
        let thereIsOneInTheSameRow = mainDiagonalStamp[j] === "1";
        let thereIsOneInTheSameColumn = mainDiagonalStamp[i] === "1";
        if (isInDiagonal && thereIsCosine) this.value[i][j] = Math.cos(angle);
        else if (isInDiagonal && !thereIsCosine) this.value[i][j] = 1;
        else if (thereIsOneInTheSameRow || thereIsOneInTheSameColumn) this.value[i][j] = 0;
        else if (sinesLeft.length === 0) throw new Error("No sines left. Cannot insert anything.");
        else {
          this.value[i][j] = sinesLeft[0];
          sinesLeft.shift();
        }
      }
    }
  }

  /**
   * Generates the main diagonal configuration for a rotation operation.
   *
   * @private
   * @param {string} stamp - Two-character string specifying axis identifiers.
   * @param {number} dim - Dimension of the matrix.
   * @returns {string[]} Configuration of the main diagonal.
   * @throws {Error} If the stamp is invalid or dimensions are incorrect.
   */
  #generateMainDiagonal(stamp, dim) {
    if (typeof stamp !== "string") throw new Error("Not given a string stamp");
    if (stamp.length !== 2) throw new Error("The stamp is not long 2");
    stamp = stamp.split("");
    stamp = stamp.map((char) => axisIdentifiers.indexOf(char));
    if (-1 in stamp) throw new Error("Not valid stamp. Unrecognized char");
    const mainDiagonal = Array(dim).fill("1");
    mainDiagonal[stamp[0]] = "cos";
    mainDiagonal[stamp[1]] = "cos";
    return mainDiagonal;
  }

  // static scale(...factors) {
  //   const rows = factors.length, columns = rows;
  //   const matrix = Array(rows);
  //   for (let i = 0; i < rows; i++) {
  //     matrix[i] = Array(columns);
  //     for (let j = 0; j < columns; j++) {
  //       if (i === j) matrix[i][j] = factors[i];
  //       else matrix[i][j] = 0;
  //     }
  //   }
  //   return matrix;
  // }

  // static symmetry() { return 1; }

  /**
   * Extends the matrix to the specified dimensions, adding identity-like rows and columns as needed.
   *
   * @param {number} dimensions - The new dimensions of the matrix.
   */
  extendIn(dimensions) {
    this.value.forEach((row) => {
      while (row.length < dimensions) {
        row.push(0);
      }
    });

    while (this.value.length < dimensions) {
      const newRow = new Array(dimensions).fill(0);
      newRow[this.value.length] = 1;
      this.value.push(newRow);
    }
  }
}

/**
 * Represents an n-dimensional point and provides various operations for transformation, projection, drawing, and distance calculation.
 *
 * @class PointND
 * @constructor
 * @param {number[]} coordinates - The coordinates of the point in n-dimensional space.
 */
class PointND {
  constructor(...coordinates) {
    this.nthDimension = () => coordinates.length;
    this.coordinates = coordinates;
  }

  /**
   * Creates an origin point (all coordinates set to 0) in the specified dimensions.
   *
   * @static
   * @param {number} nthDimension - The number of dimensions for the origin point.
   * @returns {PointND} An origin point in n-dimensional space.
   */
  static origin(nthDimension) {
    return new PointND(...Array(nthDimension).fill(0));
  }

  /**
   * Transforms the current point using the given transformation matrix.
   *
   * @param {Array<Array<number>>} matrix - The transformation matrix.
   * @returns {PointND} A new point transformed by the matrix.
   */
  transform(matrix) {
    let transformed = this;
    let matrixCols = matrix[0].length,
      matrixRows = matrix.length;
    if (matrixCols === this.nthDimension + 1 && matrixRows === matrixCols - 1) transformed = matrixPointMultiplication(matrix, new PointND(...transformed.coordinates, 1));
    else transformed = matrixPointMultiplication(matrix, transformed);
    return new PointND(...transformed.coordinates);
  }

  /**
   * Converts the point to a specified number of dimensions by appending zeros.
   *
   * @param {number} dimensions - The target number of dimensions.
   */
  convertTo(dimensions) {
    let dimensionsLeft = dimensions - this.nthDimension();
    for (let i = 0; i < dimensionsLeft; i++) this.coordinates.push(0);
  }

  /**
   * Projects the point into a lower-dimensional space.
   *
   * @param {number} [dimensions=CONTEXT_DIMENSION] - The target number of dimensions for projection.
   * @param {boolean} [isOrthogonalProjection=false] - Whether the projection is orthogonal.
   * @returns {PointND} The projected point.
   */
  projectInto(dimensions = CONTEXT_DIMENSION, isOrthogonalProjection = false) {
    let vertexDimension = this.coordinates.length;
    while (vertexDimension > dimensions) {
      let lastCoordinate = this.coordinates.pop();
      if (!isOrthogonalProjection || vertexDimension > DEPTH_MAPPING_DIMENSION) {
        const perspectiveFactor = DEFAULT_CAMERA_ZOOM / (cameraDistance - lastCoordinate);
        this.coordinates = this.coordinates.map((coordinate) => coordinate * perspectiveFactor);
      }
      vertexDimension -= 1;
    }
    return this;
  }

  /**
   * Draws the point on a canvas context using visual parameters.
   *
   * @param {number} depthSample - The depth value for rendering the point.
   * @param {*} [colorSample=undefined] - The color data associated with the point.
   * @param {number} [dimensionalScope=undefined] - Scope for dimensional color mapping.
   * @param {number} [scale=DEFAULT_RENDER_SCALE] - Scaling factor for rendering.
   * @throws {Error} If the point's dimensionality exceeds or is insufficient for the context dimension.
   */
  draw(depthSample, colorSample = undefined, dimensionalScope = undefined, scale = DEFAULT_RENDER_SCALE, opacity = 1, text = "") {
    if (this.nthDimension > CONTEXT_DIMENSION) throw new Error("This point has too many dimensions to be drawn. You should project it");
    if (this.nthDimension < CONTEXT_DIMENSION) this.convertTo(CONTEXT_DIMENSION);

    context.beginPath();
    let pointSize = MAX_DRAWN_POINT_SIZE / (cameraDistance - depthSample);
    if (isNaN(pointSize)) throw new Error("pointSize non è un numero");
    let positionX = scale * this.coordinates[0] + MAX_DRAWN_POINT_SIZE / 2 + screenDimensions.width / 2;
    if (isNaN(positionX)) throw new Error("PositionX non è un numero");
    let positionY = scale * this.coordinates[1] + MAX_DRAWN_POINT_SIZE / 2 + screenDimensions.height / 2;
    if (isNaN(positionY)) throw new Error("PositionY non è un numero");
    context.arc(positionX, positionY, pointSize, 0, 2 * Math.PI, false);
    // context.stroke();
    // context.strokeStyle = "rgba(0,0,0,0.25)";

    // Calcola il colore basato su hyperdepth
    let color = `hsla(270, 9.8%, 80%, ${(BRIGHTNESS * opacity) / ((1 + FOG) * (cameraDistance - depthSample))}%)`;
    if (dimensionalScope !== undefined && dimensionalScope >= COLOR_MAPPING_DIMENSION) {
      let hue = 36 * colorSample + 270; // Hue secondo i commenti
      color = `hsla(${hue}, 100%, 50%, ${(BRIGHTNESS * opacity) / ((1 + FOG) * (cameraDistance - depthSample))}%)`;
    }

    // Applica il colore calcolato come riempimento
    context.fillStyle = color;
    context.fill();
    context.closePath();

    context.font = 7.5 * pointSize + "px Verdana";
    context.fillText(text, positionX + 10, positionY + 10);
  }

  /**
   * Calculates the squared distance between this point and another point.
   *
   * @param {PointND} point - The point to calculate the distance from.
   * @returns {number} The squared distance between the points.
   */
  distanceSquare(point) {
    let sum = 0;
    for (let dim = 0; dim < this.nthDimension(); dim++) sum += Math.pow(this.coordinates[dim] - point.coordinates[dim], 2);
    return sum;
  }

  equals(point) {
    if (this.nthDimension() !== point.nthDimension()) return false;
    for (let i = 0; i < this.nthDimension(); i++) {
      if (this.coordinates[i] !== point.coordinates[i]) return false;
    }
    return true;
  }

  isContained(pointsArray) {
    for (let i = 0; i < pointsArray.length; i++) {
      if (this.equals(pointsArray[i])) return true;
    }
    return false;
  }
}

/**
 * Represents an n-dimensional mesh consisting of vertices and edges, enabling operations such as transformation, rendering, and barycenter calculation.
 *
 * @class MeshND
 * @constructor
 * @param {PointND[]} vertices - Array of n-dimensional points representing the vertices of the mesh.
 * @param {SegmentND[]} [edges=[]] - Optional array of sub-mesh edges connected to the vertices.
 */
class MeshND {
  constructor(vertices, edges = [], flatCells = []) {
    this.vertices = vertices;
    this.edges = edges;
    this.flatCells = flatCells;
    this.nthDimension = () => this.vertices[0].nthDimension();
  }

  /**
   * Calculates the barycenter (geometric center) of the mesh based on its vertices.
   *
   * @returns {PointND} A point representing the barycenter of the mesh.
   */
  barycenter() {
    let barycenterCoords = [];
    let sum = 0;
    for (let dim = 0; dim < this.vertices[0].nthDimension(); dim++) {
      for (let i = 0; i < this.vertices.length; i++) {
        sum += this.vertices[i].coordinates[dim];
      }
      barycenterCoords.push(sum / this.nthDimension());
      sum = 0;
    }
    return new PointND(...barycenterCoords);
  }

  /**
   * Selects the color sample from a vertex based on its last coordinate value.
   *
   * @private
   * @param {PointND} vertex - The vertex from which to pick the color sample.
   * @returns {*} The color sample value extracted from the vertex.
   */
  static pickColorSample(vertex) {
    return vertex.coordinates.at(-1);
  }

  /**
   * Selects the depth sample from a vertex based on a specific coordinate index.
   *
   * @private
   * @param {PointND} vertex - The vertex from which to pick the depth sample.
   * @returns {number} The depth sample value extracted from the vertex.
   */
  static pickDepthSample(vertex) {
    return vertex.coordinates[CONTEXT_DIMENSION - 1 + 1];
  }

  /**
   * Renders the mesh by projecting its vertices and edges into the specified dimensional context.
   *
   * @param {number} rotationScope - Specifies the scope for rotation mapping.
   * @param {boolean} [isOrthogonalProjection=false] - Whether the projection is orthogonal.
   * @param {number} [renderingScale=DEFAULT_RENDER_SCALE] - Scale factor for rendering the mesh.
   */
  render(rotationScope, isOrthogonalProjection = false, renderingScale = DEFAULT_RENDER_SCALE, opacity = 1, lastCoordinateMode = "false") {
    this.vertices.forEach((vertex) => {
      let colorSample = undefined;
      let projectedVertex = new PointND(...vertex.coordinates);
      projectedVertex = projectedVertex.projectInto(CONTEXT_DIMENSION, isOrthogonalProjection);
      let depthSample = 1;
      if (rotationScope >= COLOR_MAPPING_DIMENSION || this.nthDimension() >= COLOR_MAPPING_DIMENSION) {
        colorSample = MeshND.pickColorSample(vertex);
        enableColorLegend();
        setLegendCoordinate(Math.max(rotationScope, this.nthDimension()));
      }
      if (rotationScope >= DEPTH_MAPPING_DIMENSION || vertex.nthDimension() >= DEPTH_MAPPING_DIMENSION) depthSample = MeshND.pickDepthSample(vertex);
      if (lastCoordinateMode) {
        projectedVertex.draw(depthSample, colorSample, Math.max(rotationScope, vertex.nthDimension()), renderingScale, opacity, Math.round(colorSample * 100) / 100);
      } else {
        projectedVertex.draw(depthSample, colorSample, Math.max(rotationScope, vertex.nthDimension()), renderingScale, opacity);
      }
    });
    this.edges.forEach((edge) => {
      edge.render(isOrthogonalProjection, renderingScale, Math.max(rotationScope, edge.start.nthDimension()), opacity);
    });
  }

  /**
   * Extends the dimensionality of the mesh's vertices by appending zeros.
   *
   * @param {number} dimensions - The target number of dimensions.
   */
  extendIn(dimensions) {
    let oldDimension = this.nthDimension();
    this.vertices.forEach((vertex) => {
      for (let i = 0; i < dimensions - oldDimension; i++) {
        vertex.coordinates.push(0);
      }
    });
  }

  /**
   * Transforms the mesh using the specified matrix, applying the transformation to all vertices and edges.
   *
   * @param {Array<Array<number>>} matrix - The transformation matrix.
   * @returns {MeshND} A new mesh transformed by the matrix.
   */
  transform(matrix) {
    this.extendIn(matrix.length);
    this.vertices = this.vertices.map((vertex) => vertex.transform(matrix));
    this.edges = this.edges.map((edge) => edge.transform(matrix));
    this.flatCells = this.flatCells.map((flatCell) => flatCell.transform(matrix));
    return new MeshND(this.vertices, this.edges, this.flatCells);
  }
}

/**
 * Represents an n-dimensional segment defined by two extremes (start and end points).
 * Provides methods for rendering and applying transformations to the segment.
 *
 * @class SegmentND
 * @constructor
 * @param {...PointND} extremes - Two PointND instances representing the extremes of the segment.
 * @throws {Error} If the number of extremes is not two or if the extremes have differing dimensions.
 */
class SegmentND {
  constructor(...extremes) {
    if (extremes.length !== 2) throw new Error("A segment has not got " + extremes.length + " extremes");
    if (extremes[0].nthDimension() !== extremes[1].nthDimension()) throw new Error("Watch out! You put two different PointND", extremes[0].coordinates, extremes[1].coordinates);
    this.nthDimension = () => extremes[0].nthDimension();
    this.extremes = extremes;
    this.start = extremes[0];
    this.end = extremes[1];
  }

  /**
   * Renders the segment on the canvas, optionally applying projection and scaling.
   *
   * @param {boolean} [isOrthogonalProjection=false] - Whether to use orthogonal projection.
   * @param {number} [scale=DEFAULT_RENDER_SCALE] - Scaling factor for rendering the segment.
   * @param {number} [rotationScope=undefined] - Specifies scope for rotation or color mapping.
   * @throws {Error} If any computed position or dimension is invalid (e.g., NaN).
   */
  render(isOrthogonalProjection = false, scale = DEFAULT_RENDER_SCALE, rotationScope = undefined, opacity = 1) {
    let colorSample1 = undefined;
    let colorSample2 = undefined;
    if (rotationScope >= COLOR_MAPPING_DIMENSION) {
      colorSample1 = this.start.coordinates.at(-1);
      colorSample2 = this.end.coordinates.at(-1);
    }
    let depth = 1;
    if (this.nthDimension() >= DEPTH_MAPPING_DIMENSION) {
      this.start = this.start.projectInto(3, isOrthogonalProjection);
      this.end = this.end.projectInto(3, isOrthogonalProjection);
      depth = (this.start.coordinates.at(-1) + this.end.coordinates.at(-1)) / 2;
    }
    this.start = this.start.projectInto(2, isOrthogonalProjection);
    this.end = this.end.projectInto(2, isOrthogonalProjection);
    let positionX = scale * this.start.coordinates[0] + MAX_DRAWN_POINT_SIZE / 2 + screenDimensions.width / 2;
    if (isNaN(positionX)) throw new Error("positionX non è un numero.");
    let positionY = scale * this.start.coordinates[1] + MAX_DRAWN_POINT_SIZE / 2 + screenDimensions.height / 2;
    if (isNaN(positionY)) throw new Error("positionY non è un numero.");
    let positionX_1 = scale * this.end.coordinates[0] + MAX_DRAWN_POINT_SIZE / 2 + screenDimensions.width / 2;
    if (isNaN(positionX_1)) throw new Error("positionX1 non è un numero.");
    let positionY_1 = scale * this.end.coordinates[1] + MAX_DRAWN_POINT_SIZE / 2 + screenDimensions.height / 2;
    if (isNaN(positionY_1)) throw new Error("positionY1 non è un numero.");
    context.beginPath();
    context.moveTo(positionX, positionY);
    context.lineTo(positionX_1, positionY_1);
    let color = `hsla(270, 9.8%, 80%, ${(BRIGHTNESS * opacity) / ((1 + 2 * FOG) * (cameraDistance - depth))}%)`;
    context.strokeStyle = color;
    context.lineWidth = 2.5 / (cameraDistance - depth);

    if (colorSample1 !== undefined && colorSample2 !== undefined) {
      let hue1 = 36 * colorSample1 + 270; // Hue secondo i commenti
      let hue2 = 36 * colorSample2 + 270; // Hue secondo i commenti

      // Create a linear gradient
      const gradient = context.createLinearGradient(positionX, positionY, positionX_1, positionY_1);
      gradient.addColorStop(0, `hsla(${hue1}, 100%, 50%, ${(BRIGHTNESS * opacity) / ((1 + 2 * FOG) * (cameraDistance - depth))}%)`);
      gradient.addColorStop(1, `hsla(${hue2}, 100%, 50%, ${(BRIGHTNESS * opacity) / ((1 + 2 * FOG) * (cameraDistance - depth))}%)`);

      context.strokeStyle = gradient;
    }

    context.stroke();
    context.closePath();
  }

  /**
   * Transforms the segment by applying the specified matrix to both its start and end points.
   *
   * @param {Array<Array<number>>} matrix - The transformation matrix.
   * @returns {SegmentND} A new segment transformed by the matrix.
   */
  transform(matrix) {
    return new SegmentND(this.start.transform(matrix), this.end.transform(matrix));
  }
}

class CartesianAxes extends MeshND {
  constructor(dimensions) {
    const cartesianAxes = [];
    const vertices = [];
    const labels = [];
    const UNIT_LENGTH = 1.5;
    for (let i = 0; i < dimensions; i++) {
      const axisArrow = Array(dimensions).fill(0);
      axisArrow[i] = UNIT_LENGTH;
      const axis = new SegmentND(PointND.origin(dimensions), new PointND(...axisArrow));
      cartesianAxes.push(axis);
      vertices.push(new PointND(...axisArrow));
      labels.push(axisIdentifiers[i].toUpperCase());
    }
    super(vertices, cartesianAxes);
    this.labels = labels;
  }

  render(rotationScope, isOrthogonalProjection = false, renderingScale = DEFAULT_RENDER_SCALE, opacity = 1) {
    this.vertices.forEach((vertex, index) => {
      let colorSample = undefined;
      let projectedVertex = new PointND(...vertex.coordinates);
      projectedVertex = projectedVertex.projectInto(CONTEXT_DIMENSION, isOrthogonalProjection);
      let depthSample = 1;
      if (rotationScope >= COLOR_MAPPING_DIMENSION || this.nthDimension() >= COLOR_MAPPING_DIMENSION) {
        colorSample = MeshND.pickColorSample(vertex);
        enableColorLegend();
        setLegendCoordinate(Math.max(rotationScope, this.nthDimension()));
      }
      if (rotationScope >= DEPTH_MAPPING_DIMENSION || vertex.nthDimension() >= DEPTH_MAPPING_DIMENSION) depthSample = MeshND.pickDepthSample(vertex);

      const label = this.labels[index];

      projectedVertex = new PointND(...vertex.coordinates).projectInto(CONTEXT_DIMENSION, isOrthogonalProjection);
      projectedVertex.draw(depthSample, colorSample, Math.max(rotationScope, vertex.nthDimension()), renderingScale, opacity, label);
    });
    this.edges.forEach((edge) => {
      edge.render(isOrthogonalProjection, renderingScale, Math.max(rotationScope, edge.start.nthDimension()), opacity);
    });
  }
}

/**
 * Represents an n-dimensional hypercube, extending the MeshND class.
 * Automatically generates vertices and edges based on the given dimensions and edge length.
 *
 * @class Hypercube
 * @extends MeshND
 * @constructor
 * @param {number} dimensions - The number of dimensions for the hypercube.
 * @param {number} [edge=DEFAULT_SIZE] - The length of each edge of the hypercube (default value is DEFAULT_SIZE).
 */
class Hypercube extends MeshND {
  constructor(dimensions, edge = DEFAULT_SIZE) {
    let vertices = Hypercube.#createHypercubeVertices(dimensions, edge);
    let edges = Hypercube.#createHypercubeEdges(dimensions, vertices);
    let flatCells = Hypercube.#createHypercubeFlatCells(dimensions, vertices);
    super(vertices, edges, flatCells);
  }

  /**
   * Generates the vertices of the hypercube based on the given dimensions and edge length.
   * Each vertex is calculated using binary representation, toggling between positive and negative values.
   *
   * @static
   * @private
   * @param {number} dimensions - The number of dimensions for the hypercube.
   * @param {number} edge - The length of each edge of the hypercube.
   * @returns {Array<PointND>} An array of PointND instances representing the vertices of the hypercube.
   */
  static #createHypercubeVertices(dimensions, edge) {
    let vertices = [];
    for (let i = 0; i < Math.pow(2, dimensions); i++) {
      let vertex = [];
      for (let j = 0; j < dimensions; j++) vertex.push(i & (1 << j) ? edge / 2 : -edge / 2);
      vertices.push(new PointND(...vertex));
    }
    return vertices;
  }

  /**
   * Generates the edges (edges) of the hypercube by pairing vertices.
   * The pairing is done sequentially by comparing binary representations of vertex positions.
   *
   * @static
   * @private
   * @param {number} dimensions - The number of dimensions for the hypercube.
   * @param {Array<PointND>} vertices - The vertices of the hypercube.
   * @returns {Array<SegmentND>} An array of SegmentND instances representing the edges of the hypercube.
   */
  static #createHypercubeEdges(dimensions, vertices) {
    let edges = [];
    let verticesUsed = [];
    for (let i = 0; i < dimensions; i++) {
      verticesUsed = [];
      for (let j = 0; j < vertices.length; j++) {
        if (verticesUsed.includes(j)) continue;
        edges.push(new SegmentND(vertices[j], vertices[j + Math.pow(2, i)]));
        verticesUsed.push(j, j + Math.pow(2, i));
      }
    }
    return edges;
  }

  static #createHypercubeFlatCells(dimensions, vertices) {
    if (dimensions < 3) return [];
    let flatCells = [];
    const quartets = combinations(vertices, 4);

    for (let flatCellVertices of quartets) {
      if (isValidSquare(flatCellVertices)) {
        let flatCellEdges = Hypercube.#createHypercubeEdges(2, flatCellVertices);
        flatCells.push(new MeshND(flatCellVertices, flatCellEdges));
      }
    }
    return flatCells;

    function isValidSquare(quartet) {
      if (quartet.length !== 4) throw new Error("It's not a quartet of vertices.");
      let sharedIndexes = 0;
      for (let i = 0; i < dimensions; i++) {
        let sharedIndexForAllVertices = true;
        for (let k = 0; k < quartet.length - 1; k++) {
          if (quartet[k].coordinates[i] !== quartet[k + 1].coordinates[i]) {
            sharedIndexForAllVertices = false;
            break;
          }
        }
        if (sharedIndexForAllVertices) sharedIndexes++;
      }
      return sharedIndexes === dimensions - 2;
    }
  }
}

/**
 * Represents an n-dimensional simplex, extending the MeshND class.
 * Automatically generates vertices and edges for the simplex based on the given dimensions and edge length.
 *
 * @class Simplex
 * @extends MeshND
 * @constructor
 * @param {number} dimensions - The number of dimensions for the simplex.
 * @param {number} [edge=DEFAULT_SIZE] - The length of each edge of the simplex (default is DEFAULT_SIZE).
 */
class Simplex extends MeshND {
  constructor(dimensions, edge = DEFAULT_SIZE) {
    const vertices = Simplex.#createSimplex(dimensions, edge);
    const edges = Simplex.createSimplexEdges(dimensions, vertices);
    const flatCells = Simplex.#createSimplexFlatCells(vertices);
    super(vertices, edges, flatCells);
  }

  /**
   * Recursively generates the vertices for the simplex by adding a new vertex to an (n-1)-dimensional simplex.
   * Ensures that the simplex is centered and all vertices have the correct dimensionality.
   *
   * @static
   * @private
   * @param {number} dimensions - The number of dimensions for the simplex.
   * @param {number} edge - The length of each edge of the simplex.
   * @param {Array<number>} [pointstamp=[]] - Optional array to mark the simplex (not currently used).
   * @returns {Array<PointND>} An array of PointND instances representing the vertices of the simplex.
   * @throws {Error} If a vertex has too many or too few coordinates.
   */
  static #createSimplex(dimensions, edge, pointstamp = []) {
    if (dimensions === 1) {
      return new Hypercube(1, edge).vertices;
    } else {
      let oldSimplex = new Simplex(dimensions - 1, edge, pointstamp);
      let oldBarycenter = oldSimplex.barycenter();
      let newVertex = new PointND(...oldBarycenter.coordinates, Math.sqrt(edge * edge - oldBarycenter.distanceSquare(oldSimplex.vertices[0])));
      let vertices = [...oldSimplex.vertices, newVertex];
      let simplex = new MeshND(vertices);
      for (let i = 0; i < vertices.length; i++) {
        // check if all the vertices have the same number of coordinates
        if (vertices[i].nthDimension() > dimensions) throw new Error("A point has too many coordinates");
        if (vertices[i].nthDimension() < dimensions) vertices[i].convertTo(dimensions);
      }
      let oppositeNewBarycenterVector = oppositeVector(simplex.barycenter().coordinates);
      // center the simplex with a traslation
      simplex.vertices.forEach((vertex) => {
        for (let i = 0; i < vertex.nthDimension(); i++) {
          vertex.coordinates[i] += oppositeNewBarycenterVector[i];
        }
      });
      // let T = SingletonMatrix.init(dimensions, dimensions);
      // T.set("t", oppositeNewBarycenterVector);
      // simplex.extendIn(T.value[0].length);
      // console.log(dimensions);
      // simplex.transform(T.value);
      // T.destroy();
      return simplex.vertices;
    }
  }

  /**
   * Generates the edges (edges) of the simplex by connecting all possible pairs of vertices,
   * excluding any duplicate connections.
   *
   * @static
   * @private
   * @param {number} dimensions - The number of dimensions for the simplex.
   * @param {Array<PointND>} vertices - The vertices of the simplex.
   * @returns {Array<SegmentND>} An array of SegmentND instances representing the edges of the simplex.
   */
  static createSimplexEdges(dimensions, vertices) {
    let edges = [];
    let verticesUsed = [];
    for (let i = 0; i < dimensions; i++) {
      for (let j = 0; j < vertices.length; j++) {
        if (i === j) continue;
        if (verticesUsed.includes(j)) continue;
        edges.push(new SegmentND(vertices[i], vertices[j]));
        verticesUsed.push(i);
      }
    }
    return edges;
  }

  static #createSimplexFlatCells(vertices) {
    const flatCells = [];
    const tris = combinations(vertices, 3);
    for (let flatCellVertices of tris) {
      const flatCellEdges = Simplex.createSimplexEdges(2, flatCellVertices);
      flatCells.push(new MeshND(flatCellVertices, flatCellEdges));
    }
    return flatCells;
  }
}

/**
 * Represents an n-dimensional hypersphere, extending the MeshND class.
 * Automatically generates vertices and edges for the hypersphere based on its dimensions, radius, and complexity.
 *
 * @class Hypersphere
 * @extends MeshND
 * @constructor
 * @param {number} dimensions - The number of dimensions for the hypersphere.
 * @param {number} [radius=DEFAULT_SIZE] - The radius of the hypersphere (default is DEFAULT_SIZE).
 * @param {number} [complexity=DEFAULT_COMPLEXITY] - The complexity (number of subdivisions) for generating the hypersphere.
 */
class Hypersphere extends MeshND {
  constructor(dimensions, radius = DEFAULT_SIZE, complexity = DEFAULT_COMPLEXITY) {
    const hypersphere = Hypersphere.#createHypersphere(dimensions, radius, complexity);
    // const edges = Hypersphere.#createHypersphereEdges(vertices, complexity);
    super(hypersphere.vertices, hypersphere.edges);
  }

  /**
   * Recursively generates the vertices and edges for the hypersphere by building lower-dimensional sections.
   * Uses trigonometric calculations to place vertices in n-dimensional space.
   *
   * @static
   * @private
   * @param {number} dimensions - The number of dimensions for the hypersphere.
   * @param {number} radius - The radius of the hypersphere.
   * @param {number} complexity - The complexity (number of subdivisions) for the hypersphere.
   * @param {Array<number>} [pointstamp=[]] - Optional additional coordinates for higher-dimensional sections.
   * @returns {Object} An object containing `vertices` (Array<PointND>) and `edges` (Array<SegmentND>).
   */
  static #createHypersphere(dimensions, radius, complexity, pointstamp = []) {
    let stepAngle = Math.PI / complexity;
    if (dimensions === 1) {
      return { vertices: new Hypercube(1, radius).vertices, edges: [] };
    }
    if (dimensions === 2) {
      // Caso base: restituisci un array con un singolo punto
      return Hypersphere.#createCircle(radius, stepAngle, pointstamp);
    } else {
      // Caso ricorsivo: costruisci i punti utilizzando le sezioni di ipersfere di dimensioni inferiori
      let vertices = [];
      let edges = [];
      let previousHypersphereSection = undefined;
      for (let i = 0; i <= complexity; i++) {
        let w = radius * Math.cos(Math.PI - (i * Math.PI) / complexity);
        let hypersphereSectionRadius = Math.sqrt(radius * radius - w * w);
        let hypersphereSection = Hypersphere.#createHypersphere(dimensions - 1, hypersphereSectionRadius, complexity, pointstamp.concat(w));
        vertices.push(...hypersphereSection.vertices);
        edges.push(...hypersphereSection.edges, ...Hypersphere.connectTwoAdiacentHypersphereSections(previousHypersphereSection, hypersphereSection));
        previousHypersphereSection = hypersphereSection;
      }
      // connect adiacent sections
      return { vertices: vertices, edges: edges };
    }
  }

  /**
   * Connects two adjacent sections of a hypersphere by creating edges (segments) between corresponding vertices.
   *
   * @static
   * @param {Object} previousHypersphereSection - The previous hypersphere section containing vertices.
   * @param {Object} hypersphereSection - The current hypersphere section containing vertices.
   * @returns {Array<SegmentND>} An array of SegmentND instances connecting the two sections.
   */
  static connectTwoAdiacentHypersphereSections(previousHypersphereSection, hypersphereSection) {
    if (previousHypersphereSection === undefined) return [];
    let edges = [];
    if (previousHypersphereSection.vertices.length === 1)
      for (let v = 0; v < hypersphereSection.vertices.length; v++) edges.push(new SegmentND(previousHypersphereSection.vertices[0], hypersphereSection.vertices[v]));
    else if (hypersphereSection.vertices.length === 1)
      for (let v = 0; v < hypersphereSection.vertices.length; v++) edges.push(new SegmentND(previousHypersphereSection.vertices[v], hypersphereSection.vertices[0]));
    else for (let v = 0; v < hypersphereSection.vertices.length; v++) edges.push(new SegmentND(previousHypersphereSection.vertices[v], hypersphereSection.vertices[v]));
    return edges;
  }

  /**
   * Creates a 2D circle of points, given a radius and step angle.
   * Also generates the edges (edges) connecting adjacent points in the circle.
   *
   * @static
   * @private
   * @param {number} radius - The radius of the circle.
   * @param {number} stepAngle - The angle step for placing points around the circle.
   * @param {Array<number>} [pointstamp=[]] - Optional additional coordinates for higher-dimensional space.
   * @returns {Object} An object containing `vertices` (Array<PointND>) and `edges` (Array<SegmentND>).
   */
  static #createCircle(radius, stepAngle, pointstamp = []) {
    const vertices = Hypersphere.#createCircleVertices(radius, stepAngle, pointstamp);
    const edges = Hypersphere.#createCircleEdges(vertices);
    const circle = { vertices: vertices, edges: edges };
    return circle;
  }

  /**
   * Generates the vertices for a 2D circle based on the radius and step angle.
   *
   * @static
   * @private
   * @param {number} radius - The radius of the circle.
   * @param {number} stepAngle - The angle step for placing points around the circle.
   * @param {Array<number>} [pointstamp=[]] - Optional additional coordinates for higher-dimensional space.
   * @returns {Array<PointND>} An array of PointND instances representing the circle's vertices.
   */
  static #createCircleVertices(radius, stepAngle, pointstamp = []) {
    let points = [];
    for (let theta = 0; theta < 2 * Math.PI; theta += stepAngle) {
      let x = radius * Math.cos(theta);
      let y = radius * Math.sin(theta);
      let newPoint = new PointND(x, y, ...pointstamp);
      points.push(newPoint);
    }
    return points;
  }

  /**
   * Creates edges (edges) for a 2D circle by connecting adjacent vertices.
   *
   * @static
   * @private
   * @param {Array<PointND>} vertices - The vertices of the circle.
   * @returns {Array<SegmentND>} An array of SegmentND instances connecting adjacent vertices.
   */
  static #createCircleEdges(vertices) {
    let edges = [];
    for (let v = 0; v < vertices.length; v++) {
      if (v === vertices.length - 1) edges.push(new SegmentND(vertices[v], vertices[0]));
      else edges.push(new SegmentND(vertices[v], vertices[v + 1]));
    }
    return edges;
  }
}

/**
 * Represents an orthoplex (a multi-dimensional counterpart of an octahedron)
 * as a subclass of MeshND.
 *
 * The orthoplex is constructed by treating it as a hypersphere with a complexity of 2.
 * The vertices and edges of the orthoplex are derived from the hypersphere's properties.
 *
 * @class Orthoplex
 * @extends MeshND
 * @param {number} dimensions - The number of dimensions of the orthoplex.
 * @param {number} [edge=DEFAULT_SIZE] - The edge length of the orthoplex. Defaults to DEFAULT_SIZE.
 */
class Orthoplex extends MeshND {
  constructor(dimensions, edge = DEFAULT_SIZE) {
    const radius = edge * Math.SQRT1_2;
    const orthoplex = new Hypersphere(dimensions, radius, 2);
    const orthoplexFlatCells = Orthoplex.#createOrthoplexFlatCells(orthoplex.vertices);
    super(orthoplex.vertices, orthoplex.edges, orthoplexFlatCells);
  }

  static #createOrthoplexFlatCells(vertices) {
    const flatCells = [];
    const tris = combinations(vertices, 3);

    for (let flatCellVertices of tris) {
      const dim = flatCellVertices[0].nthDimension();
      let sum = new Array(dim).fill(0);

      // Calcolo somma vettoriale delle tre componenti
      for (let v of flatCellVertices) {
        for (let i = 0; i < dim; i++) {
          sum[i] += v.coordinates[i];
        }
      }

      // Mappa dei moduli diversi da zero
      const nonZeroAbs = sum.map(Math.abs).filter((x) => x !== 0);
      const unique = [...new Set(nonZeroAbs)];

      // Verifica: esattamente 3 componenti != 0 con stesso modulo
      if (nonZeroAbs.length === 3 && unique.length === 1) {
        const flatCellEdges = Simplex.createSimplexEdges(2, flatCellVertices);
        flatCells.push(new MeshND(flatCellVertices, flatCellEdges));
      }
    }
    return flatCells;
  }
}

/**
 * Represents a torus in n-dimensional space as a subclass of MeshND.
 *
 * The torus is constructed by generating vertices and edges based on a hypersphere slice
 * and applying rotations to form the shape of the torus.
 *
 * @class Torus
 * @extends MeshND
 * @param {number} dimensions - The number of dimensions of the torus.
 * @param {number} [radius=DEFAULT_SIZE / 4] - The radius of the torus slice. Defaults to a quarter of DEFAULT_SIZE.
 * @param {number} [distanceFromTheCenter=2 * radius] - The distance of the torus slice from the center. Defaults to twice the radius.
 * @param {number} [complexity=DEFAULT_COMPLEXITY] - The complexity level defining the resolution of the torus. Defaults to DEFAULT_COMPLEXITY.
 */
class Torus extends MeshND {
  constructor(dimensions, radius = DEFAULT_SIZE / 4, distanceFromTheCenter = 2 * radius, complexity = DEFAULT_COMPLEXITY) {
    const torus = Torus.#createTorusVertices(dimensions, radius, distanceFromTheCenter, complexity);
    super(torus.vertices, torus.edges);
  }

  /**
   * Generates the vertices and edges required to construct a torus.
   *
   * This static method calculates the vertices and edges of the torus by transforming a hypersphere slice
   * and applying rotations to create the torus structure.
   *
   * @static
   * @method #createTorusVertices
   * @param {number} dimensions - The number of dimensions of the torus.
   * @param {number} radius - The radius of the torus slice.
   * @param {number} distanceFromTheCenter - The distance of the torus slice from the center.
   * @param {number} complexity - The complexity level defining the resolution of the torus.
   * @returns {object} - An object containing the vertices and edges of the torus.
   */
  static #createTorusVertices(dimensions, radius, distanceFromTheCenter, complexity) {
    let vertices = [];
    let edges = [];
    let slice = new Hypersphere(dimensions - 1, radius, complexity / 2);
    slice.extendIn(dimensions);
    let zerosToAppend = Array(dimensions - 1).fill(0);
    let vector = [radius + distanceFromTheCenter, ...zerosToAppend];
    slice.vertices.forEach((vertex) => {
      for (let i = 0; i < vertex.nthDimension(); i++) {
        vertex.coordinates[i] += vector[i];
      }
    });
    // let T = SingletonMatrix.init(dimensions, dimensions);
    // T.set("t", vector);
    // slice.transform(T.value);
    // T.destroy();
    let stamp = "x" + axisIdentifiers[dimensions - 1];

    let stepAngle = Math.PI / complexity;
    for (let i = 0; i < 2 * complexity; i++) {
      let R = SingletonMatrix.init(dimensions);
      R.set("r", [stamp, stepAngle]);
      slice.transform(R.value);
      R.destroy();
      vertices.push(...slice.vertices);
      edges.push(...slice.edges);
    }
    edges.push(...Torus.#connectTwoAdiacentTorusSections(slice, vertices));
    return { vertices: vertices, edges: edges };
  }

  /**
   * Connects adjacent sections of the torus.
   *
   * This static method ensures continuity in the torus structure by connecting vertices from
   * adjacent sections.
   *
   * @static
   * @method #connectTwoAdiacentTorusSections
   * @param {Hypersphere} sliceSample - A sample slice of the torus.
   * @param {Array} torusVertices - The vertices of the torus.
   * @returns {Array} - An array of edges connecting adjacent sections.
   */
  static #connectTwoAdiacentTorusSections(sliceSample, torusVertices) {
    let edges = [];
    for (let v = sliceSample.vertices.length; v < torusVertices.length; v += 1) {
      if (v > torusVertices.length - 1 - sliceSample.vertices.length) edges.push(new SegmentND(torusVertices[v], torusVertices[(v + sliceSample.vertices.length) % torusVertices.length]));
      edges.push(new SegmentND(torusVertices[v - sliceSample.vertices.length], torusVertices[v]));
    }
    return edges;
  }
}

/**
 * Reverses the direction of a given vector by negating each of its components.
 *
 * @function oppositeVector
 * @param {Array<number>} vector - An array representing the vector to be inverted.
 * @returns {Array<number>} - The input vector with all components negated.
 */
function oppositeVector(vector) {
  for (let i = 0; i < vector.length; i++) vector[i] *= -1;
  return vector;
}

// function create24Cell() {
//   const vertices = [];
//   // Generate vertices of the form (±1, ±1, 0, 0)
//   const coords = [1, -1];
//   for (let i of coords) {
//     for (let j of coords) {
//       vertices.push(new PointND(i, j, 0, 0));
//       vertices.push(new PointND(i, 0, j, 0));
//       vertices.push(new PointND(i, 0, 0, j));
//       vertices.push(new PointND(0, i, j, 0));
//       vertices.push(new PointND(0, i, 0, j));
//       vertices.push(new PointND(0, 0, i, j));
//     }
//   }
//   // Generate vertices of the form (±1, 0, 0, 0)
//   for (let i of coords) {
//     vertices.push(new PointND(i, 0, 0, 0));
//     vertices.push(new PointND(0, i, 0, 0));
//     vertices.push(new PointND(0, 0, i, 0));
//     vertices.push(new PointND(0, 0, 0, i));
//   }
//   return vertices;
// }

function uploadEnvironment() {
  context.clearRect(0, 0, window.innerWidth, window.innerHeight);
}

function resizeCanvas() {
  screenDimensions.width = window.innerWidth;
  context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas
}

export {
  DEFAULT_RENDER_SCALE,
  COLOR_MAPPING_DIMENSION,
  axisIdentifiers,
  rotationScope,
  disableColorLegend,
  SingletonMatrix,
  PointND,
  SegmentND,
  MeshND,
  Hypercube,
  Hypersphere,
  Simplex,
  Torus,
  Orthoplex,
  uploadEnvironment,
  resizeCanvas,
  CartesianAxes,
};
