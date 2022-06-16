import {
  Clock,
  PerspectiveCamera,
  sRGBEncoding,
  WebGLRenderer,
} from 'three';
import PostProcessing from './postprocessing.js';
import Scene from './scene.js';
import './app.css';

const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const clock = new Clock();
const fps = {
  dom: document.getElementById('fps'),
  count: 0,
  lastTick: clock.oldTime / 1000,
};
const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance', stencil: false });
renderer.outputEncoding = sRGBEncoding;
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('renderer').appendChild(renderer.domElement);
const postprocessing = new PostProcessing({
  enabled: (
    !localStorage.getItem('vfx:disabled')
    && !navigator.userAgent.includes('Mobile')
    && !navigator.userAgent.includes('Quest')
  ),
  samples: 4,
});
const scene = new Scene({
  camera,
  options: location.hash.slice(2).split('/').reduce((keys, option) => {
    if (option) {
      const [key, value] = option.split(':');
      keys[(key || '').trim()] = (value || '').trim();
    }
    return keys;
  }, {}),
  renderer,
});

window.addEventListener('contextmenu', (e) => e.preventDefault(), false);
window.addEventListener('hashchange', () => location.reload(), false);
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  postprocessing.onResize(window.innerWidth, window.innerHeight)
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  if (scene.onResize) {
    scene.onResize(window.innerWidth, window.innerHeight);
  }
}, false);
document.addEventListener('visibilitychange', () => {
  const isVisible = document.visibilityState === 'visible';
  if (isVisible) {
    clock.start();
    fps.count = -1;
    fps.lastTick = (clock.oldTime / 1000);
  }
}, false);

renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), 1);
  const time = clock.oldTime / 1000;
  scene.onAnimationTick(delta, time, renderer);
  if (postprocessing.isEnabled && !renderer.xr.isPresenting) {
    postprocessing.render(renderer, scene, camera);
  } else {
    renderer.render(scene, camera);
  }
  fps.count += 1;
  if (time >= fps.lastTick + 1) {
    const count = Math.round(fps.count / (time - fps.lastTick));
    if (fps.dom) fps.dom.innerText = `${count}fps`;
    fps.lastTick = time;
    fps.count = 0;
  }
});

if (document.getElementById('error')) {
  const [reload] = document.getElementById('error').getElementsByTagName('a');
  if (reload) {
    reload.addEventListener('click', () => location.reload(), false);
  }
}

if (document.getElementById('debug')) {
  const GL = renderer.getContext();
  const ext = GL.getExtension('WEBGL_debug_renderer_info');
  if (ext) {
    document.getElementById('debug').innerText = GL.getParameter(ext.UNMASKED_RENDERER_WEBGL);
  }
}

if (document.getElementById('controls')) {
  const controls = document.createElement('div');
  controls.classList.add('dialog', 'controls');
  const toggleControls = () => controls.classList.toggle('enabled');
  document.getElementById('controls').addEventListener('click', toggleControls, false);
  controls.addEventListener('click', toggleControls, false);
  const wrapper = document.createElement('div');
  controls.appendChild(wrapper);
  document.body.appendChild(controls);
  [
    [
      "Mouse & Keyboard",
      [
        ["W A S D", "Move"],
        ["Shift", "Run"],
        ["Mouse", "Look"],
        ["E", "Walk/Fly"],
        ["Wheel", "Set speed"],
      ],
    ],
    [
      "Gamepad",
      [
        ["Left stick", "Move (press to run)"],
        ["Right stick", "Look"],
        ["A", "Walk/Fly"],
      ],
    ],
    [
      "VR",
      [
        ["Left stick", "Move (press to run)"],
        ["Right stick", "Rotate view"],
        ["A/X", "Walk/Fly"],
        ["B/Y", "Exit VR"],
      ],
    ]
  ].forEach(([name, maps]) => {
    const group = document.createElement('div');
    const heading = document.createElement('h1');
    heading.innerText = name;
    group.appendChild(heading);
    maps.forEach((map) => {
      const item = document.createElement('div');
      map.forEach((map, i) => {
        const text = document.createElement('div');
        text.innerText = `${map}${i === 0 ? ':' : ''}`;
        item.appendChild(text);
      });
      group.appendChild(item);
    });
    wrapper.appendChild(group);
  });
}

if (document.getElementById('vfx')) {
  const vfx = document.getElementById('vfx');
  const status = vfx.getElementsByTagName('span')[0];
  const updateStatus = () => {
    const { isEnabled } = postprocessing;
    status.classList[isEnabled ? 'add' : 'remove']('enabled');
    status.innerText = isEnabled ? '[ON]' : '[OFF]';
  };
  updateStatus();
  vfx.addEventListener('click', () => {
    postprocessing.isEnabled = !postprocessing.isEnabled;
    updateStatus();
    localStorage[`${postprocessing.isEnabled ? 'remove' : 'set'}Item`](`vfx:disabled`, '1');
  }, false);
}

if (document.getElementById('vr') && navigator.xr) {
  renderer.xr.enabled = true;
  renderer.xr.cameraAutoUpdate = false;
  navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
    if (!supported) {
      return;
    }
    const vr = document.getElementById('vr');
    const [label] = vr.getElementsByTagName('span');
    vr.classList.add('enabled');
    if (label) label.innerText = 'Enter VR';
    let currentSession = null;
    const onSessionEnded = () => {
      currentSession.removeEventListener('end', onSessionEnded);
      currentSession = null;
      if (label) label.innerText = 'Enter VR';
      if (scene.onExitVR) scene.onExitVR();
    };
    vr.addEventListener('click', () => {
      if (currentSession) {
        currentSession.end();
        return;
      }
      navigator.xr
        .requestSession('immersive-vr', { optionalFeatures: ['local-floor'] })
        .then((session) => {
          session.addEventListener('end', onSessionEnded);
          renderer.xr.setSession(session)
            .then(() => {
              currentSession = session;
              if (label) label.innerText = 'Exit VR';
              if (scene.onEnterVR) scene.onEnterVR();
            });
        });
    }, false);
    document.body.appendChild(toggle);
  });
}
