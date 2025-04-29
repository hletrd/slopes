#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { copyFile, mkdir, writeFile, readFile } = require('fs/promises');
const { execSync } = require('child_process');

const nodeVersion = process.versions.node;
if (parseInt(nodeVersion.split('.')[0]) < 22) {
  console.error(`Node version 22+ required. Current version: ${nodeVersion}`);
  process.exit(1);
}

const ROOT_DIR = path.resolve(__dirname, '../..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const TERSER_PATH = path.join(ROOT_DIR, 'node_modules', '.bin', 'terser');

if (!fs.existsSync(TERSER_PATH)) {
  console.log('Installing terser...');
  try {
    execSync('npm install', { cwd: ROOT_DIR, stdio: 'inherit' });
    console.log('Terser installed successfully');
  } catch (error) {
    console.error('Failed to install terser:', error);
    process.exit(1);
  }
}

const filesToCopy = {
  js: ['analytics.js', 'main.js', 'pwa.js', 'service-worker.js', 'WespJSSDKEncV4.min.js'],
  html: ['index.html', 'vivaldi.html'],
  css: ['main.css'],
  json: ['manifest.json'],
  resources: ['preview.png', 'favicon.ico'],
  xml: ['sitemap.xml', 'robots.txt']
};

const screenshots = [
  'screenshot_desktop.avif',
  'screenshot_desktop.png',
  'screenshot_mobile.avif',
  'screenshot_mobile.png',
  'screenshot_tablet.avif',
  'screenshot_tablet.png'
];

async function createDistDir() {
  try {
    if (!fs.existsSync(DIST_DIR)) {
      await mkdir(DIST_DIR, { recursive: true });
      console.log(`Created dist directory: ${DIST_DIR}`);
    }

    const iconsDir = path.join(DIST_DIR, 'icons');
    if (!fs.existsSync(iconsDir)) {
      await mkdir(iconsDir, { recursive: true });
      console.log(`Created icons directory: ${iconsDir}`);
    }
  } catch (error) {
    console.error('Error creating directories:', error);
    process.exit(1);
  }
}

async function minifyJsFile(sourcePath, destPath) {
  try {
    if (sourcePath.includes('.min.js')) {
      await copyFile(sourcePath, destPath);
      return;
    }

    const result = execSync(`"${TERSER_PATH}" "${sourcePath}" --compress --source-map --output "${destPath}"`);
    console.log(`  Minified: ${path.basename(sourcePath)}`);
  } catch (error) {
    console.error(`Error minifying ${sourcePath}:`, error);
    await copyFile(sourcePath, destPath);
    console.log(`  (Fallback) Copied without minification: ${path.basename(sourcePath)}`);
  }
}

async function copyFileToDistAndLog(file) {
  const sourcePath = path.join(ROOT_DIR, file);
  const destPath = path.join(DIST_DIR, file);

  try {
    if (fs.existsSync(sourcePath)) {
      if (file.endsWith('.js')) {
        await minifyJsFile(sourcePath, destPath);
      } else {
        await copyFile(sourcePath, destPath);
      }
      console.log(`Copied: ${file}`);
    } else {
      console.warn(`Warning: File not found: ${sourcePath}`);
    }
  } catch (error) {
    console.error(`Error copying ${file}:`, error);
  }
}

async function copyIcons() {
  const sourceIconsDir = path.join(ROOT_DIR, 'icons');
  const destIconsDir = path.join(DIST_DIR, 'icons');

  try {
    if (fs.existsSync(sourceIconsDir)) {
      const icons = fs.readdirSync(sourceIconsDir);

      for (const icon of icons) {
        const sourcePath = path.join(sourceIconsDir, icon);
        const destPath = path.join(destIconsDir, icon);

        if (fs.statSync(sourcePath).isDirectory()) continue;

        await copyFile(sourcePath, destPath);
        console.log(`Copied icon: ${icon}`);
      }
    } else {
      console.warn(`Warning: Icons directory not found: ${sourceIconsDir}`);
    }
  } catch (error) {
    console.error('Error copying icons:', error);
  }
}

async function main() {
  console.log('Starting deployment preparation...');

  await createDistDir();

  for (const [category, files] of Object.entries(filesToCopy)) {
    console.log(`\nCopying ${category} files:`);
    for (const file of files) {
      await copyFileToDistAndLog(file);
    }
  }

  console.log('\nCopying screenshots:');
  for (const screenshot of screenshots) {
    await copyFileToDistAndLog(screenshot);
  }

  console.log('\nCopying icons:');
  await copyIcons();

  console.log('\nDeployment preparation completed!');
}

main().catch(error => {
  console.error('Deployment preparation failed:', error);
  process.exit(1);
});
