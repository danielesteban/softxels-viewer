import { inflate } from 'fflate';
import {
  Group,
  MathUtils,
  Matrix4,
  MeshBasicMaterial,
  Scene,
  Vector3,
} from 'three';
import World from 'softxels';
import Config from 'softxels-viewer-config';
import Menu from './menu.js';
import Input from './input.js';

const _direction = new Vector3();
const _forward = new Vector3();
const _right = new Vector3();
const _position = new Vector3();
const _chunk = new Vector3();
const _voxel = new Vector3();
const _worldUp = new Vector3(0, 1, 0);
const _matrix = new Matrix4();
const _transform = new Matrix4();

class Gameplay extends Scene {
  constructor({ camera, options, renderer }) {
    super();

    const material = new MeshBasicMaterial({ vertexColors: true });
    material.onBeforeCompile = (material) => {
      material.vertexShader = material.vertexShader
        .replace(
          '#include <common>',
          [
            'varying vec3 fragNormal;',
            '#include <common>',
          ].join('\n')
        )
        .replace(
          '#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )',
          '#if 1'
        )
        .replace(
          '#include <begin_vertex>',
          [
            'fragNormal = transformedNormal;',
            '#include <begin_vertex>',
          ].join('\n')
        );
      material.fragmentShader = material.fragmentShader
        .replace(
          '#include <common>',
          [
            'varying vec3 fragNormal;',
            'layout(location = 1) out vec4 pc_fragNormal;',
            '#include <common>',
          ].join('\n')
        )
        .replace(
          '#include <dithering_fragment>',
          [
            '#include <dithering_fragment>',
            'pc_fragNormal = vec4(normalize(fragNormal), 0.0);',
          ].join('\n')
        );
    };

    this.world = new World({ chunkMaterial: material, renderRadius: Config.renderRadius });
    this.add(this.world);

    this.dom = {
      error: document.getElementById('error'),
      loading: document.getElementById('loading'),
      meta: document.getElementById('meta'),
    };

    this.input = new Input(renderer.domElement, renderer.xr);
    this.player = new Group();
    this.player.camera = camera;
    this.player.head = new Vector3();
    this.player.targetFloor = this.player.position.y;
    this.player.targetPosition = this.player.position.clone();
    this.player.targetRotation = this.player.camera.rotation.clone();
    this.player.add(camera);
    this.add(this.player);

    if (Config.enableDragAndDrop) {
      this.onDragEnter = this.onDragEnter.bind(this);
      this.onDragOver = this.onDragOver.bind(this);
      this.onDrop = this.onDrop.bind(this);
      window.addEventListener('dragenter', this.onDragEnter, false);
      window.addEventListener('dragover', this.onDragOver, false);
      window.addEventListener('drop', this.onDrop, false);
    }

    if (options.ipfs) {
      this.load(`https://ipfs.io/ipfs/${options.ipfs}`);
    } else if (Config.initialWorldURL) {
      this.load(Config.initialWorldURL);
    }

    if (Config.worldMenu && !options.ipfs) {
      this.menu = new Menu(Config.worldMenu, (world) => {
        this.world.reset();
        this.load(world.url);
      });
    }
  }

  onUnload() {
    const { dom: { error, loading }, input, menu, world } = this;
    input.dispose();
    if (error) error.classList.remove('enabled');
    if (loading) loading.classList.remove('enabled');
    if (menu) menu.dispose();
    world.dispose();
    if (Config.enableDragAndDrop) {
      window.removeEventListener('dragenter', this.onDragEnter);
      window.removeEventListener('dragover', this.onDragOver);
      window.removeEventListener('drop', this.onDrop);
    }
  }

