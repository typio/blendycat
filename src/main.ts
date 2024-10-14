import "./style.css";
import Renderer from "./renderer";
import Modeler from "./modeler";
import Scene, { ObjectKind, Cloth, Sphere, Box } from "./scene";
import { Vec2 } from "../node_modules/gl-matrix/dist/esm/f64/vec2.js";
import { Vec3 } from "../node_modules/gl-matrix/dist/esm/f64/vec3.js";

const canvas = document.createElement("canvas");
document.querySelector<HTMLDivElement>("#app")!.appendChild(canvas);

const main = async () => {
  console.log("Start!");
  const scene = new Scene([
    {
      kind: ObjectKind.Box,
      length: 15,
      width: 15,
      height: 0.25,

      color: new Vec3(30).scale(1 / 255),
      p: new Vec3(0, -0.125, 0),
      v: new Vec3(0, 0, 0),
      a: new Vec3(0, 0, 0),
    },
    {
      kind: ObjectKind.Sphere,
      radius: 1,
      hPrec: 50,
      vPrec: 50,

      color: new Vec3(30, 50, 250).scale(1 / 255),
      p: new Vec3(0, 1, 0),
      v: new Vec3(0, 0, 0),
      a: new Vec3(0, 0, 0),
    },
    {
      kind: ObjectKind.Cloth,
      length: 3,
      width: 3,
      divisions: new Vec2(30),

      color: new Vec3(220, 220, 220).scale(1 / 255),
      p: new Vec3(0, 5, 0),
      v: new Vec3(0, 0, 0),
      a: new Vec3(0, 0, 0),
    },
    {
      kind: ObjectKind.Model,
      filepath: "teapot.obj",

      color: new Vec3(40).scale(1 / 255),
      p: new Vec3(-5, 0, -5),
      v: new Vec3(0, 0, 0),
      a: new Vec3(0, 0, 0),
    },
  ]);

  try {
    const modeler = new Modeler();
    const renderer = new Renderer(canvas);
    await renderer.init();

    await scene.getVertices();

    const triangleCountEl = document.createElement("p");
    let triangleCount = 0;
    triangleCountEl.style.margin = "0";
    document
      .querySelector<HTMLDivElement>("#app")!
      .appendChild(triangleCountEl);

    const fpsEl = document.createElement("p");
    fpsEl.style.margin = "0";
    document.querySelector<HTMLDivElement>("#app")!.appendChild(fpsEl);

    const zero = performance.now();
    let lastTime = zero;
    const animate = (timestamp: number) => {
      const dt = (timestamp - lastTime) / 1e3;
      modeler.step(
        dt,
        scene.objects[2] as Cloth,
        scene.objects[1] as Sphere,
        scene.objects[0] as Box,
      );
      renderer.render(timestamp - zero, scene);

      let newTriangleCountNumber =
        renderer.indexBuffers.reduce((acc, curr) => acc + curr.size, 0) /
        (3 * 4);

      if (triangleCount != newTriangleCountNumber) {
        triangleCount = newTriangleCountNumber;
        triangleCountEl.innerText = `${newTriangleCountNumber} triangles`;
      }
      fpsEl.innerText = `${Math.round(1 / dt)}fps`;

      lastTime = timestamp;
      requestAnimationFrame((t) => animate(t));
    };
    requestAnimationFrame(animate);
  } catch (e) {
    console.error(e);
  }
};

main();
