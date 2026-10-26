// @ts-nocheck
"use client";
/* LiquidEther — React Bits WebGL fluid simulation.
   Ported from the user's reference .jsx. Three.js-based incompressible
   Navier-Stokes solver on GPU render targets with a palette splat shader.
   Converted to .tsx with ts-nocheck because the WebGL/GLSL plumbing is
   loose JS and leans heavily on dynamic property access. */

import { useEffect, useRef, type CSSProperties } from "react";
import * as THREE from "three";
import "./LiquidEther.css";

function makePaletteTexture(stops) {
    const arr = new Uint8Array(stops.length * 4);
    for (let i = 0; i < stops.length; i++) {
        const c = new THREE.Color(stops[i]);
        arr[i * 4 + 0] = Math.round(c.r * 255);
        arr[i * 4 + 1] = Math.round(c.g * 255);
        arr[i * 4 + 2] = Math.round(c.b * 255);
        arr[i * 4 + 3] = 255;
    }
    const tex = new THREE.DataTexture(arr, stops.length, 1, THREE.RGBAFormat);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    tex.generateMipmaps = false;
    return tex;
}

const face_vert = `
attribute vec3 position;
uniform vec2 px;
uniform vec2 boundarySpace;
varying vec2 uv;
precision highp float;
void main(){
    vec3 pos = position;
    vec2 scale = 1.0 - boundarySpace * 2.0;
    pos.xy = pos.xy * scale;
    uv = vec2(0.5)+(pos.xy)*0.5;
    gl_Position = vec4(pos, 1.0);
}
`;

const line_vert = `
attribute vec3 position;
uniform vec2 px;
precision highp float;
varying vec2 uv;
void main(){
    vec3 pos = position;
    uv = 0.5 + pos.xy * 0.5;
    vec2 n = sign(pos.xy);
    pos.xy = abs(pos.xy) - px * 1.0;
    pos.xy *= n;
    gl_Position = vec4(pos, 1.0);
}
`;

