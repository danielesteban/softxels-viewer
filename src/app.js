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
    fps.dom.innerText = `${count}fps`;
    fps.lastTick = time;
    fps.count = 0;
  }
});

{
  const GL = renderer.getContext();
  const ext = GL.getExtension('WEBGL_debug_renderer_info');
  if (ext) {
    document.getElementById('debug').innerText = GL.getParameter(ext.UNMASKED_RENDERER_WEBGL);
  }
}
{
  const controls = document.createElement('div');
  controls.className = 'dialog controls';
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
{
  const vfx = document.getElementById('vfx');
  const status = vfx.getElementsByTagName('span')[0];
  const updateStatus = () => {
    const { isEnabled } = postprocessing;
    status.className = isEnabled ? 'enabled' : '';
    status.innerText = isEnabled ? '[ON]' : '[OFF]';
  };
  updateStatus();
  vfx.addEventListener('click', () => {
    postprocessing.isEnabled = !postprocessing.isEnabled;
    updateStatus();
    localStorage[`${postprocessing.isEnabled ? 'remove' : 'set'}Item`](`vfx:disabled`, '1');
  }, false);
}
if (navigator.xr) {
  renderer.xr.enabled = true;
  renderer.xr.cameraAutoUpdate = false;
  navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
    if (!supported) {
      return;
    }
    const toggle = document.createElement('div');
    toggle.id = 'vr';
    {
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('width', 24);
      svg.setAttribute('height', 24);
      svg.setAttribute('viewBox', '0 0 512 512');
      svg.setAttribute('fill', 'currentColor');
      [
        'm299.452 386.371c-27.984 9.338-58.852 9.336-86.916-.004-7.863-2.618-16.354 1.635-18.969 9.495-2.616 7.86 1.635 16.354 9.496 18.97 17.09 5.688 35.031 8.531 52.967 8.531s35.868-2.846 52.918-8.535c7.858-2.622 12.103-11.118 9.48-18.977-2.621-7.857-11.116-12.1-18.976-9.48z',
        'm430.736 97.999c-6.384-45.79-45.703-81.932-94.402-81.932h-17.134v-1.067c0-8.284-6.716-15-15-15h-96.4c-8.284 0-15 6.716-15 15v1.066h-17.133c-48.291 0-87.664 35.638-94.36 81.922-28.118 6.399-49.173 31.584-49.173 61.611v128.534c0 41.106 33.483 57.859 48.692 61.474 6.868 92.539 84.571 162.393 175.174 162.393 92.396 0 168.358-71.705 175.167-162.389 39.424-9.36 48.699-45.128 48.699-61.477v-128.534c.001-30.012-21.034-55.187-49.13-61.601zm-111.536-51.933h17.133c42.442 0 59.975 34.701 63.62 50.334h-80.753zm-96.4-16.066h66.4v66.4h-66.4zm-47.133 16.066h17.133v50.334h-80.691c9.729-40.756 46.651-50.334 63.558-50.334zm80.333 435.934c-74.035 0-137.32-56.086-144.904-130.667h73.97c18.407 0 36.417-7.459 49.412-20.464.077-.077.153-.155.229-.234 5.643-5.52 13.385-8.679 21.293-8.679 7.91 0 15.652 3.16 21.294 8.68.075.078.151.156.229.233 12.995 13.005 31.005 20.464 49.413 20.464h73.963c-7.533 73.301-69.642 130.667-144.899 130.667zm193.867-193.866c0 18.564-15.131 33.199-33.2 33.199h-89.731c-10.392 0-20.558-4.161-27.948-11.428-.081-.085-.163-.169-.246-.253-11.246-11.246-26.824-17.696-42.741-17.696-15.916 0-31.494 6.45-42.74 17.696-.083.083-.166.167-.247.252-7.391 7.268-17.557 11.429-27.948 11.429h-89.733c-18.012 0-33.2-14.572-33.2-33.199v-128.534c0-18.306 14.894-33.199 33.2-33.199h321.333c18.307 0 33.2 14.894 33.2 33.199v128.534z',
      ].forEach((d) => {
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d', d);
        svg.appendChild(path);
      });
      toggle.appendChild(svg);
    }
    const label = document.createElement('div');
    label.innerText = 'Enter VR';
    toggle.appendChild(label);
    let currentSession = null;
    const onSessionEnded = () => {
      currentSession.removeEventListener('end', onSessionEnded);
      currentSession = null;
      label.innerText = 'Enter VR';
      if (scene.onExitVR) {
        scene.onExitVR();
      }
    };
    toggle.addEventListener('click', () => {
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
              label.innerText = 'Exit VR';
              if (scene.onEnterVR) {
                scene.onEnterVR();
              }
            });
        });
    }, false);
    document.body.appendChild(toggle);
  });
}
window.addEventListener('contextmenu', (e) => e.preventDefault(), false);
