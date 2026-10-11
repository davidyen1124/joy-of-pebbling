// The studio: a black room, an easel, and Cobb. It fills the whole window, whatever its shape, and is
// rendered small and soft, then pushed through a worn-tape shader (vhs.js).
//
// A camera here is not a position but a thing to keep in frame: each shot names a centre, a direction
// to look from and a box that must fit, and the distance follows from the shape of the window. On an
// upright phone there is no room for Cobb and his canvas side by side, so the picture splits in two:
// the canvas on top, Cobb underneath.
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { VHS_VERT, VHS_FRAG } from './vhs.js'
import { clamp, lerp, smooth } from './rng.js'

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)
const UP = V(0, 1, 0)

// where things stand (one unit is one Pebble tall)
const EASEL_POS = V(0.55, 0.98, -0.15)
const EASEL_YAW = -0.3
const HOST_POS = V(-0.52, 0, 0.02)
const FACE_CAMERA = 0.14
const FACE_CANVAS = 0.66
const BLUE = 0x5b93d6
const BUCKET_POS = V(0.16, 0, 0.07) // on the floor between him and the easel
const SPLIT_BELOW = 0.8 // windows narrower than this (width / height) get the two-part picture

// c: what to look at. from: which way the camera sits from it. box: what must fit, [wide, high].
// `on: 'canvas'` gives c and from in the canvas's own axes.
const SHOTS = {
  wide: { c: [-0.12, 0.86, 0], from: [0, 0.035, 1], box: [3.05, 2.08], fov: 24, push: 0.003 },
  host: { c: [-0.44, 0.88, 0], from: [0, 0.035, 1], box: [2.2, 2.08], fov: 24, push: 0.003 },
  // the canvas sits high in the frame, which leaves the bottom of the screen for the captions
  canvas: { on: 'canvas', c: [0.02, -0.062, 0], from: [0.05, 0, 1], box: [1.0, 0.84], fov: 30, push: 0.003, close: true },
  // from the easel's side: his face while he works, the canvas at an angle
  side: { c: [-0.22, 0.88, -0.05], from: [0.42, 0.04, 0.9], box: [2.9, 1.9], fov: 25, push: 0.003 },
  palette: { palette: true, box: [0.66, 0.5], fov: 19, push: 0.004 },
  // the two halves of the upright picture
  top: { on: 'canvas', c: [0, 0, 0], from: [0.04, 0, 1], box: [0.95, 0.712], fov: 30, push: 0, close: true },
  under: { c: [-0.36, 0.82, 0], from: [0.14, 0.03, 1], box: [1.5, 1.86], fov: 24, push: 0.003 },
}

export class Stage {
  constructor(canvas, painter) {
    this.el = canvas
    this.painter = painter
    this.time = 0
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' })
    this.renderer.setClearColor(0x000000, 1)
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x030304)
    this.camera = new THREE.PerspectiveCamera(26, 4 / 3, 0.1, 40)
    this.shot = 'wide'
    this.shotT = 0
    this.shake = 0
    this.aspect = 4 / 3
    this.split = false
    this.topShare = 0

