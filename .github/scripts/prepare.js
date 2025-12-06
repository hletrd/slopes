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

const HTML_MINIFIER_PATH = path.join(ROOT_DIR, 'node_modules', '.bin', 'html-minifier-terser');
if (!fs.existsSync(HTML_MINIFIER_PATH)) {
  console.log('Installing html-minifier-terser...');
  try {
    execSync('npm install html-minifier-terser clean-css-cli --save-dev', { cwd: ROOT_DIR, stdio: 'inherit' });
    console.log('HTML and CSS minifiers installed successfully');
  } catch (error) {
    console.error('Failed to install minifiers:', error);
    process.exit(1);
  }
}

const CACHE_BUSTER = Date.now().toString();
console.log(`Using cache buster: ${CACHE_BUSTER}`);

const filesToCopy = {
  js: ['analytics.js', 'main.js', 'pwa.js', 'service-worker.js'],
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

    const result = execSync(`"${TERSER_PATH}" "${sourcePath}" -m --compress --source-map --output "${destPath}"`);
    console.log(`  Minified: ${path.basename(sourcePath)}`);
  } catch (error) {
    console.error(`Error minifying ${sourcePath}:`, error);
    await copyFile(sourcePath, destPath);
    console.log(`  (Fallback) Copied without minification: ${path.basename(sourcePath)}`);
  }
}

async function minifyCssFile(sourcePath, destPath) {
  try {
    const CLEANCSS_PATH = path.join(ROOT_DIR, 'node_modules', '.bin', 'cleancss');
    execSync(`"${CLEANCSS_PATH}" -o "${destPath}" "${sourcePath}"`);
    console.log(`  Minified CSS: ${path.basename(sourcePath)}`);
  } catch (error) {
    console.error(`Error minifying CSS ${sourcePath}:`, error);
    await copyFile(sourcePath, destPath);
    console.log(`  (Fallback) Copied CSS without minification: ${path.basename(sourcePath)}`);
  }
}

async function addCommitHash(htmlFilePath) {
  let content = await readFile(htmlFilePath, 'utf8');
  if (htmlFilePath.includes('index.html') && content.includes('{commit}')) {
    try {
      const gitCommit = execSync('git rev-parse HEAD').toString().trim();
      const shortCommit = gitCommit.substring(0, 7);
      content = content.replace(/<a target="_blank" href="https:\/\/github\.com\/hletrd\/slopes\/commit\/\{commit\}"><\/a>/g,
        `<a target="_blank" href="https://github.com/hletrd/slopes/commit/${gitCommit}">${shortCommit}</a>`);

      const date = new Date().toISOString().split('T')[0];
      content = content.replace('{date}', date);

      console.log(`  Replaced {commit} with git commit hash: ${shortCommit}`);
      console.log(`  Replaced {date} with current date: ${date}`);
    } catch (error) {
      console.error('Error getting git commit hash:', error);
    }
  }
  await writeFile(htmlFilePath, content, 'utf8');
}

async function minifyHtmlFile(sourcePath, destPath) {
  try {
    await addCommitHash(sourcePath);
    execSync(`"${HTML_MINIFIER_PATH}" --collapse-whitespace --remove-comments --remove-optional-tags --remove-redundant-attributes --remove-script-type-attributes --remove-tag-whitespace --use-short-doctype --minify-css true --minify-js true -o "${destPath}" "${sourcePath}"`);
    console.log(`  Minified HTML: ${path.basename(sourcePath)}`);

    await addCacheBusting(destPath);
  } catch (error) {
    console.error(`Error minifying HTML ${sourcePath}:`, error);
    await copyFile(sourcePath, destPath);
    await addCacheBusting(destPath);
    console.log(`  (Fallback) Copied HTML without minification: ${path.basename(sourcePath)}`);
  }
}

async function addCacheBusting(htmlFilePath) {
  try {
    let content = await readFile(htmlFilePath, 'utf8');

    // Only apply cache busting to local JS files (not starting with http://, https:// or //)
    content = content.replace(/(src=["'])(?!https?:\/\/|\/\/)([^"']*\.js)(["'])/g, `$1$2?v=${CACHE_BUSTER}$3`);

    // Only apply cache busting to local CSS files (not starting with http://, https:// or //)
    content = content.replace(/(href=["'])(?!https?:\/\/|\/\/)([^"']*\.css)(["'])/g, `$1$2?v=${CACHE_BUSTER}$3`);

    await writeFile(htmlFilePath, content, 'utf8');
    console.log(`  Added cache busting to local files in: ${path.basename(htmlFilePath)}`);
  } catch (error) {
    console.error(`Error adding cache busting to ${htmlFilePath}:`, error);
  }
}

async function copyFileToDistAndLog(file) {
  const sourcePath = path.join(ROOT_DIR, file);
  const destPath = path.join(DIST_DIR, file);

  try {
    if (fs.existsSync(sourcePath)) {
      if (file.endsWith('.js')) {
        await minifyJsFile(sourcePath, destPath);
      } else if (file.endsWith('.css')) {
        await minifyCssFile(sourcePath, destPath);
      } else if (file.endsWith('.html')) {
        await minifyHtmlFile(sourcePath, destPath);
      } else if (file.endsWith('.json')) {
        await minifyJsonFile(sourcePath, destPath);
      } else {
        await copyFile(sourcePath, destPath);
        console.log(`Copied: ${file}`);
      }
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

async function minifyJsonFile(sourcePath, destPath) {
  try {
    const content = await readFile(sourcePath, 'utf8');
    const jsonData = JSON.parse(content);
    await writeFile(destPath, JSON.stringify(jsonData), 'utf8');
    console.log(`  Minified JSON: ${path.basename(sourcePath)}`);
  } catch (error) {
    console.error(`Error minifying JSON ${sourcePath}:`, error);
    await copyFile(sourcePath, destPath);
    console.log(`  (Fallback) Copied JSON without minification: ${path.basename(sourcePath)}`);
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
