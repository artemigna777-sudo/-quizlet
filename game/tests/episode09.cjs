module.exports = async ({ p, g, step }) => {
  await g(() => {
    const x = window.__game;
    x.cine.skip();
    x.player.pos = { x: 18, z: 20 };
    x.dog.place({ x: 17.2, z: 18.4 });
    x.player.yaw = Math.PI;
  });
  await step(35);
  await g(() => window.__game.dog.pet());
  await step(70);
  await g(() => window.__game.openMap());
  await step(100);
  await p.click('#mapOk');
  await step(25);
};
