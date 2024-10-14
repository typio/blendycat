import { Vec3, Vec2 } from "gl-matrix";

export enum ObjectKind {
  Box,
  Sphere,
  Model,
  Cloth,
}

interface CommonObjectProps {
  color: Vec3;
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
  divisions?: Vec3;
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

export interface Cloth extends CommonObjectProps {
  kind: ObjectKind.Cloth;
  length: number;
  width: number;
  divisions: Vec2;

  vertices?: {
    p: Vec3;
    lastP: Vec3;
    a: Vec3;
  }[];
}

export default class Scene {
  objects: (Box | Sphere | Model | Cloth)[] = [];

  constructor(objects: (Box | Sphere | Model | Cloth)[]) {
    this.objects = objects;
  }

  getVertices = async () => {
    for (const obj of this.objects) {
      switch (obj.kind) {
        case ObjectKind.Box:
          createBoxVertices(obj);
          break;
        case ObjectKind.Sphere:
          createSphereVertices(obj);
          break;
        case ObjectKind.Model:
          let content = await fetch("teapot.obj").then((res) => res.text());
          createObjModelVertices(obj, content);
          break;
        case ObjectKind.Cloth:
          createClothVertices(obj);
          break;
      }
    }
  };
}

const createFaceVertices = (
  box: Box,
  uAxis: number,
  vAxis: number,
  fixedAxis: number,
  uDivisions: number,
  vDivisions: number,
  sign: number,
) => {
  const [l, w, h] = [box.length / 2, box.width / 2, box.height / 2];
  const vertices: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= uDivisions; i++) {
    for (let j = 0; j <= vDivisions; j++) {
      const u = (i / uDivisions) * 2 - 1;
      const v = (j / vDivisions) * 2 - 1;

      // prettier-ignore
      const vertex = [
        0,0,0,
        0,0,0,
        ...box.color
      ];
      vertex[uAxis] = u * (uAxis === 0 ? l : uAxis === 1 ? h : w);
      vertex[vAxis] = v * (vAxis === 0 ? l : vAxis === 1 ? h : w);
      vertex[fixedAxis] =
        sign * (fixedAxis === 0 ? l : fixedAxis === 1 ? h : w);
      vertex[3 + fixedAxis] = sign;
      vertices.push(...vertex);

      if (i < uDivisions && j < vDivisions) {
        const topLeft = i * (vDivisions + 1) + j;
        if (sign === 1) {
          // prettier-ignore
          indices.push(
          topLeft, topLeft + 1, topLeft + vDivisions + 2,
          topLeft, topLeft + vDivisions + 2, topLeft + vDivisions + 1,
        );
        } else {
          // prettier-ignore
          indices.push(
          topLeft + vDivisions + 1, topLeft + 1, topLeft, 
          topLeft + vDivisions + 1, topLeft + vDivisions + 2, topLeft + 1, 
          )
        }
      }
    }
  }

  return { vertices, indices };
};

const createBoxVertices = (box: Box) => {
  const divisions = box.divisions ?? new Vec3(1, 1, 1);

  // prettier-ignore
  const facesConfig = [
    { uAxis: 0, vAxis: 1, fixedAxis: 2, uDiv: divisions.x, vDiv: divisions.y, sign: -1 }, // Back
    { uAxis: 0, vAxis: 1, fixedAxis: 2, uDiv: divisions.x, vDiv: divisions.y, sign: 1 },  // Front
    { uAxis: 0, vAxis: 2, fixedAxis: 1, uDiv: divisions.x, vDiv: divisions.z, sign: -1 }, // Bottom
    { uAxis: 0, vAxis: 2, fixedAxis: 1, uDiv: divisions.x, vDiv: divisions.z, sign: 1 },  // Top
    { uAxis: 2, vAxis: 1, fixedAxis: 0, uDiv: divisions.z, vDiv: divisions.y, sign: 1 }, // Left
    { uAxis: 2, vAxis: 1, fixedAxis: 0, uDiv: divisions.z, vDiv: divisions.y, sign: -1 },  // Right
  ];

  let allVertices: number[] = [];
  let allIndices: number[] = [];
  let vertexOffset = 0;

  facesConfig.forEach((face) => {
    const { vertices, indices } = createFaceVertices(
      box,
      face.uAxis,
      face.vAxis,
      face.fixedAxis,
      face.uDiv,
      face.vDiv,
      face.sign,
    );

    allVertices.push(...vertices);
    allIndices.push(...indices.map((i) => i + vertexOffset));
    vertexOffset += vertices.length / 9;
  });

  box.data = {
    vertexData: new Float32Array(allVertices),
    indexData: new Uint32Array(allIndices),
  };
};

