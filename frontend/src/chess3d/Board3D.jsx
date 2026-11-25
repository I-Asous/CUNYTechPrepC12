import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { useTheme } from "../theme.js";
import { PIECES } from "./variants.js";

// Vertical distance between levels, per variant (a square is 1 unit wide).
const LEVEL_GAP = { raumschach: 1.8, skyscraper: 2.4 };
const TILE_HEIGHT = 0.05;
const CLICK_SLOP_PX = 6;  // a drag shorter than this still counts as a click

// How far back the camera must be for a sphere of this radius to fit in view,
// using whichever of the view's height or width is tighter.
function fitDistance(radius, camera) {
  const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  return radius / Math.sin(Math.atan(halfHeight * Math.min(1, camera.aspect)));
}

// Colors come from the page's CSS tokens, so the 3D view matches the theme;
// the scene is rebuilt when the theme changes.
function cssValue(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

const cssColor = (name, fallback) => new THREE.Color(cssValue(name, fallback));

// Hairlines along every file and rank of one level, drawn on its top face.
function levelGrid(files, ranks, y, material) {
  const points = [];
  for (let i = 0; i <= files; i++) {
    const x = i - files / 2;
    points.push(x, y, -ranks / 2, x, y, ranks / 2);
  }
  for (let j = 0; j <= ranks; j++) {
    const z = j - ranks / 2;
    points.push(-files / 2, y, z, files / 2, y, z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  return new THREE.LineSegments(geometry, material);
}

// Piece symbols are drawn onto small canvases and shown as sprites, so they
// always face the camera and match the 2D board's look.
const glyphTextures = new Map();

function glyphTexture(type, color, theme) {
  const key = `${theme}:${type}:${color}`;
  if (glyphTextures.has(key)) return glyphTextures.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '100px "Apple Symbols", "Segoe UI Symbol", "Noto Sans Symbols 2", "Apple Color Emoji", sans-serif';
  ctx.lineJoin = "round";
  ctx.lineWidth = 8;
  const ink = cssValue("--ink", "#d63a22");
  const light = cssValue("--piece-light", "#ffffff");
  ctx.strokeStyle = color === 1 ? ink : light;
  ctx.fillStyle = color === 1 ? light : cssValue("--piece-dark", ink);
  const glyph = PIECES[type].glyph;
  if (glyph.length === 1) ctx.strokeText(glyph, 64, 70);  // chess glyphs get an outline; emoji don't need one
  ctx.fillText(glyph, 64, 70);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  glyphTextures.set(key, texture);
  return texture;
}

function labelSprite(text, color) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.font = '400 44px "Inter Tight", "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(text, 32, 34);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(0.6, 0.6, 0.6);
  return sprite;
}

function disposeGroup(group) {
  group.traverse((object) => {
    object.geometry?.dispose();
    if (object.material && !object.material.userData.shared) object.material.dispose();
  });
  group.clear();
}

// A rotatable 3D view of a Game3D. Clicking a piece or a highlighted target
// calls onSquareClick(square); clicking empty space calls onSquareClick(null).
export default function Board3D({ game, version, selected, targets, lastMove, playerColor, viewKey, onSquareClick }) {
  const mountRef = useRef(null);
  const three = useRef(null);
  const latest = useRef({});
  latest.current = { onSquareClick };
  const theme = useTheme();

  // One-time setup: renderer, camera, controls, lights, input and render loop.
  useEffect(() => {
    const mount = mountRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 5;
    controls.maxDistance = 45;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xd9c7ff, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(6, 14, 8);
    scene.add(sun);

    const boardGroup = new THREE.Group();
    const pieceGroup = new THREE.Group();
    const markerGroup = new THREE.Group();
    scene.add(boardGroup, pieceGroup, markerGroup);

    const state = { renderer, scene, camera, controls, boardGroup, pieceGroup, markerGroup, tiles: [], bobbing: null };
    three.current = state;

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = mount;
      if (!w || !h) return;
      renderer.setSize(w, h);
      const before = fitDistance(1, camera);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      // Move the camera in or out with the view's shape, so a narrower view
      // doesn't crop the board.
      camera.position.sub(controls.target).multiplyScalar(fitDistance(1, camera) / before).add(controls.target);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    // Clicks: raycast against pieces and move markers only, so the glass
    // levels never block a click on something below them.
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let down = null;
    const hitSquare = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects([...pieceGroup.children, ...markerGroup.children], true)[0];
      let object = hit?.object;
      while (object && object.userData.square === undefined) object = object.parent;
      return object ? object.userData.square : null;
    };
    const onDown = (event) => { down = { x: event.clientX, y: event.clientY }; };
    const onUp = (event) => {
      if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > CLICK_SLOP_PX) return;
      latest.current.onSquareClick(hitSquare(event));
    };
    const onMove = (event) => {
      if (event.buttons) return;
      renderer.domElement.style.cursor = hitSquare(event) === null ? "grab" : "pointer";
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointermove", onMove);

    let frame;
    const clock = new THREE.Clock();
    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();
      if (state.bobbing) {
        state.bobbing.object.position.y = state.bobbing.baseY + 0.12 + Math.sin(clock.getElapsedTime() * 4) * 0.06;
      }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      disposeGroup(boardGroup);
      disposeGroup(pieceGroup);
      disposeGroup(markerGroup);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  const variantId = game.variant.id;
  const gap = LEVEL_GAP[variantId];
  const position = (square) => {
    const [x, y, z] = game.coords(square);
    const height = (game.levels - 1) * gap;
    return new THREE.Vector3(x - (game.files - 1) / 2, z * gap - height / 2, (game.ranks - 1) / 2 - y);
  };

  // The levels, drawn like a wireframe: flat see-through tiles with hairlines
  // between them, over a floor grid. Rebuilt when the variant changes.
  useEffect(() => {
    const { boardGroup } = three.current;
    disposeGroup(boardGroup);
    const tileMaterial = (color) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false });
    const light = tileMaterial(cssColor("--paper", "#ffffff"));
    const dark = tileMaterial(cssColor("--hatch", "#f5ad9f"));
    const tileGeometry = new THREE.BoxGeometry(0.97, TILE_HEIGHT, 0.97);
    const tiles = [];

    for (let square = 0; square < game.size; square++) {
      const [x, y, z] = game.coords(square);
      const base = (x + y + z) % 2 === 0 ? dark : light;
      const tile = new THREE.Mesh(tileGeometry, base);
      tile.position.copy(position(square));
      tile.userData.base = base;
      boardGroup.add(tile);
      tiles.push(tile);
    }

    const ink = cssValue("--ink", "#d63a22");
    const hairline = new THREE.LineBasicMaterial({ color: cssColor("--line", "#ef7a66") });
    for (let z = 0; z < game.levels; z++) {
      const corner = position(game.index(0, 0, z));
      const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(game.files, TILE_HEIGHT, game.ranks)),
        new THREE.LineBasicMaterial({ color: ink }),
      );
      outline.position.set(0, corner.y, 0);
      boardGroup.add(outline, levelGrid(game.files, game.ranks, corner.y + TILE_HEIGHT / 2 + 0.002, hairline));

      const label = labelSprite(game.variant.levelNames[z], ink);
      label.position.set(-game.files / 2 - 0.6, corner.y, game.ranks / 2 - 0.2);
      boardGroup.add(label);
    }

    // A floor grid under the lowest level, lined up with its squares, so the
    // board sits in a drawn room.
    const floor = new THREE.GridHelper(24, 24, cssColor("--line", "#ef7a66"), cssColor("--line", "#ef7a66"));
    floor.material.transparent = true;
    floor.material.opacity = 0.35;
    floor.position.set((game.files % 2) / 2, position(game.index(0, 0, 0)).y - gap, (game.ranks % 2) / 2);
    boardGroup.add(floor);
    three.current.tiles = tiles;
  }, [variantId, theme]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Camera: face the board from the player's side, far enough back to see
  // every level; reset on new games and "Reset view".
  useEffect(() => {
    const { camera, controls } = three.current;
    const radius = Math.hypot(game.files / 2, game.ranks / 2, ((game.levels - 1) * gap) / 2 + 0.6);
    const distance = fitDistance(radius, camera);
    const elevation = THREE.MathUtils.degToRad(30);
    const side = playerColor === -1 ? -1 : 1;
    camera.position.set(0, distance * Math.sin(elevation), distance * Math.cos(elevation) * side);
    controls.target.set(0, 0, 0);
    controls.update();
  }, [variantId, playerColor, viewKey]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Pieces, highlights and move markers: rebuilt after every change.
  useEffect(() => {
    const state = three.current;
    const { pieceGroup, markerGroup, tiles } = state;
    disposeGroup(pieceGroup);
    disposeGroup(markerGroup);
    state.bobbing = null;

    const ink = cssColor("--ink", "#d63a22");
    const highlight = (square, opacity) => {
      tiles[square].material = new THREE.MeshBasicMaterial({ color: ink, transparent: true, opacity, depthWrite: false });
    };
    for (const tile of tiles) {
      if (tile.material !== tile.userData.base) tile.material.dispose();
      tile.material = tile.userData.base;
    }
    // Stronger than the pale dark tiles, so the last move stands out; the
    // selected piece's tile is solid ink.
    if (lastMove) {
      highlight(lastMove.from, 0.6);
      highlight(lastMove.to, 0.6);
    }
    if (selected !== null) highlight(selected, 1);

    const tokenGeometry = new THREE.CylinderGeometry(0.34, 0.38, 0.14, 28);
    const whiteToken = new THREE.MeshStandardMaterial({ color: cssColor("--piece-light", "#ffffff"), roughness: 0.6 });
    const blackToken = new THREE.MeshStandardMaterial({ color: cssColor("--piece-dark", "#d63a22"), roughness: 0.6 });
    for (let square = 0; square < game.size; square++) {
      const piece = game.cells[square];
      if (!piece) continue;
      const color = Math.sign(piece);
      const group = new THREE.Group();
      group.userData.square = square;
      const token = new THREE.Mesh(tokenGeometry, color === 1 ? whiteToken : blackToken);
      token.position.y = 0.1;
      const glyph = new THREE.Sprite(new THREE.SpriteMaterial({ map: glyphTexture(Math.abs(piece), color, theme) }));
      glyph.position.y = 0.55;
      glyph.scale.set(0.8, 0.8, 0.8);
      group.add(token, glyph);
      if (game.kings[color] === square && game.inCheck(color)) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.05, 10, 32), new THREE.MeshBasicMaterial({ color: ink }));
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.1;
        group.add(ring);
      }
      group.position.copy(position(square));
      pieceGroup.add(group);
      if (square === selected) state.bobbing = { object: group, baseY: group.position.y };
    }

    for (const [square, { capture }] of targets) {
      const marker = capture
        ? new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 10, 32), new THREE.MeshBasicMaterial({ color: ink }))
        : new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), new THREE.MeshBasicMaterial({ color: ink }));
      if (capture) marker.rotation.x = Math.PI / 2;
      marker.position.copy(position(square));
      marker.position.y += capture ? 0.1 : 0.2;
      marker.userData.square = square;
      // A bigger invisible hit area makes small dots easy to click.
      const hitArea = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
      marker.add(hitArea);
      markerGroup.add(marker);
    }
  }, [version, selected, targets, lastMove, theme]);  // eslint-disable-line react-hooks/exhaustive-deps

  return <div className="board3d" ref={mountRef} />;
}
