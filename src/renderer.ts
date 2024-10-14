import Scene from "./scene";
import { Mat4, Vec3 } from "gl-matrix";

const wgsl = String.raw;

class Camera {
  p: Vec3;
  target: Vec3;
  up: Vec3;
  aspect: number;
  fov: number;
  near: number;
  far: number;
  spherical: Vec3 = new Vec3();

  private canvas: HTMLCanvasElement;
  private lastMouse: { x: number; y: number };
  private clicked: boolean;

  constructor(
    canvas: HTMLCanvasElement,
    aspect: number,
    initialPosition?: Vec3,
    initialTarget?: Vec3,
  ) {
    this.p = Vec3.fromValues(0, 0, 0);
    this.target = Vec3.fromValues(0, 0, 0);
    this.up = Vec3.fromValues(0, 1, 0);
    this.aspect = aspect;
    this.fov = Math.PI / 4;
    this.near = 0.1;
    this.far = 100;

    this.target = initialTarget
      ? Vec3.clone(initialTarget)
      : Vec3.fromValues(0, 0, 0);
    this.p = initialPosition
      ? Vec3.clone(initialPosition)
      : Vec3.fromValues(0, 0, 15);

    this.calculateSphericalCoordinates();

    this.canvas = canvas;
    this.lastMouse = { x: 0, y: 0 };
    this.clicked = false;

    this.setupEventListeners();
    this.updatePosition();
  }

  calculateSphericalCoordinates() {
    const diff = Vec3.sub(Vec3.create(), this.p, this.target);
    const r = Vec3.length(diff);
    const theta = Math.atan2(diff[2], diff[0]);
    const phi = Math.acos(diff[1] / r);
    this.spherical = Vec3.fromValues(r, theta, phi);
  }

  setPosition(position: Vec3, target?: Vec3) {
    Vec3.copy(this.p, position);
    if (target) {
      Vec3.copy(this.target, target);
    }
    this.calculateSphericalCoordinates();
    this.updatePosition();
  }

  setupEventListeners() {
    const speed = 1;
    window.addEventListener("keydown", ({ code }) => {
      switch (code) {
        case "KeyA":
        case "ArrowLeft":
          this.p.x -= speed;
          this.target.x -= speed;
          break;
        case "KeyD":
        case "ArrowRight":
          this.p.x += speed;
          this.target.x += speed;
          break;
        case "KeyW":
        case "ArrowUp":
          this.p.z -= speed;
          this.target.z -= speed;
          break;
        case "KeyS":
        case "ArrowDown":
          this.p.z += speed;
          this.target.z += speed;
          break;
        case "KeyQ":
          this.p.y -= speed;
          this.target.y -= speed;
          break;
        case "KeyE":
          this.p.y += speed;
          this.target.y += speed;
          break;
      }
    });

    this.canvas.addEventListener("mousedown", (e) => {
      this.clicked = true;
      this.lastMouse.x = e.clientX;
      this.lastMouse.y = e.clientY;
    });

    window.addEventListener("mouseup", () => {
      this.clicked = false;
    });

    this.canvas.addEventListener("mousemove", (e) => {
      if (this.clicked) {
        const deltaX = e.clientX - this.lastMouse.x;
        const deltaY = e.clientY - this.lastMouse.y;
        this.rotate(deltaX, deltaY);
        this.lastMouse.x = e.clientX;
        this.lastMouse.y = e.clientY;
      }
    });

    this.canvas.addEventListener("wheel", (e) => {
      this.zoom(e.deltaY);
      e.preventDefault();
    });
  }

  rotate(deltaX: number, deltaY: number) {
    const sensitivity = 0.01;

    this.spherical[1] -= deltaX * sensitivity;
    this.spherical[2] = Math.max(
      0.1,
      Math.min(Math.PI - 0.1, this.spherical[2] + deltaY * sensitivity),
    );

    this.updatePosition();
  }

  zoom(delta: number) {
    const zoomSensitivity = 0.005;
    this.spherical[0] = Math.max(
      1,
      this.spherical[0] + delta * zoomSensitivity,
    );
    this.updatePosition();
  }

