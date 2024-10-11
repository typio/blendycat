import { Vec3 } from "gl-matrix";
import Scene, { Sphere } from "./scene";

export default class Modeler {
  private g = -9.8;
  private cR = 0.8;
  private mu = 0.98;

  step = (scene: Scene, dt: number) => {
    const sphere = scene.objects[1] as Sphere;
    if (!sphere) return;

    const collisionY = 0 + sphere.radius;

    sphere.a.y = this.g;

    Vec3.scaleAndAdd(sphere.v, sphere.v, sphere.a, dt);
    Vec3.scaleAndAdd(sphere.p, sphere.p, sphere.v, dt);

    if (sphere.p.y < collisionY) {
      sphere.p.y = collisionY;
      sphere.v.y = -sphere.v.y * this.cR;
    }
  };
}
