const fs = require('fs-extra');
const path = require('path');
const { marked } = require('marked');
const { JSDOM } = require('jsdom');

// 确保目录存在
function ensureDirectoryExistence(directory) {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory);
    }
}

// 读取posts文件夹中的Markdown文件，并转换为HTML文件
function convertMarkdownToHtml(directory, outputDirectory) {
    const files = fs.readdirSync(directory);

    files.forEach(file => {
        if (path.extname(file) === '.md') {
            const markdown = fs.readFileSync(path.join(directory, file), 'utf-8');
            const html = marked(markdown);
            const htmlFileName = path.basename(file, '.md') + '.html';
            fs.writeFileSync(path.join(outputDirectory, htmlFileName), html, 'utf-8');
        }
    });
}

// 在内存中生成新的index.html
function generateNewIndexHtml(directory, originalIndexFilePath, outputIndexFilePath) {
    const indexHtml = fs.readFileSync(originalIndexFilePath, 'utf-8');
    const dom = new JSDOM(indexHtml);
    const document = dom.window.document;

    const files = fs.readdirSync(directory);
    const ul = document.createElement('ul');

    files.forEach(file => {
        if (path.extname(file) === '.html') {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = file;
            a.textContent = path.basename(file, '.html');
            li.appendChild(a);
            ul.appendChild(li);
        }
    });

    document.body.appendChild(ul);
    fs.writeFileSync(outputIndexFilePath, dom.serialize(), 'utf-8');
}

// 主构建过程
function build() {
    const postsDirectory = path.join(__dirname, '../posts');
    const diskDirectory = path.join(__dirname, '../disk');
    const originalIndexFilePath = path.join(__dirname, '../index.html');
    const outputIndexFilePath = path.join(diskDirectory, 'index.html');

    // 确保输出目录存在
    ensureDirectoryExistence(diskDirectory);

    // 转换Markdown文件并将HTML文件写入到disk目录
    convertMarkdownToHtml(postsDirectory, diskDirectory);

    // 在内存中生成新的index.html并写入到disk目录
    generateNewIndexHtml(diskDirectory, originalIndexFilePath, outputIndexFilePath);

    console.log('Markdown files converted and new index.html generated in disk directory.');
}

// 运行构建过程
build();
