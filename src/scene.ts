import { Vec3 } from "gl-matrix";

export enum ObjectKind {
  Box,
  Sphere,
  Model,
}

interface CommonObjectProps {
  color: { r: number; g: number; b: number };
  p: Vec3;
  v: Vec3;
  a: Vec3;

  data?: { vertexData: Float32Array; indexData: Uint32Array };
}

export interface Box extends CommonObjectProps {
  kind: ObjectKind.Box;
  length: number;
  width: number;
  height: number;
}

export interface Sphere extends CommonObjectProps {
  kind: ObjectKind.Sphere;
  radius: number;
  hPrec: number;
  vPrec: number;
}

export interface Model extends CommonObjectProps {
  kind: ObjectKind.Model;
  filepath: string;
}

export default class Scene {
  objects: (Box | Sphere | Model)[] = [];

  constructor(objects: (Box | Sphere | Model)[]) {
    this.objects = objects;
  }

  getVertices = async () => {
    for (const obj of this.objects) {
      switch (obj.kind) {
        case ObjectKind.Box:
          obj.data = createBoxVertices(obj);
          break;
        case ObjectKind.Sphere:
          obj.data = createSphereVertices(obj);
          break;
        case ObjectKind.Model:
          let content = await fetch("teapot.obj").then((res) => res.text());
          obj.data = createObjModelVertices(content);
          break;
      }
    }
  };
}

const createBoxVertices = (box: Box) => {
  const { length, width, height } = box;
  const l = length / 2,
    w = width / 2,
    h = height / 2;

  // prettier-ignore
  const faceVertices = [
        [0, 1, 2, 3], // Back   face
        [4, 5, 6, 7], // Front  face
        [0, 1, 4, 5], // Bottom face
        [2, 3, 6, 7], // Top    face
        [0, 2, 4, 6], // Left   face
        [1, 3, 5, 7], // Right  face
      ];

  // prettier-ignore
  const vertexPositions = [
        [-l, -h, -w], // 0: left  bottom back
        [ l, -h, -w], // 1: right bottom back
        [-l,  h, -w], // 2: left  top    back
        [ l,  h, -w], // 3: right top    back
        [-l, -h,  w], // 4: left  bottom front
        [ l, -h,  w], // 5: right bottom front
        [-l,  h,  w], // 6: left  top    front
        [ l,  h,  w], // 7: right top    front
      ];

  // prettier-ignore
  const faceNormals = [
        [ 0,  0, -1], // Back
        [ 0,  0,  1], // Front
        [ 0, -1,  0], // Bottom
        [ 0,  1,  0], // Top
        [-1,  0,  0], // Left
        [ 1,  0,  0], // Right
      ];

  const vertexData = new Float32Array(6 * 4 * 9); // faces * vertices per face * floats per vertex
  let vertexIndex = 0;

  for (let face = 0; face < 6; face++) {
    for (let vertex = 0; vertex < 4; vertex++) {
      const vertexPosition = vertexPositions[faceVertices[face][vertex]];
      const normal = faceNormals[face];

      vertexData.set(vertexPosition, vertexIndex);
      vertexData.set(normal, vertexIndex + 3);
      vertexData.set([0.8, 0.8, 0.8], vertexIndex + 6);
      vertexIndex += 9;
    }
  }

  // prettier-ignore
  const indexData = new Uint32Array([
        0,  2,  1,    2,  3,  1,  // Back face
        4,  5,  6,    5,  7,  6,  // Front face
        8,  9,  10,   9,  11, 10, // Bottom face
        12, 14, 13,   13, 14, 15, // Top face
        16, 18, 17,   17, 18, 19, // Left face
        20, 21, 22,   21, 23, 22  // Right face
      ]);

  return { vertexData, indexData };
};

const createSphereVertices = (sphere: Sphere) => {
  const r = sphere.radius,
    hPrecision = sphere.hPrec,
    vPrecision = sphere.vPrec;

  const vertexCount = 2 + hPrecision * vPrecision;
  const vertexData = new Float32Array(vertexCount * 9);
  let vI = 0;

  const getRainbowColor = (t: number): [number, number, number] => {
    const r = Math.sin(t) * 0.5 + 0.5;
    const g = Math.sin(t + (2 * Math.PI) / 3) * 0.5 + 0.5;
    const b = Math.sin(t + (4 * Math.PI) / 3) * 0.5 + 0.5;
    return [r, g, b];
  };

  // Top pole
  vertexData.set([0, r, 0, 0, 1, 0, ...getRainbowColor(0)], vI);
  vI += 9;

  for (let vStep = 0; vStep < vPrecision; vStep++) {
    const phi = ((vStep + 1) / (vPrecision + 1)) * Math.PI;
    const y = r * Math.cos(phi);
    const rAdj = r * Math.sin(phi);

    for (let hStep = 0; hStep < hPrecision; hStep++) {
      const theta = (hStep / hPrecision) * 2 * Math.PI;
      const x = Math.cos(theta) * rAdj;
      const z = Math.sin(theta) * rAdj;

      const position = [x, y, z];
      const normal = new Vec3(x, y, z).normalize();
      const color = getRainbowColor(theta + phi);

      vertexData.set([...position, ...normal, ...color], vI);
      vI += 9;
    }
  }

  // Bottom pole
  vertexData.set([0, -r, 0, 0, -1, 0, ...getRainbowColor(Math.PI)], vI);

  // Index generation
  const indexCount = vPrecision * hPrecision * 6;
  const indexData = new Uint32Array(indexCount);
  let iI = 0;

  // Top cap
  for (let i = 0; i < hPrecision; i++) {
    indexData.set([((i + 1) % hPrecision) + 1, i + 1, 0], iI);
    iI += 3;
  }

  // Middle sections
  for (let v = 0; v < vPrecision - 1; v++) {
    for (let h = 0; h < hPrecision; h++) {
      const topLeft = v * hPrecision + h + 1;
      const topRight = v * hPrecision + ((h + 1) % hPrecision) + 1;
      const bottomLeft = (v + 1) * hPrecision + h + 1;
      const bottomRight = (v + 1) * hPrecision + ((h + 1) % hPrecision) + 1;

      indexData.set([topRight, bottomLeft, topLeft], iI);
      iI += 3;
      indexData.set([bottomRight, bottomLeft, topRight], iI);
      iI += 3;
    }
  }

  // Bottom cap
  const lastIndex = vertexCount - 1;
  for (let i = 0; i < hPrecision; i++) {
    indexData.set(
      [
        lastIndex,
        lastIndex - hPrecision + i,
        lastIndex - hPrecision + ((i + 1) % hPrecision),
      ],
      iI,
    );
    iI += 3;
  }

  return { vertexData, indexData };
};

const createObjModelVertices = (content: string) => {
  const lines = content.split("\n");

  let verts = [];
  let idx = [];

  for (const line of lines) {
    let [command, ...values] = line.split(" ");
    if (command == "v") {
      let vs = [...values.map((v) => Number(v))];
      verts.push(
        ...vs,
        ...new Vec3(...vs).normalize(),
        Math.random(),
        Math.random(),
        Math.random(),
      );
    } else if (command == "f") {
      let vs = [...values.map((v) => Number(v) - 1)];
      idx.push(...vs);
    }
  }

  const vertexData = new Float32Array(verts);
  const indexData = new Uint32Array(idx);

  console.log({ vertexData, indexData });

  return { vertexData, indexData };
};
