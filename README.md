softxels-viewer
==

[![screenshot](screenshot.png)](https://softxels-viewer.gatunes.com/)

### Generate worlds from pointclouds

Use [softxels-voxelizer](https://github.com/danielesteban/softxels/tree/master/voxelizer) to create a world from a PLY. Then just drag & drop the BIN over the viewer window.

```bash
npm install -g softxels-voxelizer
softxels-voxelizer -i "input.ply" -o "output.bin"
```

### Dev environment

```bash
# clone this repo
git clone https://github.com/danielesteban/softxels-viewer.git
cd softxels-viewer
# install dev dependencies
npm install
# start the dev environment:
npm start
# open http://localhost:8080/ in your browser
```

### Build with custom config

By default, it will use [config.dev.js](./config.dev.js) & [config.prod.js](./config.prod.js) but you can also specify your own:

```js
/* myconfig.js */
export default {
  autoUpdateRenderRadius: false, // Enables loading/unloading of chunks as the camera moves.
  enableDragAndDrop: false, // Enables/Disables Drag & Drop of world files.
  initialWorldURL: false, // URL of a world file to be initially loaded (or false for none).
  renderRadius: 10, // Radius around the camera that chunks are loaded.
  worldMenu: [ // Displays a menu to load worlds
    { name: 'Example', url: 'https://example.com/world.bin' },
  ],
};
```

```bash
# start a dev environment with that config
CONFIG=/path/to/myconfig.js npm run start

# or just build a production bundle with that config
CONFIG=/path/to/myconfig.js npm run build
```
