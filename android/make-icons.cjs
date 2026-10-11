// Render the existing vector mascot into Android launcher densities.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require(process.env.PIGGY_SHARP || 'sharp');
(async () => {
  const res = path.join(__dirname, 'res');
  const pig = await fs.readFile(path.join(__dirname, '..', 'desktop', 'app', 'assets', 'skins', 'peach-pig.svg'));
  const foreground = await sharp(pig).resize(288, 288).png().toBuffer();
  await fs.mkdir(path.join(res, 'drawable-nodpi'), {recursive: true});
  await sharp({create: {width: 432, height: 432, channels: 4, background: '#00000000'}})
    .composite([{input: foreground, left: 72, top: 72}]).png()
    .toFile(path.join(res, 'drawable-nodpi', 'ic_launcher_foreground.png'));
  for (const [density, size] of Object.entries({mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192})) {
    const dest = path.join(res, 'mipmap-' + density);
    await fs.mkdir(dest, {recursive: true});
    const image = await sharp(pig).resize(Math.round(size * .78), Math.round(size * .78)).png().toBuffer();
    const padding = Math.floor(size * .11);
    await sharp({create: {width: size, height: size, channels: 4, background: '#fbe9df'}})
      .composite([{input: image, left: padding, top: padding}]).png()
      .toFile(path.join(dest, 'ic_launcher.png'));
  }
  console.log('Android mascot icons rendered.');
})().catch(error => {console.error(error); process.exitCode = 1});
