import { Vec3, Vec2 } from "gl-matrix";
import { Box, Cloth, Sphere } from "./scene";

export default class Modeler {
  private g = new Vec3(0, -9.8, 0);

  step = async (dt: number, cloth: Cloth, sphere: Sphere, ground: Box) => {
    const restD = new Vec2(cloth.width, cloth.length).divide(cloth.divisions);
    const iterations = 10;
    const subDt = dt / iterations;

    for (let iteration = 0; iteration < iterations; iteration++) {
      this.updatePositions(cloth, subDt);
      this.solveConstraints(cloth, restD);
      this.handleCollisions(cloth, sphere, ground);
    }

    this.updateVertexBuffer(cloth);
    this.updateNormals(cloth);
  };

  private updatePositions(cloth: Cloth, dt: number) {
    for (const vertex of cloth.vertices!) {
      const temp = Vec3.clone(vertex.p);

      let newP = Vec3.clone(vertex.p);
      newP.scale(2);
      newP.sub(vertex.lastP) as Vec3;
      let disp = Vec3.scale(new Vec3(), this.g, dt * dt);
      newP.add(disp);

      vertex.p = newP;

      vertex.lastP = temp;
    }
  }

  private solveConstraints(cloth: Cloth, restD: Vec2) {
    const vXCount = cloth.divisions.x + 1;
    const vZCount = cloth.divisions.y + 1;

    for (let i = 0; i < cloth.vertices!.length; i++) {
      const vXI = i % vXCount;
      const vZI = Math.floor(i / vXCount);
      const vertex = cloth.vertices![i];

      const neighbors = [
        vZI > 0 ? cloth.vertices![(vZI - 1) * vXCount + vXI] : null, // top
        vXI < vXCount - 1 ? cloth.vertices![vZI * vXCount + vXI + 1] : null, // right
        vZI < vZCount - 1 ? cloth.vertices![(vZI + 1) * vXCount + vXI] : null, // bottom
        vXI > 0 ? cloth.vertices![vZI * vXCount + vXI - 1] : null, // left
        vXI < vXCount - 2 ? cloth.vertices![vZI * vXCount + vXI + 2] : null, // bendy double
        vZI < vZCount - 2 ? cloth.vertices![(vZI + 2) * vXCount + vXI] : null, //bendy double

        vZI > 0 && vXI > 0
          ? cloth.vertices![(vZI - 1) * vXCount + vXI - 1]
          : null, // top-left
        vZI > 0 && vXI < vXCount - 1
          ? cloth.vertices![(vZI - 1) * vXCount + vXI + 1]
          : null, // top-right
        vZI < vZCount - 1 && vXI > 0
          ? cloth.vertices![(vZI + 1) * vXCount + vXI - 1]
          : null, // bottom-left
        vZI < vZCount - 1 && vXI < vXCount - 1
          ? cloth.vertices![(vZI + 1) * vXCount + vXI + 1]
          : null, // bottom-right
      ];

      neighbors.forEach((neighborVertex, nI) => {
        if (neighborVertex) {
          let restLength;
          let relaxFactor;
          if (nI < 4) {
            restLength = nI % 2 === 0 ? restD.x : restD.y;
            relaxFactor = 0.2;
          } else if (nI < 6) {
            restLength = nI % 2 === 0 ? restD.x * 2 : restD.y * 2;
            relaxFactor = 0.2;
          } else {
            restLength = Math.sqrt(restD.x * restD.x + restD.y * restD.y);
            relaxFactor = 0.1;
          }

          const delta = Vec3.subtract(
            new Vec3(),
            neighborVertex.p,
            vertex.p,
          ) as Vec3;
          const currentLength = delta.magnitude;
          const correction = delta.scale(
            ((currentLength - restLength) / currentLength) * relaxFactor,
          );
          vertex.p.add(correction);
          neighborVertex.p.subtract(correction);
        }
      });
    }
  }

  private handleCollisions(cloth: Cloth, sphere: Sphere, ground: Box) {
    const mu = 0.01;
    const cr = 0.2;

    for (const vertex of cloth.vertices!) {
      const gVertexP = Vec3.add(new Vec3(), cloth.p, vertex.p) as Vec3;

      const distFromSphere = Vec3.distance(gVertexP, sphere.p) - sphere.radius;
      if (distFromSphere <= 0.1) {
        const dir = (
          Vec3.subtract(new Vec3(), gVertexP, sphere.p) as Vec3
        ).normalize();
        const penetrationDepth = sphere.radius + 0.1 - distFromSphere;
        const correction = dir.scale(penetrationDepth * 0.004);
        vertex.p.add(correction);
        vertex.lastP.add(correction.scale(0.5));
      }

      const distFromGround = gVertexP.y;
      if (distFromGround <= 0.1) {
        if (
          gVertexP.x < ground.width / 2 &&
          gVertexP.x > -ground.width / 2 &&
          gVertexP.z < ground.length / 2 &&
          gVertexP.z > -ground.length / 2
        ) {
          const penetrationDepth = 0.1 - distFromGround;
          const correction = new Vec3(0, 1, 0).scale(penetrationDepth);
          vertex.p.add(correction);

          const velocity = Vec3.subtract(
            new Vec3(),
            vertex.p,
            vertex.lastP,
          ) as Vec3;

          velocity.x *= 1 - mu;
          velocity.z *= 1 - mu;

          velocity.y *= -cr;

          vertex.lastP = Vec3.subtract(new Vec3(), vertex.p, velocity) as Vec3;
        }
      }
    }
  }

  private updateVertexBuffer(cloth: Cloth) {
    const vertexData = cloth.data!.vertexData;
    for (let i = 0; i < cloth.vertices!.length; i++) {
      const baseIndex = i * 9;
      vertexData[baseIndex] = cloth.vertices![i].p[0];
      vertexData[baseIndex + 1] = cloth.vertices![i].p[1];
      vertexData[baseIndex + 2] = cloth.vertices![i].p[2];
    }
  }

  private updateNormals(cloth: Cloth) {
    const normals: Vec3[] = cloth.vertices!.map(() => new Vec3(0, 0, 0));

    const calculateTriangleNormal = (v1: Vec3, v2: Vec3, v3: Vec3): Vec3 => {
      const edge1 = Vec3.subtract(Vec3.create(), v2, v1);
      const edge2 = Vec3.subtract(Vec3.create(), v3, v1);
      const normal = Vec3.cross(Vec3.create(), edge1, edge2);
      Vec3.normalize(normal, normal);
      return normal as Vec3;
    };

    for (let i = 0; i < cloth.data!.indexData.length; i += 3) {
      const idx1 = cloth.data!.indexData[i];
      const idx2 = cloth.data!.indexData[i + 1];
      const idx3 = cloth.data!.indexData[i + 2];

      const v1 = cloth.vertices![idx1].p;
      const v2 = cloth.vertices![idx2].p;
      const v3 = cloth.vertices![idx3].p;

      const normal = calculateTriangleNormal(v1, v2, v3);

      Vec3.add(normals[idx1], normals[idx1], normal);
      Vec3.add(normals[idx2], normals[idx2], normal);
      Vec3.add(normals[idx3], normals[idx3], normal);
    }

    normals.forEach((normal) => Vec3.normalize(normal, normal));

    const vertexData = cloth.data!.vertexData;
    for (let i = 0; i < cloth.vertices!.length; i++) {
      const baseIndex = i * 9;
      vertexData[baseIndex + 3] = normals[i].x;
      vertexData[baseIndex + 4] = normals[i].y;
      vertexData[baseIndex + 5] = normals[i].z;
    }
  }
}
