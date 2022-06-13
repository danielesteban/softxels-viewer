const CDN = 'https://rawcdn.githack.com/danielesteban/softxels-example-worlds/561b9e385621338bd82216e6eab25bec53f65a4e/';
export default {
  autoUpdateRenderRadius: false,
  enableDragAndDrop: true,
  initialWorldURL: `${CDN}world1.bin`,
  renderRadius: 10,
  worldMenu: [
    { name: 'Museum', url: `${CDN}world1.bin` },
    { name: 'Bedroom', url: `${CDN}world2.bin` },
    { name: 'Cloister', url: `${CDN}world3.bin` }
  ],
};
