
// build.js
const args = process.argv.slice(2); // 获取命令行参数
const isDebug = args.includes('--debug'); // 检查是否包含 --debug 参数

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { marked } = require('marked');
const { JSDOM } = require('jsdom');
const matter = require('gray-matter');
const chokidar = require('chokidar');
const { gfmHeadingId } =  require ("marked-gfm-heading-id");

// Front matter 中的时间没有时区，直接按写入的年月日展示。
function formatPostDate(date, includeTime = false) {
    const pad = value => String(value).padStart(2, '0');
    const year = date.getUTCFullYear();
    const month = pad(date.getUTCMonth() + 1);
    const day = pad(date.getUTCDate());
    if (!includeTime) return `${year}/${month}/${day}`;
    return `${year}年${month}月${day}日 ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

// 确保目录存在
function ensureDirectoryExistence(directory) {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory);
    }
}

function getPngDimensions(filePath) {
    if (!fs.existsSync(filePath)) return null;
    const header = Buffer.alloc(24);
    const file = fs.openSync(filePath, 'r');
    try {
        if (fs.readSync(file, header, 0, header.length, 0) !== header.length) return null;
        if (header.toString('hex', 0, 8) !== '89504e470d0a1a0a' || header.toString('ascii', 12, 16) !== 'IHDR') return null;
        return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
    } finally {
        fs.closeSync(file);
    }
}

// 读取posts文件夹中的Markdown文件，并转换为HTML文件
function convertMarkdownToHtml(directory, outputDirectory,dt) {
    const files = fs.readdirSync(directory);
    const articleCss = fs.readFileSync(path.join(__dirname, '../posts/static/article.css'));
    const articleCssVersion = crypto.createHash('sha1').update(articleCss).digest('hex').slice(0, 8);

    const options = {
        headerIds: true, // 启用 headerIds 选项
    };

    // 创建自定义 renderer
    const renderer = new marked.Renderer();

// 重写 image 方法，为 img 标签添加 class
    renderer.image = function(href, title, text) {
        const className = 'data-zoomable'; // 你想添加的 class
        let out = '<img class="' + className + '" src="' + href.href + '" alt="' +  href.text + '" loading="lazy" decoding="async"';
        const dimensions = getPngDimensions(path.resolve(directory, href.href));
        if (dimensions) {
            const previewWidth = Math.min(dimensions.width, Math.round(dimensions.width * 620 / dimensions.height));
            out += ' width="' + dimensions.width + '" height="' + dimensions.height + '"';
            out += ' style="width:min(100%,' + previewWidth + 'px);aspect-ratio:' + dimensions.width + '/' + dimensions.height + '"';
        }
        if (title) {
            out += ' title="' + title + '"';
        }
        out += this.options.xhtml ? '/>' : '>';
        return out;
    };

    files.forEach(file => {
        if (path.extname(file) === '.md') {
            const markdown = fs.readFileSync(path.join(directory, file), 'utf-8');
            const { content, data } = matter(markdown); // 解析 Markdown 文件
            if (data.draft !== undefined && data.draft) {
                return
            }
            let basename = path.basename(file, '.md');
            console.log(basename)
            dt.set(basename,data)
            console.log(JSON.stringify(dt))
            const options = {
                prefix: "my-prefix-",
                renderer : renderer
            };

            marked.use(gfmHeadingId(options));

            // 重写 image 方法，为 img 标签添加 class


            const rendered = new JSDOM('<body>' + marked(content, options) + '</body>');
            rendered.window.document.querySelectorAll('h1, h2, h3, h4').forEach((heading, index) => {
                heading.id = 'section-' + (index + 1);
            });
            rendered.window.document.querySelectorAll('h5, h6').forEach((heading, index) => {
                heading.id = 'section-deep-' + (index + 1);
            });
            const html = rendered.window.document.body.innerHTML;
            // 读取 static/article.html
            const templatePath = path.join(__dirname, '../posts/static/article.html');
            let templateHtml = fs.readFileSync(templatePath, 'utf8');
            // generateI(html)
            const htmlFileName = basename + '.html';

            let outputHtml = templateHtml.replace('<!-- CONTENT -->', html)
                .replace('./static/article.css', `./static/article.css?v=${articleCssVersion}`)
                .replace('<!-- AUTHOR -->', data.author)
                .replace('<!-- TITLE -->', data.title)
                .replace('<!-- TITLE -->', data.title)
                .replace('<!-- TIME -->', formatPostDate(data.date, true))
                .replace('<!-- LOCATION -->', data.location)
                .replace('<body>', data.layout === 'directory' ? '<body class="directory-page">' : '<body>')

            ;

            if (data.layout === 'directory') {
                outputHtml = outputHtml.replaceAll('返回文章列表', '返回首页').replace('全文完', '工具清单');
            }

            fs.writeFileSync(path.join(outputDirectory, htmlFileName), outputHtml, 'utf-8');
        }
    });
    console.log(dt)
}

// 在内存中生成新的index.html
function generateNewIndexHtml(directory, originalIndexFilePath, outputIndexFilePath, dt) {
    try {
        // 读取原始的index.html文件内容
        const indexHtml = fs.readFileSync(originalIndexFilePath, 'utf-8');
        const dom = new JSDOM(indexHtml);
        const document = dom.window.document;

        // 获取目录中的所有文件
        const files = fs.readdirSync(directory);

        // 过滤和排序HTML文件，排除index.html，并根据日期倒序排序
        const sortedFiles = files
            .filter(file => path.extname(file) === '.html' && file !== 'index.html' && dt.get(path.basename(file, '.html'))?.showOnHome !== false)
            .sort((a, b) => {
                const aDate = dt.get(path.basename(a, '.html'))?.date || new Date();
                const bDate = dt.get(path.basename(b, '.html'))?.date || new Date();
                return bDate - aDate; // 倒序排序
            });

        const ul = document.createElement('ul');

        // 生成排序后的HTML文件列表
        sortedFiles.forEach(file => {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = file;
            const basename = path.basename(file, '.html');
            a.textContent = dt.get(basename)?.title || basename;
            let newVar = dt.get(basename);
            let date = newVar === undefined ? new Date() : newVar.date;
            let htmlSpanElement = document.createElement('span');
            htmlSpanElement.textContent = formatPostDate(date);
            li.appendChild(htmlSpanElement);
            li.appendChild(a);
            ul.appendChild(li);
        });

        // 将<ul>添加到<div id="article">中
        const articleElement = document.getElementById('article');
        articleElement.innerHTML = ''; // 清空之前的内容
        articleElement.appendChild(ul);

        // 将修改后的DOM序列化并写入新的index.html文件
        fs.writeFileSync(outputIndexFilePath, dom.serialize(), 'utf-8');
    } catch (error) {
        console.error('Error generating index.html:', error);
    }
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
    const assetsDirectory = path.join(__dirname, '../posts/static');

    chokidar.watch(assetsDirectory, { ignoreInitial: true })
        .on('all', (event, path) => {
        console.log(`Detected ${event} on ${path}. Rebuilding...`);
        build();
    });


    console.log(`Watching for changes in ${assetsDirectory}`);
}

// 运行构建过程并开始监视
build();
if (isDebug){
    watch();
}
