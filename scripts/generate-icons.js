#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

async function main() {
  const sharp = require('sharp');

  const repoRoot = path.join(__dirname, '..');
  const src = path.join(repoRoot, 'public', 'bav_installer.png');
  const outDir = path.join(repoRoot, 'public', 'icons');

  if (!fs.existsSync(src)) {
    console.error(`Source image not found: ${src}`);
    process.exit(1);
  }

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Use icon-gen to generate ICO and PNGs
  const pngSizes = '16,32,48,64,96,128,192,256,384,512,1024';
  const icoSizes = '16,32,48,64,128,256';
  console.log('Generating icons with icon-gen...');
  try {
    execSync(`npx icon-gen --input "${src}" --output "${outDir}" --favicon --favicon-name icon- --favicon-png-sizes ${pngSizes} --favicon-ico-sizes ${icoSizes}`, { stdio: 'inherit' });
    console.log('Icon generation complete with icon-gen.');
  } catch (err) {
    console.error('Failed to generate icons with icon-gen:', err.message);
    process.exit(1);
  }

  // Optionally create an Apple touch icon (180x180) using sharp
  try {
    const appleOut = path.join(outDir, 'apple-touch-icon.png');
    await sharp(src).resize(180, 180, { fit: 'cover' }).png({ quality: 100 }).toFile(appleOut);
    console.log('Wrote', appleOut);
  } catch (err) {
    console.warn('Failed to create apple-touch-icon.png:', err.message || err);
  }

  console.log('Icon generation complete. Files are in public/icons');

  // Copy generated icons to the panel repo (if present) so both projects have the assets
  try {
    const panelIconsDir = path.join(repoRoot, '..', 'bav-livery-panel', 'public', 'icons');
    if (fs.existsSync(path.join(repoRoot, '..', 'bav-livery-panel'))) {
      if (!fs.existsSync(panelIconsDir)) fs.mkdirSync(panelIconsDir, { recursive: true });
      const files = fs.readdirSync(outDir);
      for (const f of files) {
        const srcF = path.join(outDir, f);
        const destF = path.join(panelIconsDir, f);
        fs.copyFileSync(srcF, destF);
        console.log('Copied to panel:', destF);
      }
    }
  } catch (err) {
    console.warn('Failed to copy icons to panel repo:', (err && err.message) || err);
  }
}

main().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
