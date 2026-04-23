import * as GEOLIB from "./geolib.js";

class Hyperplane {
  constructor(normalVector) {
    this.normalVector = normalVector;
  }

  toString(roundDigits = 6) {
    let equation = "";
    this.normalVector.forEach((component, index) => {
      let roundedComponent = Math.round(component * Math.pow(10, roundDigits)) / Math.pow(10, roundDigits);
      equation +=
        roundedComponent === 0 ? "" : (equation === "" ? "" : roundedComponent > 0 ? " + " : " - ") + (roundedComponent === 1 ? "" : Math.abs(roundedComponent)) + GEOLIB.axisIdentifiers[index];
    });
    equation += " = 0";
    return equation;
  }

  calculatePositionOfPoint(point) {
    return this.normalVector.reduce((total, _, index) => total + this.normalVector[index] * point.coordinates[index]);
  }

  intersectWithLine(line) {
    // Validate dimensions
    if (line.nativePoint.coordinates.length !== this.normalVector.length || line.directionVector.length !== this.normalVector.length) {
      throw new Error("Line and hyperplane must exist in the same number of dimensions.");
    }

    // Calculate the dot product between the normal vector and the line's direction vector
    const dotProduct = this.normalVector.reduce((sum, normalComponent, i) => {
      return sum + normalComponent * line.directionVector[i];
    }, 0);

    // If the dot product is zero, the line is parallel to the hyperplane (no intersection)
    if (dotProduct === 0) {
      return null;
    }

    // Calculate the parameter t for the line equation: L(t) = nativePoint + t * directionVector
    const t =
      -this.normalVector.reduce((sum, normalComponent, i) => {
        return sum + normalComponent * line.nativePoint.coordinates[i];
      }, 0) / dotProduct;

    // Calculate the intersection point: nativePoint + t * directionVector
    const intersectionCoordinates = line.nativePoint.coordinates.map((coord, i) => {
      return coord + t * line.directionVector[i];
    });

    return new GEOLIB.PointND(...intersectionCoordinates);
  }

  intersectWithSegment(segment) {
    if (this.calculatePositionOfPoint(segment.start) * this.calculatePositionOfPoint(segment.end) > 0) return null;
    let directionVector = segment.start.coordinates.map((_, index) => {
      return segment.start.coordinates[index] - segment.end.coordinates[index];
    });
    let line = new LineND(segment.start, directionVector);
    return this.intersectWithLine(line);
  }

  intersectWithFlatCell(flatCell) {
    let intersectionPoints = [];
    flatCell.edges.forEach((edge) => {
      let intersection = this.intersectWithSegment(edge);
      if (intersection !== null && !intersection.isContained(intersectionPoints)) intersectionPoints.push(intersection);
    });
    if (intersectionPoints.length === 0) return null;
    if (intersectionPoints.length !== 2) throw new Error(`Unpredictable behavior. A flatCell would have to intersect twice a plane (not ${intersectionPoints.length} time/s).`);
    let [start, end] = intersectionPoints;
    return new GEOLIB.SegmentND(start, end);
  }

  crossSectionOfMesh(mesh) {
    let crossSectionVertices = [];
    let crossSectionEdges = [];

    mesh.edges.forEach((edge) => {
      let vertex = this.intersectWithSegment(edge);
      if (vertex !== null) crossSectionVertices.push(vertex);
    });

    mesh.flatCells.forEach((flatCell) => {
      let crossSectionEdge = this.intersectWithFlatCell(flatCell);
      if (crossSectionEdge !== null) crossSectionEdges.push(crossSectionEdge);
    });

    return new GEOLIB.MeshND(crossSectionVertices, crossSectionEdges);
  }
}

class LineND {
  constructor(nativePoint, directionVector) {
    this.nativePoint = nativePoint;
    this.directionVector = directionVector;
  }

  toString() {}
}

export { Hyperplane };
