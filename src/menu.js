class Menu {
  constructor(worlds, load) {
    this.dom = document.createElement('div');
    this.dom.id = 'worlds';
    document.body.appendChild(this.dom);

    worlds.forEach((world) => {
      const button = document.createElement('button');
      button.innerText = world.name;
      button.addEventListener('click', () => load(world), false);
      this.dom.appendChild(button);
    });
  }

  dispose() {
    const { dom } = this;
    document.body.removeChild(dom);
  }
}

export default Menu;
