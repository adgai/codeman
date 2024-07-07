const fs = require('fs-extra');
const path = require('path');
const { marked } = require('marked');
const { JSDOM } = require('jsdom');
const matter = require('gray-matter');
const {addDays, format}  =  require ("date-fns");
const chokidar = require('chokidar');


// 确保目录存在
function ensureDirectoryExistence(directory) {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory);
    }
}

// 读取posts文件夹中的Markdown文件，并转换为HTML文件
function convertMarkdownToHtml(directory, outputDirectory,dt) {
    const files = fs.readdirSync(directory);


    files.forEach(file => {
        if (path.extname(file) === '.md') {
            const markdown = fs.readFileSync(path.join(directory, file), 'utf-8');
            const { content, data } = matter(markdown); // 解析 Markdown 文件

            let basename = path.basename(file, '.md');
            console.log(basename)
            dt.set(basename,data)
            console.log(JSON.stringify(dt))
            const html = marked(content);

            const fullHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>${path.basename(file, '.md')}</title>
            <link rel="stylesheet" type="text/css" href="./static/article.css">
        </head>
        <body>
        <div class="article_container">
        <div class="article_content">
             ${html}
        </div>
        </div>
     
        </body>
        </html>
      `;

            const htmlFileName = basename + '.html';
            fs.writeFileSync(path.join(outputDirectory, htmlFileName), fullHtml, 'utf-8');
        }
    });
    console.log(dt)
}

// 在内存中生成新的index.html
function generateNewIndexHtml(directory, originalIndexFilePath, outputIndexFilePath,dt) {
    const indexHtml = fs.readFileSync(originalIndexFilePath, 'utf-8');
    const dom = new JSDOM(indexHtml);
    const document = dom.window.document;

    const files = fs.readdirSync(directory);
    const ul = document.createElement('ul');

    files.forEach(file => {
        if (path.extname(file) === '.html' && file !== 'index.html') {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = file;
            a.textContent = path.basename(file, '.html');
            li.appendChild(a);

            let basename = path.basename(file, '.html');
            let newVar = dt.get(basename);
            let date = newVar === undefined ? new Date() : newVar.date;
            let htmlSpanElement = document.createElement('span');
            htmlSpanElement.textContent =format(date, 'yyyy/MM/dd');
            li.appendChild(htmlSpanElement)
            ul.appendChild(li);
        }
    });

   document.getElementById('article').appendChild(ul);

    fs.writeFileSync(outputIndexFilePath, dom.serialize(), 'utf-8');
}

// 复制assets文件夹
function copyAssetsDirectory(sourceDirectory, targetDirectory,f) {
    const sourceAssetsPath = path.join(sourceDirectory, f);
    const targetAssetsPath = path.join(targetDirectory, f);
    if (fs.existsSync(sourceAssetsPath)) {
        fs.copySync(sourceAssetsPath, targetAssetsPath);
        console.log(`Copied assets from ${sourceAssetsPath} to ${targetAssetsPath}`);
    } else {
        console.log('No assets directory found to copy.');
    }
}

// 清空输出目录
function clearOutputDirectory(directory) {
    fs.emptyDirSync(directory);
    console.log(`Cleared directory: ${directory}`);
}

// 主构建过程
function build() {
    const postsDirectory = path.join(__dirname, '../posts');
    const diskDirectory = path.join(__dirname, '../disk');
    const originalIndexFilePath = path.join(__dirname, '../index.html');
    const outputIndexFilePath = path.join(diskDirectory, 'index.html');

    var dt = new Map();


    // 清空输出目录
    clearOutputDirectory(diskDirectory);

    // 确保输出目录存在
    ensureDirectoryExistence(diskDirectory);

    // 转换Markdown文件并将HTML文件写入到disk目录
    convertMarkdownToHtml(postsDirectory, diskDirectory,dt);

    // 在内存中生成新的index.html并写入到disk目录
    generateNewIndexHtml(diskDirectory, originalIndexFilePath, outputIndexFilePath,dt);

    // 复制assets文件夹
    copyAssetsDirectory(postsDirectory, diskDirectory,'assets');
    copyAssetsDirectory(postsDirectory, diskDirectory,'static');

    console.log('Markdown files converted and new index.html generated in disk directory.');
}

// 监视assets文件夹并在变更时重新构建
function watch() {
    const assetsDirectory = path.join(__dirname, '../posts/assets');

    chokidar.watch(assetsDirectory, { ignoreInitial: true })
        .on('all', (event, path) => {
        console.log(`Detected ${event} on ${path}. Rebuilding...`);
        build();
    });


    console.log(`Watching for changes in ${assetsDirectory}`);
}

// 运行构建过程并开始监视
build();
// watch();