const createSphereVertices = (sphere: Sphere) => {
  const r = sphere.radius,
    hPrecision = sphere.hPrec,
    vPrecision = sphere.vPrec;

  const vertexCount = 2 + hPrecision * vPrecision;
  const vertexData = new Float32Array(vertexCount * 9);
  let vI = 0;

  // const getRainbowColor = (t: number): [number, number, number] => {
  //   const r = Math.sin(t) * 0.5 + 0.5;
  //   const g = Math.sin(t + (2 * Math.PI) / 3) * 0.5 + 0.5;
  //   const b = Math.sin(t + (4 * Math.PI) / 3) * 0.5 + 0.5;
  //   return [r, g, b];
  // };

  // Top pole
  vertexData.set([0, r, 0, 0, 1, 0, ...sphere.color], vI);
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
      // const color = getRainbowColor(theta + phi);
      const color = sphere.color;

      vertexData.set([...position, ...normal, ...color], vI);
      vI += 9;
    }
  }

  // Bottom pole
  vertexData.set([0, -r, 0, 0, -1, 0, ...sphere.color], vI);

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

  sphere.data = { vertexData, indexData };
};

const createObjModelVertices = (model: Model, content: string) => {
  const lines = content.split("\n");

  let verts = [];
  let idx = [];

  for (const line of lines) {
    let [command, ...values] = line.split(" ");
    if (command == "v") {
      let vs = [...values.map((v) => Number(v))];
      verts.push(...vs, ...new Vec3(...vs).normalize(), ...model.color);
    } else if (command == "f") {
      let vs = [...values.map((v) => Number(v) - 1)];
      idx.push(...vs);
    }
  }

  const vertexData = new Float32Array(verts);
  const indexData = new Uint32Array(idx);

  model.data = { vertexData, indexData };
};

const createClothVertices = (cloth: Cloth) => {
  const divisions = cloth.divisions ?? new Vec2(1, 1);

  const verts = [];
  const idx = [];

  for (let iY = 0; iY <= divisions.y; iY++) {
    let z = (iY / divisions.y) * cloth.length - cloth.length / 2;
    for (let iX = 0; iX <= divisions.x; iX++) {
      let x = (iX / divisions.x) * cloth.width - cloth.width / 2;

      let t = (iX / divisions.x + iY / divisions.y) / 2;

      // prettier-ignore
      verts.push(
        x, 0, z, // p
        0, 1, 0, // normal
      Math.sin(2 * Math.PI * t) * 0.5 + 0.5, // color
      Math.sin(2 * Math.PI * t + 2 * Math.PI / 3) * 0.5 + 0.5,
      Math.sin(2 * Math.PI * t + 4 * Math.PI / 3) * 0.5 + 0.5,
      );

      if (iY != divisions.y && iX != divisions.x) {
        let offset = iY * (divisions.x + 1);
        // prettier-ignore
        idx.push(
        offset + iX + 1,
        offset + iX,
        (iY + 1) * (divisions.x + 1) + iX ,

        offset + iX + 1,
        (iY + 1) * (divisions.x + 1) + iX ,
        (iY + 1) * (divisions.x + 1) + iX + 1,
      )
      }
    }
  }

  const vertexData = new Float32Array(verts);
  const indexData = new Uint32Array(idx);

  cloth.vertices = [];
  for (let i = 0; i < verts.length; i += 9) {
    cloth.vertices.push({
      p: new Vec3(verts[i], verts[i + 1], verts[i + 2]),
      lastP: new Vec3(verts[i], verts[i + 1], verts[i + 2]),
      a: new Vec3(0, 0, 0),
    });
  }

  cloth.data = { vertexData, indexData };
};
