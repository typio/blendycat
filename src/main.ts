import "./style.css";
import Renderer from "./renderer";
import Modeler from "./modeler";
import Scene, { PrimitiveObject } from "./scene";
import { Vec3 } from "gl-matrix";

const canvas = document.createElement("canvas");
document.querySelector<HTMLDivElement>("#app")!.appendChild(canvas);

const main = async () => {
  const scene = new Scene([
    {
      kind: PrimitiveObject.Box,
      length: 5,
      width: 5,
      height: 0.1,

      color: { r: 155, g: 10, b: 15 },
      p: new Vec3(0, -0.05, 0),
      v: new Vec3(0, 0, 0),
      a: new Vec3(0, 0, 0),
    },
    {
      kind: PrimitiveObject.Sphere,
      radius: 1,
      hPrec: 50,
      vPrec: 50,

      color: { r: 5, g: 10, b: 200 },
      p: new Vec3(0, 5, 0),
      v: new Vec3(0, 0, 0),
      a: new Vec3(0, 0, 0),
    },
  ]);

  try {
    const modeler = new Modeler();
    const renderer = new Renderer(canvas);
    await renderer.init();

    scene.getVertices();

    const triangleCount = document.createElement("p");
    let triangleCountNumber = 0;
    triangleCount.style.margin = "0";
    document.querySelector<HTMLDivElement>("#app")!.appendChild(triangleCount);

    const zero = performance.now();
    let lastTime = zero;
    const animate = (timestamp: number) => {
      modeler.step(scene, (timestamp - lastTime) / 1e3);
      renderer.render(timestamp - zero, scene);

      let newTriangleCountNumber =
        renderer.indexBuffers.reduce((acc, curr) => acc + curr.size, 0) /
        (3 * 4);
      if (triangleCountNumber != newTriangleCountNumber) {
        triangleCountNumber = newTriangleCountNumber;
        triangleCount.innerText = `${newTriangleCountNumber} triangles`;
      }

      lastTime = timestamp;
      requestAnimationFrame((t) => animate(t));
    };
    requestAnimationFrame(animate);
  } catch (e) {
    console.error(e);
  }
};

main();