    this.post = new THREE.ShaderMaterial({
      vertexShader: VHS_VERT,
      fragmentShader: VHS_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tDiffuse: { value: null },
        res: { value: new THREE.Vector2(800, 600) },
        time: { value: 0 },
        ff: { value: 0 },
        glitch: { value: 0 },
        lines: { value: 240 },
        fade: { value: 1 },
        seam: { value: -1 },
      },
    })
    this.postScene = new THREE.Scene()
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const tri = new THREE.BufferGeometry()
    tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3))
    tri.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2))
    this.postScene.add(new THREE.Mesh(tri, this.post))

    this.lights()
    this.floor()

    // what Cobb is doing; the show sets these
    this.mode = 'talk' // talk | paint | load | wash | beat | wave
    this.tool = 'big'
    this.loadBlob = 'white'
    this.talking = 0
    this.tint = new THREE.Color(0xffffff)
    this.tipPos = V(0, 0.9, 0.5)
    this.axis = V(0, -1, 0)
    this.flat = V(1, 0, 0)
    this.yaw = FACE_CAMERA
    this.lean = 0
    this.hop = 0
    this.blinkAt = 2
    this.beatPhase = 0
    this.onHit = null // called each time the brush strikes the easel
    this.ready = false
  }

  lights() {
    const s = this.scene
    s.add(new THREE.HemisphereLight(0xbfd0ff, 0x1a1410, 0.5))
    const key = new THREE.DirectionalLight(0xfff0dc, 2.5)
    key.position.set(-1.6, 2.6, 3.2)
    s.add(key)
    const fill = new THREE.DirectionalLight(0xbcd0ff, 0.75)
    fill.position.set(2.6, 1.0, 2.6)
    s.add(fill)
    // the hair light: every 1980s studio had one, and it is what makes the afro glow
    const rim = new THREE.DirectionalLight(0xffd9a0, 2.6)
    rim.position.set(-0.8, 2.6, -2.6)
    s.add(rim)
  }

  floor() {
    const cv = document.createElement('canvas')
    cv.width = cv.height = 256
    const c = cv.getContext('2d')
    const g = c.createRadialGradient(128, 128, 0, 128, 128, 128)
    g.addColorStop(0, '#3a3530')
    g.addColorStop(0.45, '#1c1917')
    g.addColorStop(1, '#030304')
    c.fillStyle = g
    c.fillRect(0, 0, 256, 256)
    const tex = new THREE.CanvasTexture(cv)
    tex.colorSpace = THREE.SRGBColorSpace
    const floor = new THREE.Mesh(new THREE.CircleGeometry(5.2, 48), new THREE.MeshBasicMaterial({ map: tex }))
    floor.rotation.x = -Math.PI / 2
    floor.position.set(0.1, 0, 0.3)
    this.scene.add(floor)
    // soft contact shadow
    const sc = document.createElement('canvas')
    sc.width = sc.height = 128
    const s = sc.getContext('2d')
    const sg = s.createRadialGradient(64, 64, 0, 64, 64, 64)
    sg.addColorStop(0, 'rgba(0,0,0,0.85)')
    sg.addColorStop(0.6, 'rgba(0,0,0,0.45)')
    sg.addColorStop(1, 'rgba(0,0,0,0)')
    s.fillStyle = sg
    s.fillRect(0, 0, 128, 128)
    const stex = new THREE.CanvasTexture(sc)
    this.shadowTex = stex
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.8), new THREE.MeshBasicMaterial({ map: stex, transparent: true, depthWrite: false }))
    this.blob.rotation.x = -Math.PI / 2
    this.blob.position.set(HOST_POS.x + 0.05, 0.004, HOST_POS.z + 0.02)
    this.scene.add(this.blob)
  }

  async load(url, layout) {
    const gltf = await new GLTFLoader().loadAsync(url)
    this.layout = layout
    const root = gltf.scene
    // name everything first: the parts are about to be moved out from under the root
    const named = {}
    const get = (n) => named[n]
    root.traverse((o) => {
      named[o.name] = o
      if (o.isMesh) o.frustumCulled = false
    })

    // the easel
    this.easel = new THREE.Group()
    this.easel.position.copy(EASEL_POS)
    this.easel.rotation.y = EASEL_YAW
    const e = get('easel')
    e.position.set(0, 0, 0)
    this.easel.add(e)
    const tex = new THREE.CanvasTexture(this.painter.canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.generateMipmaps = false
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    this.paintTex = tex
    this.paintVersion = -1
    const { w, h } = layout.canvas
    this.CW = w
    this.CH = h
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }))
    face.position.z = 0.0012
    this.face = face
    this.easel.add(face)
    this.scene.add(this.easel)
    this.easel.updateMatrixWorld(true)
    this.cx = V(1, 0, 0).applyQuaternion(this.easel.quaternion)
    this.cn = V(0, 0, 1).applyQuaternion(this.easel.quaternion)

    // the host
    this.host = new THREE.Group()
    this.host.position.copy(HOST_POS)
    this.body = new THREE.Group()
    const cobb = get('cobb')
    cobb.position.set(0, 0, 0)
    this.body.add(cobb)
    this.host.add(this.body)
    this.scene.add(this.host)
    this.afro = get('cobb_afro')
    this.eyes = [get('cobb_eye_l'), get('cobb_eye_r')]
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0a1320 })
    for (const e2 of this.eyes) e2.material = eyeMat
    this.brows = [get('cobb_brow_l'), get('cobb_brow_r')]
    this.browY = this.brows.map((b) => b.position.y)
    this.afroBase = this.afro.scale.clone()
    this.shoulderL = V(...layout.cobb.shoulderL) // his left: the brush arm, the one nearer the easel
    this.shoulderR = V(...layout.cobb.shoulderR)

    // the palette rides on his right arm, out to the side where the camera can see it
    this.palette = get('palette')
    const px = V(-0.82, 0.06, 0.57).normalize()
    const pz = px.clone().cross(V(0.12, 0.74, 0.66)).normalize()
    const py = pz.clone().cross(px).normalize()
    this.palette.position.set(-0.34, 0.43, 0.3)
    this.palette.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(px, py, pz))
    this.body.add(this.palette)

    // tools: a little larger than life, so they read on a small screen
    this.tools = { big: get('brush_big'), round: get('brush_round'), knife: get('knife') }
    const TOOL_SCALE = 1.25
    this.grip = { big: 0.25 * TOOL_SCALE, round: 0.24 * TOOL_SCALE, knife: 0.21 * TOOL_SCALE }
    this.tips = {}
    for (const [k, t] of Object.entries(this.tools)) {
      t.position.set(0, 0, 0)
      t.scale.setScalar(TOOL_SCALE)
      this.scene.add(t)
      t.traverse((o) => {
        if (o.isMesh && o.material.name.startsWith('tip')) {
          o.material = o.material.clone()
          this.tips[k] = o.material
        }
      })
    }

    // the bucket of thinner he washes the brush in (an older studio file has none; the show goes on without)
    this.bucket = get('bucket') || null
    if (this.bucket) {
      this.bucket.position.copy(BUCKET_POS)
      this.bucket.rotation.y = 0.3
      this.scene.add(this.bucket)
      const under = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.38), new THREE.MeshBasicMaterial({ map: this.shadowTex, transparent: true, depthWrite: false }))
      under.rotation.x = -Math.PI / 2
      under.position.set(BUCKET_POS.x + 0.03, 0.003, BUCKET_POS.z + 0.01)
      this.scene.add(under)
    }

    // arms: rubbery tubes from shoulder to hand, rebuilt every frame
    const mat = new THREE.MeshStandardMaterial({ color: BLUE, roughness: 0.62 })
    this.armL = this.makeArm(mat)
    this.armR = this.makeArm(mat)
    this.handL = new THREE.Mesh(new THREE.SphereGeometry(0.07, 18, 12), mat)
    this.handR = new THREE.Mesh(new THREE.SphereGeometry(0.07, 18, 12), mat)
    this.scene.add(this.armL.mesh, this.armR.mesh, this.handL, this.handR)

    this.ready = true
    this.shot = 'wide'
    this.resize()
    this.update(0.016)
  }

  makeArm(mat) {
    const SEG = 16
    const RAD = 10
    const pos = new Float32Array((SEG + 1) * RAD * 3)
    const nor = new Float32Array((SEG + 1) * RAD * 3)
    const idx = []
    for (let i = 0; i < SEG; i++) {
      for (let j = 0; j < RAD; j++) {
        const a = i * RAD + j
        const b = i * RAD + ((j + 1) % RAD)
        idx.push(a, b, a + RAD, b, b + RAD, a + RAD)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
    g.setIndex(idx)
    const mesh = new THREE.Mesh(g, mat)
    mesh.frustumCulled = false
    return { mesh, g, pos, nor, SEG, RAD }
  }

  bendArm(arm, a, b, sag, bow, thin = 1) {
    const { pos, nor, SEG, RAD } = arm
    const mid = a.clone().add(b).multiplyScalar(0.5)
    const len = a.distanceTo(b)
    const c = mid.clone().add(V(0, -sag * len, 0)).add(bow)
    const p = V()
    const t3 = V()
    const n = V()
    const bi = V()
    let ref = V(0, 0, 1)
    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG
      const u = 1 - t
      p.set(0, 0, 0).addScaledVector(a, u * u).addScaledVector(c, 2 * u * t).addScaledVector(b, t * t)
      t3.set(0, 0, 0).addScaledVector(c.clone().sub(a), 2 * u).addScaledVector(b.clone().sub(c), 2 * t).normalize()
      n.copy(ref).addScaledVector(t3, -ref.dot(t3))
      if (n.lengthSq() < 1e-6) n.set(1, 0, 0).addScaledVector(t3, -t3.x)
      n.normalize()
      bi.crossVectors(t3, n)
      ref = n.clone()
      const rad = lerp(0.082, 0.062, t) * thin
      for (let j = 0; j < RAD; j++) {
        const ang = (j / RAD) * Math.PI * 2
        const cs = Math.cos(ang)
        const sn = Math.sin(ang)
        const k = (i * RAD + j) * 3
        const nx = n.x * cs + bi.x * sn
        const ny = n.y * cs + bi.y * sn
        const nz = n.z * cs + bi.z * sn
        pos[k] = p.x + nx * rad
        pos[k + 1] = p.y + ny * rad
        pos[k + 2] = p.z + nz * rad
        nor[k] = nx
        nor[k + 1] = ny
        nor[k + 2] = nz
      }
    }
    arm.g.attributes.position.needsUpdate = true
    arm.g.attributes.normal.needsUpdate = true
  }

  /** a point on the painted face: u, v in 0..1 from the top left; out = distance off the canvas */
  canvasPoint(u, v, out = 0) {
    return EASEL_POS.clone()
      .addScaledVector(this.cx, (u - 0.5) * this.CW)
      .addScaledVector(UP, (0.5 - v) * this.CH)
      .addScaledVector(this.cn, out)
  }

  blobPoint(id, lift = 0) {
    const b = this.layout.blobs[id] || this.layout.mix
    return this.palette.localToWorld(V(b[0], b[1] + lift, b[2]))
  }

  cut(name) {
    if (!SHOTS[name]) name = 'wide'
    if (name === this.shot) return
    this.shot = name
    this.shotT = 0
  }

  /** put the camera where this shot wants it, for a picture of this shape */
  frame(name, aspect) {
    const s = SHOTS[name]
    const cam = this.camera
    let c
    let from
    if (s.palette) {
      const mid = this.palette.localToWorld(V(0.2, 0, 0))
      const up = this.palette.localToWorld(V(0.2, 1, 0)).sub(mid).normalize()
      c = this.blobPoint(this.loadBlob).lerp(mid, 0.5)
      from = up.multiplyScalar(0.78).add(V(0, 0.1, 0.16)).normalize()
    } else if (s.on === 'canvas') {
      c = EASEL_POS.clone().addScaledVector(this.cx, s.c[0]).addScaledVector(UP, s.c[1]).addScaledVector(this.cn, s.c[2])
      from = this.cx.clone().multiplyScalar(s.from[0]).addScaledVector(UP, s.from[1]).addScaledVector(this.cn, s.from[2]).normalize()
    } else {
      c = V(...s.c)
      from = V(...s.from).normalize()
    }
    const t = Math.tan((s.fov * Math.PI) / 360)
    let dist = Math.max(s.box[1] / 2 / t, s.box[0] / 2 / (t * aspect))
    // the slow creep of a studio camera on a pedestal
    dist *= 1 - Math.min(this.shotT, 14) * s.push
    const pos = c.clone().addScaledVector(from, dist)
    if (this.shake > 0.001) {
      pos.x += Math.sin(this.time * 71) * 0.012 * this.shake
      pos.y += Math.cos(this.time * 83) * 0.012 * this.shake
    }
    cam.fov = s.fov
    cam.aspect = aspect
    cam.position.copy(pos)
    cam.lookAt(c)
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld()
  }

  update(dt) {
    if (!this.ready) return
    this.time += dt
    this.shotT += dt
    const t = this.time
    const tip = this.painter.tip
    const painting = this.mode === 'paint'

    // which way he faces, and how far he leans to reach
    const wantYaw = painting || this.mode === 'load' ? FACE_CANVAS : this.mode === 'beat' || this.mode === 'wash' ? 0.5 : FACE_CAMERA
    this.yaw = lerp(this.yaw, wantYaw, 1 - Math.exp(-5 * dt))
    const reach = painting ? smooth(0.1, 1, tip.u) : 0
    this.lean = lerp(this.lean, reach, 1 - Math.exp(-4 * dt))
    this.talking = Math.max(0, this.talking - dt)
    const speak = this.talking > 0 ? 1 : 0
    const bounce = speak * Math.abs(Math.sin(t * 9.5)) * 0.014 + Math.sin(t * 2.1) * 0.005
    this.hop = Math.max(0, this.hop - dt * 2.6)
    const hopY = Math.sin(clamp(this.hop, 0, 1) * Math.PI) * 0.09
    this.host.position.set(HOST_POS.x, hopY, HOST_POS.z)
    this.host.rotation.y = this.yaw + Math.sin(t * 0.7) * 0.02
    this.body.rotation.z = -this.lean * 0.1 + Math.sin(t * 1.3) * 0.008
    this.body.rotation.x = speak * Math.sin(t * 4.2) * 0.02
    this.body.position.y = bounce
    const sq = 1 + bounce * 1.5 - hopY * 0.3
    this.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq))
    // the afro arrives a moment after he does
    const wob = Math.sin(t * 9.5 + 0.6) * 0.012 * speak + Math.sin(t * 2.1 + 0.8) * 0.006 + hopY * 0.25
    this.afro.scale.set(this.afroBase.x * (1 - wob * 0.4), this.afroBase.y * (1 + wob), this.afroBase.z * (1 - wob * 0.4))
    this.blob.position.x = this.host.position.x + 0.05
    this.blob.scale.setScalar(1 - hopY * 2)

    // blinking
    this.blinkAt -= dt
    if (this.blinkAt < -0.13) this.blinkAt = 1.6 + Math.random() * 3.6
    const lid = this.blinkAt < 0 ? 0.12 : 1
    for (const e of this.eyes) e.scale.y = lerp(e.scale.y, lid, 0.5)
    this.brows.forEach((b, i) => (b.position.y = this.browY[i] + speak * 0.012 * (0.5 + 0.5 * Math.sin(t * 3.1))))
    this.host.updateMatrixWorld(true)

    // where the working end of the tool should be
    const sL = (this.sL = this.host.localToWorld(this.shoulderL.clone()))
    this.sR = this.host.localToWorld(this.shoulderR.clone())
    const tool = this.tools[this.tool] ? this.tool : 'big'
    let P
    let A
    let F = this.flat
    let snap = false
    if (painting && this.painter.busy) {
      const out = tip.down ? 0.004 : 0.03 + (tip.lift || 0) * 0.07
      P = this.canvasPoint(tip.u, tip.v, out)
      const back = sL.clone().sub(P)
      back.addScaledVector(this.cn, -back.dot(this.cn)).normalize()
      A = this.cn.clone().multiplyScalar(0.62).addScaledVector(back, 0.62).add(V(0, -0.3, 0)).normalize()
      // a flat brush travels broadside on
      const dir = this.cx.clone().multiplyScalar(Math.cos(tip.ang)).addScaledVector(UP, -Math.sin(tip.ang))
      F = this.cn.clone().cross(dir).normalize()
      snap = tip.down
    } else if (this.mode === 'load') {
      const dip = 0.5 + 0.5 * Math.sin(t * 13)
      P = this.blobPoint(this.loadBlob, 0.012 + dip * 0.03)
      // the handle leans back towards the shoulder it hangs from, which keeps his hand off to one side
      A = sL.clone().sub(P).normalize().multiplyScalar(0.85).add(V(0, 0.5, 0.08)).normalize()
      F = V(1, 0, 0)
    } else if (this.mode === 'wash') {
      // down into the bucket, scrubbing it round under the thinner
      const b = BUCKET_POS
      const level = this.layout.bucket?.liquid ?? 0.15
      P = V(b.x + Math.sin(t * 15) * 0.04, level - 0.035 + Math.sin(t * 30) * 0.012, b.z + Math.cos(t * 15) * 0.03)
      A = V(-0.42, 0.86, 0.22).normalize()
      F = V(0, 0, 1)
    } else if (this.mode === 'beat') {
      // knocking it dry on the leg of the easel: eleven strikes a second, as on the programme
      const leg = EASEL_POS.clone().addScaledVector(this.cx, -0.33).add(V(0, -0.52, 0.1))
      const before = Math.floor(this.beatPhase)
      this.beatPhase += dt * 11.3
      if (Math.floor(this.beatPhase) !== before && this.onHit) this.onHit()
      const w = Math.cos(this.beatPhase * Math.PI * 2)
      P = leg.clone().add(V(-0.075 + w * 0.075, 0.02 * Math.sin(this.beatPhase * Math.PI * 2), 0.02))
      A = V(-0.75, 0.55, 0.35).normalize()
      F = V(0, 0, 1)
    } else {
      // at rest: brush held up beside him, moving a little as he talks
      const g = speak * Math.sin(t * 3.3) * 0.05
      const up = this.mode === 'wave' ? 0.34 + Math.sin(t * 7) * 0.05 : 0
      const hand = this.host.localToWorld(V(0.5 + (this.mode === 'wave' ? Math.sin(t * 7) * 0.08 : 0), 0.52 + g + up, 0.32))
      A = V(0.22, -0.92, -0.25).normalize()
      P = hand.clone().addScaledVector(A, -this.grip[tool])
      F = V(1, 0, 0.3).normalize()
    }
    if (this.mode !== 'beat') this.beatPhase = 0
    const k = snap || this.mode === 'beat' ? 1 : 1 - Math.exp(-(painting ? 26 : 9) * dt)
    this.tipPos.lerp(P, k)
    this.axis.lerp(A, 1 - Math.exp(-10 * dt)).normalize()
    this.flat.lerp(F, 1 - Math.exp(-14 * dt)).normalize()

    for (const [name, obj] of Object.entries(this.tools)) obj.visible = name === tool
    const obj = this.tools[tool]
    const Y = this.axis
    const X = this.flat.clone().addScaledVector(Y, -this.flat.dot(Y))
    if (X.lengthSq() < 1e-5) X.set(1, 0, 0)
    X.normalize()
    const Z = X.clone().cross(Y).normalize()
    obj.position.copy(this.tipPos)
    obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z))
    const tm = this.tips[tool]
    if (tm) tm.color.lerp(tool === 'knife' ? this.tint.clone().lerp(new THREE.Color(0xc9ccd1), 0.45) : this.tint, 0.2)

    this.hl = this.tipPos.clone().addScaledVector(Y, this.grip[tool])
    this.handL.position.copy(this.hl)
    // his other hand grips the palette by the end nearest his body, mostly from underneath: clear of the paint
    const hr = this.palette.localToWorld(V(-0.055, -0.04, 0.0))
    this.handR.position.copy(hr)
    this.bendArm(this.armR, this.sR, hr, 0.3, V(-0.04, 0, 0.04))

    this.shake = Math.max(0, this.shake - dt * 2.2)
    if (this.paintVersion !== this.painter.version) {
      this.paintVersion = this.painter.version
      this.paintTex.needsUpdate = true
    }
  }

  /** the brush arm depends on who is looking: close on the canvas it comes in from under the frame */
  poseArm(shot) {
    const s = SHOTS[shot]
    const tip = this.painter.tip
    if (s.close && this.mode === 'paint') {
      // slimmer, and kept near the canvas, so it hides as little of the painting as a hand would
      const from = this.canvasPoint(tip.u - 0.3, 1.55, 0.26)
      this.bendArm(this.armL, from, this.hl, 0.04, this.cn.clone().multiplyScalar(0.04), 0.74)
      this.handL.scale.setScalar(0.82)
      return
    }
    this.handL.scale.setScalar(1)
    // otherwise it is his own arm, from his own shoulder; reaching for paint it arches over the palette
    if (this.mode === 'load') this.bendArm(this.armL, this.sL, this.hl, -0.05, V(0, 0.02, 0.05))
    else this.bendArm(this.armL, this.sL, this.hl, 0.2, V(0, 0, 0.06))
  }

  resize() {
    const r = this.el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = Math.max(2, Math.round(r.width * dpr))
    const h = Math.max(2, Math.round(r.height * dpr))
    if (this.el.width !== w || this.el.height !== h) this.renderer.setSize(w, h, false)
    this.aspect = r.width / r.height
    this.split = this.aspect < SPLIT_BELOW
    // upright: the canvas takes a 4:3 slice off the top, Cobb gets the rest
    this.topShare = this.split ? clamp((r.width / (4 / 3) + r.width * 0.02) / r.height, 0.2, 0.55) : 0
    // the studio is drawn at tape resolution, about 600 lines on the short side
    const base = Math.min(r.width, r.height) < 560 ? 500 : 620
    const rw = Math.round(this.aspect >= 1 ? Math.min(base * this.aspect, 1900) : base)
    const rh = Math.round(this.aspect >= 1 ? base : Math.min(base / this.aspect, 1500))
    if (!this.rt || this.rt.width !== rw || this.rt.height !== rh) {
      this.rt?.dispose()
      this.rt = new THREE.WebGLRenderTarget(rw, rh, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, samples: 4, depthBuffer: true })
      this.post.uniforms.tDiffuse.value = this.rt.texture
      this.post.uniforms.res.value.set(rw, rh)
    }
    this.post.uniforms.lines.value = clamp(Math.round(r.height / 2.6), 120, 400)
    this.post.uniforms.seam.value = this.split ? 1 - this.topShare : -1
    document.documentElement.style.setProperty('--top', `${(this.topShare * 100).toFixed(2)}%`)
    document.documentElement.classList.toggle('split', this.split)
  }

  render(fx) {
    const u = this.post.uniforms
    u.time.value = this.time
    u.ff.value = fx.ff
    u.glitch.value = fx.glitch
    u.fade.value = fx.fade
    const r = this.renderer
    if (this.ready && this.rt) {
      const { width: W, height: H } = this.rt
      // one part of the picture: the renderer reads the target's viewport when the target is set
      const part = (shot, x, y, w, h) => {
        this.rt.viewport.set(x, y, w, h)
        this.rt.scissor.set(x, y, w, h)
        r.setRenderTarget(this.rt)
        this.frame(shot, w / h)
        this.poseArm(shot)
        r.render(this.scene, this.camera)
      }
      this.rt.scissorTest = this.split
      if (this.split) {
        const top = Math.round(H * this.topShare)
        part('top', 0, H - top, W, top) // the canvas
        part(SHOTS[this.shot].palette ? 'palette' : 'under', 0, 0, W, H - top) // Cobb
      } else part(this.shot, 0, 0, W, H)
      r.setRenderTarget(null)
    }
    r.render(this.postScene, this.postCam)
  }
}