  load(buffer) {
    const { dom: { error, loading, meta }, player, world } = this;
    this.isLoading = true;
    if (error) error.classList.remove('enabled');
    if (loading) loading.classList.add('enabled');
    (typeof buffer === 'string' ? (
      fetch(buffer).then((res) => {
        const { status } = res;
        if (status < 200 || status >= 400) {
          throw new Error(`${status}`);
        }
        return res.arrayBuffer();
      })
    ) : (
      Promise.resolve(buffer)
    ))
      .then((buffer) => new Promise((resolve, reject) => (
        inflate(new Uint8Array(buffer), (err, inflated) => {
          if (err) reject(err);
          else resolve(inflated.buffer);
        })
      )))
      .then((buffer) => {
        const metadata = world.importChunks(buffer, !Config.autoUpdateRenderRadius);
        player.position.fromArray(metadata.spawn);
        player.position.y = player.targetFloor = this.ground(player.position);
        player.isWalking = player.targetFloor !== -1;
        player.targetPosition.copy(player.position);
        player.camera.position.set(0, 1.6, 0);
        player.camera.rotation.set(0, 0, 0, 'YXZ');
        player.targetRotation.copy(player.camera.rotation);
        player.camera.getWorldPosition(player.head);
        if (meta) {
          let { author, name } = metadata;
          author = `${author || ''}`.trim().slice(0, 50);
          name = `${name || ''}`.trim().slice(0, 50);
          meta.innerText = (author || name) ? (
           `${name}${author && name ? ' by ' : ''}${author}`
          ) : (
            'softxels-viewer'
          );
        }
      })
      .catch((e) => {
        if (error) {
          error.classList.add('enabled');
          const [feedback] = error.getElementsByTagName('div');
          if (feedback) feedback.innerText = `Error: ${e.message}`;
        } else {
          console.err(e);
        }
      })
      .finally(() => {
        this.isLoading = false;
        if (loading) loading.classList.remove('enabled');
      });
  }

  onAnimationTick(delta, time, renderer) {
    const { input, isLoading, player, world } = this;
    input.onAnimationTick(delta);
    this.processPlayerMovement(delta, renderer.xr);
    this.processPlayerInput(renderer.xr);
    if (Config.autoUpdateRenderRadius && !isLoading) {
      world.updateChunks(player.head);
    }
  }

  onEnterVR() {
    const { input, player } = this;
    input.controllers.forEach((controller) => (
      player.add(controller)
    ));
  }

  onExitVR() {
    const { input, player } = this;
    player.camera.position.set(0, 1.6, 0);
    player.camera.rotation.copy(player.targetRotation);
    input.controllers.forEach((controller) => (
      player.remove(controller)
    ));
  }

  onDragEnter(e) {
    e.preventDefault();
  }

  onDragOver(e) {
    e.preventDefault();
  }

  onDrop(e) {
    e.preventDefault();
    const [file] = e.dataTransfer.files;
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => this.load(reader.result);
    reader.readAsArrayBuffer(file);
  }

  processPlayerInput(xr) {
    const { input, player } = this;
    let interact = input.buttons.interactDown;
    if (xr.isPresenting) {
      input.controllers.forEach((controller) => {
        if (!controller.hand) {
          return;
        }
        if (controller.buttons.secondaryDown) {
          Promise.resolve().then(() => xr.getSession().end());
        }
        interact = interact || controller.buttons.primaryDown;
      });
    }

    if (interact) {
      player.isWalking = !player.isWalking;
      if (player.isWalking) {
        const y = this.ground(player.targetPosition);
        if (y !== -1) {
          player.targetFloor = y;
        }
      }
    }
  }