const mouse_vert = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform vec2 center;
uniform vec2 scale;
uniform vec2 px;
varying vec2 vUv;
void main(){
    vec2 pos = position.xy * scale * 2.0 * px + center;
    vUv = uv;
    gl_Position = vec4(pos, 0.0, 1.0);
}
`;

const advection_frag = `
precision highp float;
uniform sampler2D velocity;
uniform float dt;
uniform bool isBFECC;
uniform vec2 fboSize;
uniform vec2 px;
varying vec2 uv;
void main(){
    vec2 ratio = max(fboSize.x, fboSize.y) / fboSize;
    if (isBFECC == false) {
        vec2 vel = texture2D(velocity, uv).xy;
        vec2 uv2 = uv - vel * dt * ratio;
        vec2 newVel = texture2D(velocity, uv2).xy;
        gl_FragColor = vec4(newVel, 0.0, 0.0);
    } else {
        vec2 spot_new = uv;
        vec2 vel_old = texture2D(velocity, uv).xy;
        vec2 spot_old = spot_new - vel_old * dt * ratio;
        vec2 vel_new1 = texture2D(velocity, spot_old).xy;

        vec2 spot_new2 = spot_old + vel_new1 * dt * ratio;
        vec2 error = spot_new2 - spot_new;

        vec2 spot_new3 = spot_new - error / 2.0;
        vec2 vel_2 = texture2D(velocity, spot_new3).xy;

        vec2 spot_old2 = spot_new3 - vel_2 * dt * ratio;
        vec2 newVel2 = texture2D(velocity, spot_old2).xy;
        gl_FragColor = vec4(newVel2, 0.0, 0.0);
    }
}
`;

const color_frag = `
precision highp float;
uniform sampler2D velocity;
uniform sampler2D palette;
uniform vec4 bgColor;
varying vec2 uv;
void main(){
    vec2 vel = texture2D(velocity, uv).xy;
    float lenv = clamp(length(vel), 0.0, 1.0);
    vec3 c = texture2D(palette, vec2(lenv, 0.5)).rgb;
    vec3 outRGB = mix(bgColor.rgb, c, lenv);
    float outA = mix(bgColor.a, 1.0, lenv);
    gl_FragColor = vec4(outRGB, outA);
}
`;

const divergence_frag = `
precision highp float;
uniform sampler2D velocity;
uniform float dt;
uniform vec2 px;
varying vec2 uv;
void main(){
    float x0 = texture2D(velocity, uv-vec2(px.x, 0)).x;
    float x1 = texture2D(velocity, uv+vec2(px.x, 0)).x;
    float y0 = texture2D(velocity, uv-vec2(0, px.y)).y;
    float y1 = texture2D(velocity, uv+vec2(0, px.y)).y;
    float divergence = (x1-x0 + y1-y0) / 2.0;
    gl_FragColor = vec4(divergence / dt);
}
`;

const externalForce_frag = `
precision highp float;
uniform vec2 force;
uniform vec2 center;
uniform vec2 scale;
varying vec2 vUv;
void main(){
    vec2 circle = (vUv - 0.5) * 2.0;
    float d = 1.0 - min(length(circle), 1.0);
    d *= d;
    gl_FragColor = vec4(force * d, 0, 1);
}
`;

const poisson_frag = `
precision highp float;
uniform sampler2D pressure;
uniform sampler2D divergence;
uniform vec2 px;
varying vec2 uv;
void main(){
    float p0 = texture2D(pressure, uv+vec2(px.x * 2.0, 0)).r;
    float p1 = texture2D(pressure, uv-vec2(px.x * 2.0, 0)).r;
    float p2 = texture2D(pressure, uv+vec2(0, px.y * 2.0)).r;
    float p3 = texture2D(pressure, uv-vec2(0, px.y * 2.0)).r;
    float div = texture2D(divergence, uv).r;
    float newP = (p0 + p1 + p2 + p3) / 4.0 - div;
    gl_FragColor = vec4(newP);
}
`;

const pressure_frag = `
precision highp float;
uniform sampler2D pressure;
uniform sampler2D velocity;
uniform vec2 px;
uniform float dt;
varying vec2 uv;
void main(){
    float step = 1.0;
    float p0 = texture2D(pressure, uv+vec2(px.x * step, 0)).r;
    float p1 = texture2D(pressure, uv-vec2(px.x * step, 0)).r;
    float p2 = texture2D(pressure, uv+vec2(0, px.y * step)).r;
    float p3 = texture2D(pressure, uv-vec2(0, px.y * step)).r;
    vec2 v = texture2D(velocity, uv).xy;
    vec2 gradP = vec2(p0 - p1, p2 - p3) * 0.5;
    v = v - gradP * dt;
    gl_FragColor = vec4(v, 0.0, 1.0);
}
`;

const viscous_frag = `
precision highp float;
uniform sampler2D velocity;
uniform sampler2D velocity_new;
uniform float v;
uniform vec2 px;
uniform float dt;
varying vec2 uv;
void main(){
    vec2 old = texture2D(velocity, uv).xy;
    vec2 new0 = texture2D(velocity_new, uv + vec2(px.x * 2.0, 0)).xy;
    vec2 new1 = texture2D(velocity_new, uv - vec2(px.x * 2.0, 0)).xy;
    vec2 new2 = texture2D(velocity_new, uv + vec2(0, px.y * 2.0)).xy;
    vec2 new3 = texture2D(velocity_new, uv - vec2(0, px.y * 2.0)).xy;
    vec2 newv = 4.0 * old + v * dt * (new0 + new1 + new2 + new3);
    newv /= 4.0 * (1.0 + v * dt);
    gl_FragColor = vec4(newv, 0.0, 0.0);
}
`;

class CommonClass {
    constructor() {
        this.width = 0;
        this.height = 0;
        this.aspect = 1;
        this.pixelRatio = 1;
        this.isMobile = false;
        this.breakpoint = 768;
        this.fboWidth = null;
        this.fboHeight = null;
        this.resolution = 0.5;
        this.renderer = null;
        this.clock = null;
    }
    init(container, pixelRatio) {
        this.pixelRatio = pixelRatio || Math.min(window.devicePixelRatio || 1, 2);
        this.resize(container);
        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, premultipliedAlpha: true });
        this.renderer.autoClear = false;
        this.renderer.setClearColor(new THREE.Color(0x000000), 0);
        this.renderer.setPixelRatio(this.pixelRatio);
        this.renderer.setSize(this.width, this.height);
        this.clock = new THREE.Clock();
        this.clock.start();
    }
    resize(container) {
        const rect = container.getBoundingClientRect();
        this.width = Math.max(1, rect.width | 0);
        this.height = Math.max(1, rect.height | 0);
        this.aspect = this.width / this.height;
        this.fboWidth = Math.round(this.width * this.resolution);
        this.fboHeight = Math.round(this.height * this.resolution);
    }
    update(container) {
        this.resize(container);
        this.renderer.setPixelRatio(this.pixelRatio);
        this.renderer.setSize(this.width, this.height);
    }
}

class MouseClass {
    constructor() {
        this.mouseMoved = false;
        this.coords = new THREE.Vector2();
        this.coords_old = new THREE.Vector2();
        this.diff = new THREE.Vector2();
        this.timer = null;
        this.container = null;
        this.isHoverInside = false;
        this.hasUserControl = false;
        this.isAutoActive = false;
        this.autoIntensity = 2.2;
        this.takeoverActive = false;
        this.takeoverStartTime = 0;
        this.takeoverDuration = 0.25;
        this.takeoverFrom = new THREE.Vector2();
        this.takeoverTo = new THREE.Vector2();
        this.onInteract = null;
        this._onMouseMove = this.onDocumentMouseMove.bind(this);
        this._onTouchStart = this.onDocumentTouchStart.bind(this);
        this._onTouchMove = this.onDocumentTouchMove.bind(this);
        this._onMouseEnter = this.onMouseEnter.bind(this);
        this._onMouseLeave = this.onMouseLeave.bind(this);
        this._onTouchEnd = this.onTouchEnd.bind(this);
    }
    init(container) {
        this.container = container;
        container.addEventListener("mousemove", this._onMouseMove, false);
        container.addEventListener("touchstart", this._onTouchStart, false);
        container.addEventListener("touchmove", this._onTouchMove, false);
        container.addEventListener("mouseenter", this._onMouseEnter, false);
        container.addEventListener("mouseleave", this._onMouseLeave, false);
        container.addEventListener("touchend", this._onTouchEnd, false);
    }
    dispose() {
        if (!this.container) return;
        const c = this.container;
        c.removeEventListener("mousemove", this._onMouseMove, false);
        c.removeEventListener("touchstart", this._onTouchStart, false);
        c.removeEventListener("touchmove", this._onTouchMove, false);
        c.removeEventListener("mouseenter", this._onMouseEnter, false);
        c.removeEventListener("mouseleave", this._onMouseLeave, false);
        c.removeEventListener("touchend", this._onTouchEnd, false);
        this.container = null;
    }
    setCoords(x, y) {
        if (this.timer) clearTimeout(this.timer);
        const rect = this.container.getBoundingClientRect();
        const nx = ((x - rect.left) / rect.width) * 2 - 1;
        const ny = -(((y - rect.top) / rect.height) * 2 - 1);
        this.coords.set(nx, ny);
        this.mouseMoved = true;
        this.timer = setTimeout(() => {
            this.mouseMoved = false;
        }, 100);
    }
    setNormalized(nx, ny) {
        this.coords.set(nx, ny);
        this.mouseMoved = true;
    }
    onDocumentMouseMove(event) {
        if (this.onInteract) this.onInteract();
        if (this.isAutoActive && !this.hasUserControl && !this.takeoverActive) {
            const rect = this.container.getBoundingClientRect();
            const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            const ny = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
            this.takeoverFrom.copy(this.coords);
            this.takeoverTo.set(nx, ny);
            this.takeoverStartTime = performance.now();
            this.takeoverActive = true;
            this.hasUserControl = true;
            this.isAutoActive = false;
            return;
        }
        this.setCoords(event.clientX, event.clientY);
        this.hasUserControl = true;
    }
    onDocumentTouchStart(event) {
        if (event.touches.length === 1) {
            const t = event.touches[0];
            if (this.onInteract) this.onInteract();
            this.setCoords(t.pageX, t.pageY);
            this.hasUserControl = true;
        }
    }
    onDocumentTouchMove(event) {
        if (event.touches.length === 1) {
            const t = event.touches[0];
            if (this.onInteract) this.onInteract();
            this.setCoords(t.pageX, t.pageY);
        }
    }
    onTouchEnd() {
        this.isHoverInside = false;
    }
    onMouseEnter() {
        this.isHoverInside = true;
    }
    onMouseLeave() {
        this.isHoverInside = false;
    }
    update() {
        if (this.takeoverActive) {
            const t = (performance.now() - this.takeoverStartTime) / (this.takeoverDuration * 1000);
            if (t >= 1) {
                this.takeoverActive = false;
                this.coords.copy(this.takeoverTo);
                this.coords_old.copy(this.coords);
                this.diff.set(0, 0);
            } else {
                const k = t * t * (3 - 2 * t);
                this.coords.copy(this.takeoverFrom).lerp(this.takeoverTo, k);
            }
        }
        this.diff.subVectors(this.coords, this.coords_old);
        this.coords_old.copy(this.coords);
        if (this.coords_old.x === 0 && this.coords_old.y === 0) this.diff.set(0, 0);
        if (this.isAutoActive && !this.takeoverActive) this.diff.multiplyScalar(this.autoIntensity);
    }
}

class AutoDriver {
    constructor(manager, sim, opts) {
        this.manager = manager;
        this.sim = sim;
        this.enabled = opts.enabled;
        this.speed = opts.speed;
        this.resumeDelay = opts.resumeDelay;
        this.rampDuration = opts.rampDuration ?? 1;
        this.active = false;
        this.current = new THREE.Vector2(0, 0);
        this.target = new THREE.Vector2();
        this.lastTime = performance.now();
        this.activationTime = 0;
        this.margin = 0.2;
        this._tmpDir = new THREE.Vector2();
        this.pickNewTarget();
    }
    pickNewTarget() {
        const r = Math.random;
        this.target.set((r() * 2 - 1) * (1 - this.margin), (r() * 2 - 1) * (1 - this.margin));
    }
    forceStop() {
        this.active = false;
        this.manager.isAutoActive = false;
    }
    update() {
        if (!this.enabled) return;
        const now = performance.now();
        const idle = now - this.manager.lastUserInteraction;
        if (!this.active) {
            if (idle >= this.resumeDelay) {
                this.active = true;
                this.current.copy(this.manager.coords);
                this.lastTime = now;
                this.activationTime = now;
                this.manager.isAutoActive = true;
            } else {
                return;
            }
        }
        if (this.manager.hasUserControl) {
            this.active = false;
            this.manager.isAutoActive = false;
            return;
        }
        const dt = (now - this.lastTime) / 1000;
        this.lastTime = now;
        const dir = this._tmpDir.subVectors(this.target, this.current);
        const dist = dir.length();
        if (dist < 0.01) {
            this.pickNewTarget();
            return;
        }
        dir.normalize();
        const rampT = Math.min(1, (now - this.activationTime) / (this.rampDuration * 1000));
        const easedRamp = rampT * rampT * (3 - 2 * rampT);
        const step = this.speed * dt * easedRamp;
        const move = Math.min(step, dist);
        this.current.addScaledVector(dir, move);
        this.manager.setNormalized(this.current.x, this.current.y);
    }
}

class ShaderPass {
    constructor(props) {
        this.props = props;
        this.uniforms = props.material?.uniforms;
        this.scene = new THREE.Scene();
        this.camera = new THREE.Camera();
        this.material = null;
        this.geometry = null;
        this.plane = null;
    }
    init() {
        if (this.uniforms) {
            this.material = new THREE.RawShaderMaterial(this.props.material);
            this.geometry = new THREE.PlaneGeometry(2, 2);
            this.plane = new THREE.Mesh(this.geometry, this.material);
            this.scene.add(this.plane);
        }
    }
    update() {
        const r = Common.renderer;
        r.setRenderTarget(this.props.output || null);
        r.render(this.scene, this.camera);
        r.setRenderTarget(null);
    }
}

class Advection extends ShaderPass {
    constructor(simProps) {
        super({
            material: {
                vertexShader: face_vert,
                fragmentShader: advection_frag,
                uniforms: {
                    boundarySpace: { value: simProps.cellScale },
                    px: { value: simProps.cellScale },
                    fboSize: { value: simProps.fboSize },
                    velocity: { value: simProps.src.texture },
                    dt: { value: simProps.dt },
                    isBFECC: { value: true }
                }
            },
            output: simProps.dst
        });
        this.init();
        this.line = this.createBoundary();
        this.scene.add(this.line);
    }
    createBoundary() {
        const boundaryG = new THREE.BufferGeometry();
        const vertices_boundary = new Float32Array([
            -1, -1, 0, -1, 1, 0, -1, 1, 0, 1, 1, 0, 1, 1, 0, 1, -1, 0, 1, -1, 0, -1, -1, 0
        ]);
        boundaryG.setAttribute("position", new THREE.BufferAttribute(vertices_boundary, 3));
        const boundaryM = new THREE.RawShaderMaterial({
            vertexShader: line_vert,
            fragmentShader: advection_frag,
            uniforms: this.uniforms
        });
        return new THREE.LineSegments(boundaryG, boundaryM);
    }
    updateAdvection({ dt, isBounce, BFECC }) {
        this.uniforms.dt.value = dt;
        this.line.visible = isBounce;
        this.uniforms.isBFECC.value = BFECC;
        super.update();
    }
}

class ExternalForce extends ShaderPass {
    constructor(simProps) {
        super({ output: simProps.dst });
        const mouseG = new THREE.PlaneGeometry(1, 1);
        const mouseM = new THREE.RawShaderMaterial({
            vertexShader: mouse_vert,
            fragmentShader: externalForce_frag,
            blending: THREE.AdditiveBlending,
            uniforms: {
                px: { value: simProps.cellScale },
                force: { value: new THREE.Vector2(0, 0) },
                center: { value: new THREE.Vector2(0, 0) },
                scale: { value: new THREE.Vector2(simProps.cursor_size, simProps.cursor_size) }
            }
        });
        this.mouse = new THREE.Mesh(mouseG, mouseM);
        this.scene.add(this.mouse);
    }
    updateForce(props) {
        const forceX = (Mouse.diff.x / 2) * props.mouse_force;
        const forceY = (Mouse.diff.y / 2) * props.mouse_force;
        const cursorSizeX = props.cursor_size * props.cellScale.x;
        const cursorSizeY = props.cursor_size * props.cellScale.y;
        const centerX = Math.min(Math.max(Mouse.coords.x, -1 + cursorSizeX + props.cellScale.x * 2), 1 - cursorSizeX - props.cellScale.x * 2);
        const centerY = Math.min(Math.max(Mouse.coords.y, -1 + cursorSizeY + props.cellScale.y * 2), 1 - cursorSizeY - props.cellScale.y * 2);
        const uniforms = this.mouse.material.uniforms;
        uniforms.force.value.set(forceX, forceY);
        uniforms.center.value.set(centerX, centerY);
        uniforms.scale.value.set(props.cursor_size, props.cursor_size);
        super.update();
    }
}

class Viscous extends ShaderPass {
    constructor(simProps) {
        super({
            material: {
                vertexShader: face_vert,
                fragmentShader: viscous_frag,
                uniforms: {
                    boundarySpace: { value: simProps.boundarySpace },
                    velocity: { value: simProps.src.texture },
                    velocity_new: { value: simProps.dst_.texture },
                    v: { value: simProps.viscous },
                    px: { value: simProps.cellScale },
                    dt: { value: simProps.dt }
                }
            },
            output: simProps.dst,
            output0: simProps.dst_,
            output1: simProps.dst
        });
        this.init();
    }
    updateViscous(props) {
        let fbo_in, fbo_out;
        this.uniforms.v.value = props.viscous;
        for (let i = 0; i < props.iterations; i++) {
            if (i % 2 === 0) {
                fbo_in = this.props.output0;
                fbo_out = this.props.output1;
            } else {
                fbo_in = this.props.output1;
                fbo_out = this.props.output0;
            }
            this.uniforms.velocity_new.value = fbo_in.texture;
            this.props.output = fbo_out;
            this.uniforms.dt.value = props.dt;
            super.update();
        }
        return fbo_out;
    }
}

class Divergence extends ShaderPass {
    constructor(simProps) {
        super({
            material: {
                vertexShader: face_vert,
                fragmentShader: divergence_frag,
                uniforms: {
                    boundarySpace: { value: simProps.boundarySpace },
                    velocity: { value: simProps.src.texture },
                    px: { value: simProps.cellScale },
                    dt: { value: simProps.dt }
                }
            },
            output: simProps.dst
        });
        this.init();
    }
    updateDivergence({ vel }) {
        this.uniforms.velocity.value = vel.texture;
        super.update();
    }
}

class Poisson extends ShaderPass {
    constructor(simProps) {
        super({
            material: {
                vertexShader: face_vert,
                fragmentShader: poisson_frag,
                uniforms: {
                    boundarySpace: { value: simProps.boundarySpace },
                    pressure: { value: simProps.dst_.texture },
                    divergence: { value: simProps.src.texture },
                    px: { value: simProps.cellScale }
                }
            },
            output: simProps.dst,
            output0: simProps.dst_,
            output1: simProps.dst
        });
        this.init();
    }
    updatePoisson(props) {
        let p_in, p_out;
        for (let i = 0; i < props.iterations; i++) {
            if (i % 2 === 0) {
                p_in = this.props.output0;
                p_out = this.props.output1;
            } else {
                p_in = this.props.output1;
                p_out = this.props.output0;
            }
            this.uniforms.pressure.value = p_in.texture;
            this.props.output = p_out;
            super.update();
        }
        return p_out;
    }
}

class Pressure extends ShaderPass {
    constructor(simProps) {
        super({
            material: {
                vertexShader: face_vert,
                fragmentShader: pressure_frag,
                uniforms: {
                    boundarySpace: { value: simProps.boundarySpace },
                    pressure: { value: simProps.src_p.texture },
                    velocity: { value: simProps.src_v.texture },
                    px: { value: simProps.cellScale },
                    dt: { value: simProps.dt }
                }
            },
            output: simProps.dst
        });
        this.init();
    }
    updatePressure({ vel, pressure }) {
        this.uniforms.velocity.value = vel.texture;
        this.uniforms.pressure.value = pressure.texture;
        super.update();
    }
}

class Simulation {
    constructor(options) {
        this.options = Object.assign(
            {
                iterations_poisson: 32,
                iterations_viscous: 32,
                mouse_force: 20,
                resolution: 0.5,
                cursor_size: 100,
                viscous: 30,
                isBounce: false,
                dt: 0.014,
                isViscous: false,
                BFECC: true
            },
            options
        );
        this.fbos = {
            vel_0: null,
            vel_1: null,
            vel_viscous0: null,
            vel_viscous1: null,
            div: null,
            pressure_0: null,
            pressure_1: null
        };
        this.fboSize = new THREE.Vector2();
        this.cellScale = new THREE.Vector2();
        this.boundarySpace = new THREE.Vector2();
        this.init();
    }
    init() {
        this.calcSize();
        this.createAllFBO();
        this.createShaderPass();
    }
    getFloatType() {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        return isIOS ? THREE.HalfFloatType : THREE.FloatType;
    }
    createAllFBO() {
        const type = this.getFloatType();
        const opts = {
            type,
            depthBuffer: false,
            stencilBuffer: false
        };
        for (const key in this.fbos) {
            this.fbos[key] = new THREE.WebGLRenderTarget(this.fboSize.x, this.fboSize.y, opts);
        }
    }
    createShaderPass() {
        this.advection = new Advection({
            cellScale: this.cellScale,
            fboSize: this.fboSize,
            dt: this.options.dt,
            src: this.fbos.vel_0,
            dst: this.fbos.vel_1
        });
        this.externalForce = new ExternalForce({
            cellScale: this.cellScale,
            cursor_size: this.options.cursor_size,
            dst: this.fbos.vel_1
        });
        this.viscous = new Viscous({
            cellScale: this.cellScale,
            boundarySpace: this.boundarySpace,
            viscous: this.options.viscous,
            src: this.fbos.vel_1,
            dst: this.fbos.vel_viscous1,
            dst_: this.fbos.vel_viscous0,
            dt: this.options.dt
        });
        this.divergence = new Divergence({
            cellScale: this.cellScale,
            boundarySpace: this.boundarySpace,
            src: this.fbos.vel_viscous0,
            dst: this.fbos.div,
            dt: this.options.dt
        });
        this.poisson = new Poisson({
            cellScale: this.cellScale,
            boundarySpace: this.boundarySpace,
            src: this.fbos.div,
            dst: this.fbos.pressure_1,
            dst_: this.fbos.pressure_0
        });
        this.pressure = new Pressure({
            cellScale: this.cellScale,
            boundarySpace: this.boundarySpace,
            src_p: this.fbos.pressure_0,
            src_v: this.fbos.vel_viscous0,
            dst: this.fbos.vel_0,
            dt: this.options.dt
        });
    }
    calcSize() {
        const width = Math.max(1, Math.round(Common.fboWidth));
        const height = Math.max(1, Math.round(Common.fboHeight));
        this.cellScale.set(1 / width, 1 / height);
        this.fboSize.set(width, height);
    }
    resize() {
        this.calcSize();
        for (const key in this.fbos) {
            this.fbos[key].setSize(this.fboSize.x, this.fboSize.y);
        }
    }
    update() {
        if (this.options.isBounce) {
            this.boundarySpace.set(0, 0);
        } else {
            this.boundarySpace.copy(this.cellScale);
        }
        this.advection.updateAdvection({
            dt: this.options.dt,
            isBounce: this.options.isBounce,
            BFECC: this.options.BFECC
        });
        this.externalForce.updateForce({
            cursor_size: this.options.cursor_size,
            mouse_force: this.options.mouse_force,
            cellScale: this.cellScale
        });
        let vel = this.fbos.vel_1;
        if (this.options.isViscous) {
            vel = this.viscous.updateViscous({
                viscous: this.options.viscous,
                iterations: this.options.iterations_viscous,
                dt: this.options.dt
            });
        }
        this.divergence.updateDivergence({ vel });
        const pressure = this.poisson.updatePoisson({ iterations: this.options.iterations_poisson });
        this.pressure.updatePressure({ vel, pressure });
    }
}

class Output {
    constructor(paletteTex) {
        this.simulation = new Simulation();
        this.scene = new THREE.Scene();
        this.camera = new THREE.Camera();
        this.output = new THREE.Mesh(
            new THREE.PlaneGeometry(2, 2),
            new THREE.RawShaderMaterial({
                vertexShader: face_vert,
                fragmentShader: color_frag,
                transparent: true,
                depthWrite: false,
                uniforms: {
                    velocity: { value: this.simulation.fbos.vel_0.texture },
                    boundarySpace: { value: new THREE.Vector2() },
                    palette: { value: paletteTex },
                    bgColor: { value: new THREE.Vector4(0, 0, 0, 0) }
                }
            })
        );
        this.scene.add(this.output);
    }
    resize() {
        this.simulation.resize();
    }
    render() {
        Common.renderer.setRenderTarget(null);
        Common.renderer.render(this.scene, this.camera);
    }
    update() {
        this.simulation.update();
        this.render();
    }
}

class WebGLManager {
    constructor(props) {
        this.props = props;
        this.paletteTex = makePaletteTexture(props.colors && props.colors.length ? props.colors : ["#ffffff"]);
    }
    init(container) {
        Common.init(container, this.props.maxDevicePixelRatio);
        container.appendChild(Common.renderer.domElement);
        Mouse.init(container);
        Mouse.autoIntensity = this.props.autoIntensity;
        Mouse.takeoverDuration = this.props.takeoverDuration;
        this.autoDriver = new AutoDriver(Mouse, this, {
            enabled: this.props.autoDemo,
            speed: this.props.autoSpeed,
            resumeDelay: this.props.autoResumeDelay,
            rampDuration: this.props.autoRampDuration
        });
        Mouse.lastUserInteraction = performance.now();
        Mouse.onInteract = () => {
            Mouse.lastUserInteraction = performance.now();
            if (this.autoDriver) this.autoDriver.forceStop();
        };
        this.output = new Output(this.paletteTex);
        this.output.output.material.uniforms.bgColor.value = this._bgVec4(this.props.backgroundColor);
        this._updateSimOptions();
        this._loop = this.loop.bind(this);
        this._resize = this.resize.bind(this);
        this._visibility = this.onVisibility.bind(this);
        window.addEventListener("resize", this._resize);
        document.addEventListener("visibilitychange", this._visibility);
        this._io = new IntersectionObserver(entries => {
            this.isVisible = entries.some(e => e.isIntersecting);
            if (this.isVisible && !this.rafId && !document.hidden && !this._disposed) this.start();
            else if (!this.isVisible) this.pause();
        }, { threshold: 0.01 });
        this._io.observe(container);
        this.container = container;
        this.isVisible = false;
        this.start();
    }
    _bgVec4(color) {
        if (!color || color === "transparent") return new THREE.Vector4(0, 0, 0, 0);
        const c = new THREE.Color(color);
        return new THREE.Vector4(c.r, c.g, c.b, 1);
    }
    _updateSimOptions() {
        const sim = this.output.simulation;
        sim.options.mouse_force = this.props.mouseForce;
        sim.options.cursor_size = this.props.cursorSize;
        sim.options.isViscous = (this.props.viscous ?? 0) > 0;
        sim.options.viscous = this.props.viscous;
        sim.options.iterations_viscous = this.props.iterationsViscous;
        sim.options.iterations_poisson = this.props.iterationsPoisson;
        sim.options.isBounce = !!this.props.isBounce;
        sim.options.BFECC = !!this.props.BFECC;
        sim.options.dt = 0.014;
    }
    resize() {
        Common.update(this.container);
        if (this.output) this.output.resize();
    }
    render() {
        if (this.autoDriver) this.autoDriver.update();
        Mouse.update();
        if (this.output) this.output.update();
    }
    loop() {
        if (this._disposed) return;
        if (document.hidden || !this.isVisible) {
            this.rafId = null;
            return;
        }
        this.render();
        this.rafId = requestAnimationFrame(this._loop);
    }
    start() {
        if (this._disposed) return;
        if (!this.rafId) this.rafId = requestAnimationFrame(this._loop);
    }
    pause() {
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = null;
    }
    onVisibility() {
        if (document.hidden) this.pause();
        else if (this.isVisible) this.start();
    }
    setBackgroundColor(color) {
        if (this.output) this.output.output.material.uniforms.bgColor.value = this._bgVec4(color);
    }
    setPalette(colors) {
        const next = makePaletteTexture(colors && colors.length ? colors : ["#ffffff"]);
        this.paletteTex.dispose();
        this.paletteTex = next;
        if (this.output) this.output.output.material.uniforms.palette.value = next;
    }
    dispose() {
        this._disposed = true;
        this.pause();
        if (this._io) this._io.disconnect();
        window.removeEventListener("resize", this._resize);
        document.removeEventListener("visibilitychange", this._visibility);
        if (Mouse.dispose) Mouse.dispose();
        if (Common.renderer) {
            try {
                Common.renderer.dispose();
                if (Common.renderer.forceContextLoss) Common.renderer.forceContextLoss();
            } catch { /* ignore */ }
            try {
                const canvas = Common.renderer.domElement;
                if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
            } catch { /* ignore */ }
            Common.renderer = null;
        }
        if (this.paletteTex) this.paletteTex.dispose();
    }
}

// Shared across all pass constructors (ShaderPass reads Common.renderer)
const Common = new CommonClass();
const Mouse = new MouseClass();

export interface LiquidEtherProps {
    colors?: string[];
    intensity?: number;
    mouseForce?: number;
    cursorSize?: number;
    persistence?: number;
    viscosity?: number;
    resolution?: number;
    bounceEdges?: boolean;
    clickBurst?: boolean;
    autoDemo?: boolean;
    autoSpeed?: number;
    autoIntensity?: number;
    autoResumeDelay?: number;
    intro?: boolean;
    lightMode?: boolean;
    backgroundColor?: string;
    maxDevicePixelRatio?: number;
    className?: string;
    style?: CSSProperties;
}

export default function LiquidEther({
    colors = ["#5227FF", "#FF9FFC", "#B19EEF"],
    intensity = 1,
    mouseForce = 20,
    cursorSize = 100,
    persistence = 0.75,
    viscosity = 0,
    resolution = 0.5,
    bounceEdges = false,
    clickBurst = false,
    autoDemo = true,
    autoSpeed = 0.5,
    autoIntensity = 2.2,
    autoResumeDelay = 3000,
    intro = true,
    lightMode = false,
    backgroundColor = "transparent",
    maxDevicePixelRatio,
    className,
    style
}: LiquidEtherProps = {}) {
    const mountRef = useRef<HTMLDivElement>(null);
    const managerRef = useRef<WebGLManager | null>(null);

    useEffect(() => {
        const el = mountRef.current;
        if (!el) return;
        Common.resolution = Math.max(0.1, Math.min(1, resolution));
        const manager = new WebGLManager({
            colors,
            mouseForce,
            cursorSize,
            viscous: viscosity,
            iterationsViscous: 32,
            iterationsPoisson: 32,
            isBounce: bounceEdges,
            BFECC: true,
            autoDemo,
            autoSpeed,
            autoIntensity,
            autoResumeDelay,
            autoRampDuration: 0.6,
            takeoverDuration: 0.25,
            backgroundColor,
            maxDevicePixelRatio
        });
        managerRef.current = manager;
        try {
            manager.init(el);
            const canvas = Common.renderer?.domElement;
            if (canvas) canvas.className = "liquid-ether__canvas";
        } catch (err) {
            console.error("LiquidEther init failed", err);
        }
        return () => {
            if (managerRef.current) {
                managerRef.current.dispose();
                managerRef.current = null;
            }
        };
    // Init once per mount; prop changes propagate through the imperative updates below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // propagate dynamic prop changes without recreating the GL context
    useEffect(() => {
        const m = managerRef.current;
        if (!m) return;
        m.props.mouseForce = mouseForce;
        m.props.cursorSize = cursorSize;
        m.props.viscous = viscosity;
        m.props.isBounce = bounceEdges;
        m.props.autoDemo = autoDemo;
        m.props.autoSpeed = autoSpeed;
        m.props.autoIntensity = autoIntensity;
        m.props.autoResumeDelay = autoResumeDelay;
        if (m.autoDriver) {
            m.autoDriver.enabled = autoDemo;
            m.autoDriver.speed = autoSpeed;
            m.autoDriver.resumeDelay = autoResumeDelay;
        }
        if (Mouse) Mouse.autoIntensity = autoIntensity;
        m._updateSimOptions();
    }, [mouseForce, cursorSize, viscosity, bounceEdges, autoDemo, autoSpeed, autoIntensity, autoResumeDelay]);

    useEffect(() => {
        const m = managerRef.current;
        if (!m) return;
        m.props.backgroundColor = backgroundColor;
        m.setBackgroundColor(backgroundColor);
    }, [backgroundColor]);

    useEffect(() => {
        const m = managerRef.current;
        if (!m) return;
        m.props.colors = colors;
        m.setPalette(colors);
    // Avoid identity thrash: only react when the serialized palette changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(colors)]);

    return (
        <div
            ref={mountRef}
            className={["liquid-ether", className].filter(Boolean).join(" ")}
            style={style}
        />
    );
}
