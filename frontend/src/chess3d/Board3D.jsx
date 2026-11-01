import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { PIECES } from "./variants.js";

// Vertical distance between levels, per variant (a square is 1 unit wide).
const LEVEL_GAP = { raumschach: 1.8, skyscraper: 2.4 };
const TILE_HEIGHT = 0.05;
const CLICK_SLOP_PX = 6;  // a drag shorter than this still counts as a click

function cssColor(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return new THREE.Color(value || fallback);
}

// Piece symbols are drawn onto small canvases and shown as sprites, so they
// always face the camera and match the 2D board's look.
const glyphTextures = new Map();

function glyphTexture(type, color) {
  const key = `${type}:${color}`;
  if (glyphTextures.has(key)) return glyphTextures.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '100px "Apple Symbols", "Segoe UI Symbol", "Noto Sans Symbols 2", "Apple Color Emoji", sans-serif';
  ctx.lineJoin = "round";
  ctx.lineWidth = 8;
  ctx.strokeStyle = color === 1 ? "#3b2d4a" : "#fff8ec";
  ctx.fillStyle = color === 1 ? "#ffffff" : "#3b2d4a";
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
  ctx.font = '600 44px "Fredoka", sans-serif';
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
    controls.maxDistance = 30;

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
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
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

  // The glass levels: rebuilt when the variant changes.
  useEffect(() => {
    const { boardGroup } = three.current;
    disposeGroup(boardGroup);
    const light = new THREE.MeshStandardMaterial({ color: cssColor("--light-square", "#fff1d2"), transparent: true, opacity: 0.62, depthWrite: false, roughness: 0.3 });
    const dark = new THREE.MeshStandardMaterial({ color: cssColor("--dark-square", "#9dd3b4"), transparent: true, opacity: 0.62, depthWrite: false, roughness: 0.3 });
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

    const frameColor = cssColor("--frame", "#f6b38f");
    const muted = getComputedStyle(document.documentElement).getPropertyValue("--muted").trim() || "#8a7b97";
    for (let z = 0; z < game.levels; z++) {
      const corner = position(game.index(0, 0, z));
      const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(game.files, TILE_HEIGHT, game.ranks)),
        new THREE.LineBasicMaterial({ color: frameColor }),
      );
      outline.position.set(0, corner.y, 0);
      boardGroup.add(outline);

      const label = labelSprite(game.variant.levelNames[z], muted);
      label.position.set(-game.files / 2 - 0.6, corner.y, game.ranks / 2 - 0.2);
      boardGroup.add(label);
    }
    three.current.tiles = tiles;
  }, [variantId]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Camera: face the board from the player's side, far enough back to see
  // every level; reset on new games and "Reset view".
  useEffect(() => {
    const { camera, controls } = three.current;
    const radius = Math.hypot(game.files / 2, game.ranks / 2, ((game.levels - 1) * gap) / 2 + 0.6);
    const distance = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2));
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

    const accent = cssColor("--accent", "#ff7a59");
    const grape = cssColor("--grape", "#a685ee");
    const sunColor = cssColor("--sun", "#ffc94d");
    const highlight = (square, color) => {
      tiles[square].material = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false });
    };
    for (const tile of tiles) {
      if (tile.material !== tile.userData.base) tile.material.dispose();
      tile.material = tile.userData.base;
    }
    if (lastMove) {
      highlight(lastMove.from, sunColor);
      highlight(lastMove.to, sunColor);
    }
    if (selected !== null) highlight(selected, grape);

    const tokenGeometry = new THREE.CylinderGeometry(0.34, 0.38, 0.14, 28);
    const whiteToken = new THREE.MeshStandardMaterial({ color: 0xfffaf2, roughness: 0.45 });
    const blackToken = new THREE.MeshStandardMaterial({ color: 0x4a3a5c, roughness: 0.45 });
    for (let square = 0; square < game.size; square++) {
      const piece = game.cells[square];
      if (!piece) continue;
      const color = Math.sign(piece);
      const group = new THREE.Group();
      group.userData.square = square;
      const token = new THREE.Mesh(tokenGeometry, color === 1 ? whiteToken : blackToken);
      token.position.y = 0.1;
      const glyph = new THREE.Sprite(new THREE.SpriteMaterial({ map: glyphTexture(Math.abs(piece), color) }));
      glyph.position.y = 0.55;
      glyph.scale.set(0.8, 0.8, 0.8);
      group.add(token, glyph);
      if (game.kings[color] === square && game.inCheck(color)) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.05, 10, 32), new THREE.MeshBasicMaterial({ color: 0xff4646 }));
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
        ? new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 10, 32), new THREE.MeshBasicMaterial({ color: accent }))
        : new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), new THREE.MeshBasicMaterial({ color: grape }));
      if (capture) marker.rotation.x = Math.PI / 2;
      marker.position.copy(position(square));
      marker.position.y += capture ? 0.1 : 0.2;
      marker.userData.square = square;
      // A bigger invisible hit area makes small dots easy to click.
      const hitArea = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
      marker.add(hitArea);
      markerGroup.add(marker);
    }
  }, [version, selected, targets, lastMove]);  // eslint-disable-line react-hooks/exhaustive-deps

  return <div className="board3d" ref={mountRef} />;
}