  processPlayerMovement(delta, xr) {
    const { input, player } = this;
    let camera = player.camera;
    let movement = (input.movement.x || input.movement.y) ? input.movement : null;
    let running = input.buttons.run;
    if (xr.isPresenting) {
      xr.updateCamera(player.camera);
      camera = xr.getCamera();
      input.controllers.forEach((controller) => {
        if (!controller.hand) {
          return;
        }
        if (controller.hand.handedness === 'left' && (controller.joystick.x || controller.joystick.y)) {
          movement = controller.joystick;
          running = controller.buttons.tertiary;
        }
        if (controller.hand.handedness === 'right' && (controller.buttons.leftwardsDown || controller.buttons.rightwardsDown)) {
          camera.getWorldPosition(_position);
          _position.y = player.position.y;
          _transform.makeTranslation(_position.x, _position.y, _position.z);
          _transform.multiply(
            _matrix.makeRotationAxis(_worldUp, Math.PI * (controller.buttons.leftwardsDown ? 0.25 : -0.25))
          );
          _transform.multiply(
            _matrix.makeTranslation(-_position.x, -_position.y, -_position.z)
          );
          player.applyMatrix4(_transform);
          player.updateMatrixWorld();
          player.targetPosition.copy(player.position);
          xr.updateCamera(player.camera);
        }
      });
    } else {
      if (input.look.x || input.look.y) {
        player.targetRotation.y += input.look.x;
        player.targetRotation.x += input.look.y;
        player.targetRotation.x = Math.min(Math.max(player.targetRotation.x, Math.PI * -0.5), Math.PI * 0.5);
      }
      camera.rotation.y = MathUtils.damp(camera.rotation.y, player.targetRotation.y, 20, delta);
      camera.rotation.x = MathUtils.damp(camera.rotation.x, player.targetRotation.x, 20, delta);
    }
  
    if (movement) {
      camera.getWorldDirection(_forward);
      if (player.isWalking) {
        _forward.y = 0;
        _forward.normalize();
      }
      _right.crossVectors(_forward, _worldUp).normalize();
      _direction
        .set(0, 0, 0)
        .addScaledVector(_right, movement.x)
        .addScaledVector(_forward, movement.y);
      const length = _direction.length();
      if (length > 1) {
        _direction.divideScalar(length);
      }
      const step = input.speed * (running ? 2 : 1) * delta;
      camera.getWorldPosition(_forward)
        .sub(player.position)
        .add(player.targetPosition)
        .addScaledVector(_direction, step);
      if (player.isWalking) {
        const floor = this.ground(_forward);
        if (floor !== -1 && Math.abs(floor - player.targetPosition.y) < 2) {
          player.targetPosition.addScaledVector(_direction, step);
          player.targetFloor = floor;
        }
      } else {
        player.targetPosition.addScaledVector(_direction, step);
      }
    }
  
    if (player.isWalking) {
      player.targetPosition.y = MathUtils.damp(player.targetPosition.y, player.targetFloor, 10, delta);
    }
    player.position.x = MathUtils.damp(player.position.x, player.targetPosition.x, 10, delta);
    player.position.y = MathUtils.damp(player.position.y, player.targetPosition.y, 10, delta);
    player.position.z = MathUtils.damp(player.position.z, player.targetPosition.z, 10, delta);
  
    player.updateMatrixWorld();
    if (xr.isPresenting) {
      xr.updateCamera(player.camera);
    }
  
    camera.getWorldPosition(player.head);
  }

  ground(position) {
    const { world } = this;
    world.worldToLocal(_voxel.copy(position)).floor();
    if (this.test(_voxel.x, _voxel.y, _voxel.z)) {
      return -1;
    }
    _voxel.y--;
    for (; _voxel.y >= 0; _voxel.y--) {
      if (!this.test(_voxel.x, _voxel.y, _voxel.z)) {
        continue;
      }
      _voxel.y++;
      return world.localToWorld(_voxel).y;
    }
    return -1;
  }

  test(x, y, z) {
    const { world } = this;
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        for (let k = 0; k < 2; k++) {
          _position.set(x + i, y + j, z + k);
          _chunk.copy(_position).divideScalar(world.chunkSize).floor();
          const data = world.dataChunks.get(`${_chunk.x}:${_chunk.y}:${_chunk.z}`);
          if (!data) {
            return false;
          }
          _position.sub(_chunk.multiplyScalar(world.chunkSize));
          const value = data[
            (_position.z * world.chunkSize * world.chunkSize + _position.y * world.chunkSize + _position.x) * 4
          ];
          if (value >= 0x80) {
            return true;
          }
        }
      }
    }
    return false;
  }
}

export default Gameplay;
