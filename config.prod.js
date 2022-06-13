const CDN = 'https://rawcdn.githack.com/danielesteban/softxels-example-worlds/b9eed8c0cafc0f65dc0a64c29261c552012007fb/';
export default {
  enableDragAndDrop: true,
  initialWorldURL: `${CDN}world1.bin`,
  renderRadius: 10,
  worldMenu: [
    { name: 'Museum', url: `${CDN}world1.bin` },
    { name: 'Bedroom', url: `${CDN}world2.bin` },
    { name: 'Cloister', url: `${CDN}world3.bin` }
  ],
};