  updatePosition() {
    const [r, theta, phi] = this.spherical;
    this.p = Vec3.fromValues(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta),
    );
    Vec3.add(this.p, this.p, this.target);
  }

  pan(deltaX: number, deltaY: number) {
    const sensitivity = 0.005;
    const right = Vec3.cross(
      Vec3.create(),
      Vec3.subtract(Vec3.create(), this.target, this.p),
      this.up,
    );
    Vec3.normalize(right, right);

    const deltaRight = Vec3.scale(Vec3.create(), right, -deltaX * sensitivity);
    const deltaUp = Vec3.scale(Vec3.create(), this.up, -deltaY * sensitivity);

    Vec3.add(this.p, this.p, deltaRight);
    Vec3.add(this.p, this.p, deltaUp);
    Vec3.add(this.target, this.target, deltaRight);
    Vec3.add(this.target, this.target, deltaUp);
  }

  getViewProjectionMatrix(): Mat4 {
    const viewMatrix = Mat4.lookAt(Mat4.create(), this.p, this.target, this.up);
    const projectionMatrix = Mat4.perspective(
      Mat4.create(),
      this.fov,
      this.aspect,
      this.near,
      this.far,
    );
    const viewProjectionMatrix = Mat4.multiply(
      Mat4.create(),
      projectionMatrix,
      viewMatrix,
    );
    return viewProjectionMatrix as Mat4;
  }
}

class Light {
  p: Vec3;
  color: Vec3;

  constructor() {
    this.p = Vec3.fromValues(100, 100, 100);
    this.color = Vec3.fromValues(1, 1, 1);
  }
}

export default class Renderer {
  canvas: HTMLCanvasElement;
  context: GPUCanvasContext;
  adapter: GPUAdapter | undefined;
  device: GPUDevice | undefined;
  textureFormat: GPUTextureFormat | undefined;

  vertexBuffers: GPUBuffer[] = [];
  indexBuffers: GPUBuffer[] = [];
  indexCounts: number[] = [];

  camera: Camera;
  light: Light;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    this.context = ((context) => {
      if (context === null) throw new Error("Failed to get canvas context");
      else return context;
    })(this.canvas.getContext("webgpu"));

    this.camera = new Camera(
      this.canvas,
      this.canvas.width / this.canvas.height,
      new Vec3(0, 9, 9),
    );
    this.light = new Light();
  }

  resize = () => {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = window.innerWidth + "px";
    this.canvas.style.height = window.innerHeight + "px";

    if (this.device && this.textureFormat) {
      const canvasConfig: GPUCanvasConfiguration = {
        device: this.device!,
        format: this.textureFormat!,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
        alphaMode: "opaque",
      };

      this.context.configure(canvasConfig);
    }

    this.camera.aspect = this.canvas.width / this.canvas.height;
  };

  async init(): Promise<void> {
    const entry: GPU = navigator.gpu;
    if (!entry) {
      throw new Error(
        "Failed to connect to GPU, your device or browser might not support webGPU yet.",
      );
    }

    this.adapter = ((a) => {
      if (a === null) throw new Error("Failed to get adapter");
      else return a;
    })(await entry.requestAdapter());

    this.device = ((d) => {
      if (d === null) throw new Error();
      else return d;
    })(await this.adapter.requestDevice());
    this.device.lost.then((info) => {
      console.error(`WebGPU device was lost: ${info.message}`);
    });

    this.textureFormat = navigator.gpu.getPreferredCanvasFormat();

    this.resize();
    window.addEventListener("resize", this.resize);
  }

  render = (_timeElapsed: number, scene: Scene) => {
    const uniformBufferSize = 16 * 4 + (3 * 4 + 4) + (3 * 4 + 4);
    const uniformBuffer = this.device!.createBuffer({
      size: uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const uniformData = new Float32Array(uniformBufferSize / 4);
    uniformData.set(this.camera.getViewProjectionMatrix() as Float32Array, 0);
    uniformData.set(this.camera.p, 16);
    uniformData.set(this.light.p, 20);
    this.device!.queue.writeBuffer(uniformBuffer, 0, uniformData);

    const instanceData = new Float32Array(scene.objects.length * 3);
    scene.objects.forEach((obj, i) => {
      instanceData.set([obj.p.x, obj.p.y, obj.p.z], i * 3);
    });

    scene.objects.forEach((obj, i) => {
      if (!obj.data) return;
      const { vertexData, indexData } = obj.data;

      const vertexBuffer = this.device!.createBuffer({
        label: `vertex buffer ${i}`,
        size: vertexData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
      this.device!.queue.writeBuffer(vertexBuffer, 0, vertexData);
      this.vertexBuffers[i] = vertexBuffer;

      const indexBuffer = this.device!.createBuffer({
        label: `index buffer ${i}`,
        size: indexData.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      });
      this.device!.queue.writeBuffer(indexBuffer, 0, indexData);
      this.indexBuffers[i] = indexBuffer;

      this.indexCounts[i] = indexData.length;
    });

    const instanceBuffer = this.device!.createBuffer({
      label: "instance buffer",
      size: instanceData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device!.queue.writeBuffer(instanceBuffer, 0, instanceData);

    const module = this.device!.createShaderModule({
      label: "main module",
      code: wgsl`
        @binding(0) @group(0) var<uniform> uniforms : Uniforms;
        struct Uniforms {
          viewProjectionMatrix: mat4x4<f32>,
          cameraP: vec3<f32>,
          lightP: vec3<f32>,
        };

        struct VertexInput {
          @builtin(vertex_index) vI: u32,
          @location(0) p: vec3f,
          @location(1) normal: vec3f,
          @location(2) color: vec3f,
          @location(3) instanceP: vec3f,
        };

        struct VertexOutput {
          @builtin(position) p: vec4f,
          @location(0) worldP: vec3f,
          @location(1) normal: vec3f,
          @location(2) @interpolate(flat) color: vec3f
        };

        @vertex fn vs(input: VertexInput) -> VertexOutput {
          var output: VertexOutput;
          var worldP = input.p + input.instanceP;  
          // stop clipping when folded over in Y
          worldP.y = worldP.y - f32(input.vI) * 0.000001;
          output.p = uniforms.viewProjectionMatrix * vec4f(worldP, 1.0);
          output.worldP = worldP;
          output.normal = input.normal;
          output.color = input.color;
          return output;
        }

        @fragment fn fs(input: VertexOutput) -> @location(0) vec4f {
          let lightColor = vec3f(1.0, 1.0, 1.0);
          let objectColor = input.color;  
          let ambientStrength = 0.3;
          let specularStrength = 1.5;
          let shininess = 1.0;
          // Ambient
          let ambient = ambientStrength * lightColor;
          // Diffuse
          let normalizedNormal = normalize(input.normal);
          let lightDir = normalize(uniforms.lightP - input.worldP);
          let diff = max(dot(normalizedNormal, lightDir), 0.0);
          let diffuse = diff * lightColor;
          // Specular
          let viewDir = normalize(uniforms.cameraP - input.worldP);
          let reflectDir = reflect(-lightDir, normalizedNormal);
          let spec = pow(max(dot(viewDir, reflectDir), 0.0), shininess);
          let specular = specularStrength * spec * lightColor;
          let result = (ambient + diffuse + specular) * objectColor;
          return vec4f(result, 1.0);
        }


`,
    });

    const bindGroupLayout = this.device!.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
      ],
    });

    const bindGroup = this.device!.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: uniformBuffer },
        },
      ],
    });

    const pipeline = this.device!.createRenderPipeline({
      layout: this.device!.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      }),
      vertex: {
        module,
        buffers: [
          {
            arrayStride: 9 * 4,
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x3" },
              { shaderLocation: 1, offset: 3 * 4, format: "float32x3" },
              { shaderLocation: 2, offset: 6 * 4, format: "float32x3" },
            ],
            stepMode: "vertex",
          },
          {
            arrayStride: 3 * 4,
            attributes: [{ shaderLocation: 3, offset: 0, format: "float32x3" }],
            stepMode: "instance",
          },
        ],
      },
      fragment: {
        module,
        entryPoint: "fs",
        targets: [{ format: this.textureFormat! }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none", // 'back',
        frontFace: "ccw",
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth24plus",
      },
    });

    const depthTexture = this.device!.createTexture({
      size: [this.canvas.width, this.canvas.height],
      format: "depth24plus",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [],
    };

    renderPassDescriptor.colorAttachments = [
      {
        view: this.context.getCurrentTexture().createView(),
        clearValue: [0, 0, 0, 1],
        loadOp: "clear",
        storeOp: "store",
      },
    ];

    renderPassDescriptor.depthStencilAttachment = {
      view: depthTexture.createView(),
      depthClearValue: 1.0,
      depthLoadOp: "clear",
      depthStoreOp: "store",
    };

    const encoder = this.device!.createCommandEncoder();

    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    scene.objects.forEach((_, i) => {
      pass.setVertexBuffer(0, this.vertexBuffers[i]);
      pass.setVertexBuffer(1, instanceBuffer);
      pass.setIndexBuffer(this.indexBuffers[i], "uint32");
      pass.drawIndexed(this.indexCounts[i], 1, 0, 0, i);
    });
    pass.end();

    const commandBuffer = encoder.finish();
    this.device!.queue.submit([commandBuffer]);
  };
}
