
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

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
}

function renderSiteNav(nav, currentFile) {
    return nav.map(({ label, href }) => {
        const current = href === currentFile ? ' class="is-current" aria-current="page"' : '';
        return `<a${current} href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
    }).join('\n            ');
}

function renderBrand(template, siteConfig) {
    return template
        .replaceAll('<!-- SITE_BRAND -->', escapeHtml(siteConfig.brandName + siteConfig.brandSuffix))
        .replaceAll('<!-- BRAND_NAME -->', escapeHtml(siteConfig.brandName))
        .replaceAll('<!-- BRAND_SUFFIX -->', escapeHtml(siteConfig.brandSuffix));
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

// 将文章或固定页面转换为根目录下的 HTML，保持现有 URL。
function convertMarkdownToHtml(directory, outputDirectory, articleEntries, contentType, siteConfig, articleCssVersion) {
    const files = fs.readdirSync(directory);

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
            if (contentType === 'page' && file === 'home.md') return;
            const markdown = fs.readFileSync(path.join(directory, file), 'utf-8');
            const { content, data } = matter(markdown); // 解析 Markdown 文件
            if (data.draft !== undefined && data.draft) {
                return
            }
            const basename = path.basename(file, '.md');
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
            const templateHtml = renderBrand(fs.readFileSync(templatePath, 'utf8'), siteConfig);
            const htmlFileName = basename + '.html';
            const backLabel = siteConfig.backLabels[contentType];

            const outputHtml = templateHtml.replace('<!-- CONTENT -->', html)
                .replace('<!-- SITE_NAV -->', renderSiteNav(siteConfig.nav, htmlFileName))
                .replace('./static/article.css', `./static/article.css?v=${articleCssVersion}`)
                .replaceAll('<!-- BACK_LABEL -->', escapeHtml(backLabel))
                .replace('<!-- END_LABEL -->', escapeHtml(data.endLabel || '全文完'))
                .replace('<!-- AUTHOR -->', escapeHtml(data.author))
                .replaceAll('<!-- TITLE -->', escapeHtml(data.title))
                .replace('<!-- TIME -->', formatPostDate(data.date, true))
                .replace('<!-- LOCATION -->', escapeHtml(data.location))
                .replace('<body>', data.layout === 'directory' ? '<body class="directory-page">' : '<body>');

            const outputPath = path.join(outputDirectory, htmlFileName);
            if (fs.existsSync(outputPath)) throw new Error(`Duplicate output page: ${htmlFileName}`);
            fs.writeFileSync(outputPath, outputHtml, 'utf-8');
            if (contentType === 'post') articleEntries.push({ file: htmlFileName, title: data.title, date: data.date });
        }
    });
}

// 在内存中生成新的index.html
function generateNewIndexHtml(originalIndexFilePath, homeContent, outputIndexFilePath, articleEntries, siteConfig) {
    // 读取原始的index.html文件内容
    const indexHtml = renderBrand(fs.readFileSync(originalIndexFilePath, 'utf-8'), siteConfig)
        .replace('<!-- SITE_NAV -->', renderSiteNav(siteConfig.nav, 'index.html'));
    const dom = new JSDOM(indexHtml);
    const document = dom.window.document;
    const hero = document.querySelector('.hero');
    hero.innerHTML = marked.parse(homeContent);
    const heroTitle = hero.querySelector('h1');
    if (!heroTitle) throw new Error('pages/home.md must contain a level-one heading');
    heroTitle.id = 'hero-title';
    const heroDescription = hero.querySelector('p');
    if (heroDescription) heroDescription.classList.add('hero-description');
    document.title = `${siteConfig.brandName + siteConfig.brandSuffix} · ${heroTitle.textContent}`;
    document.getElementById('posts-title').textContent = siteConfig.postsTitle;

    const sortedArticles = [...articleEntries].sort((a, b) => b.date - a.date);

    const ul = document.createElement('ul');

    // 生成排序后的HTML文件列表
    sortedArticles.forEach(({ file, title, date }) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = file;
        a.textContent = title;
        const dateLabel = document.createElement('span');
        dateLabel.textContent = formatPostDate(date);
        li.appendChild(dateLabel);
        li.appendChild(a);
        ul.appendChild(li);
    });

    // 将<ul>添加到<div id="article">中
    const articleElement = document.getElementById('article');
    articleElement.innerHTML = ''; // 清空之前的内容
    articleElement.appendChild(ul);

    // 将修改后的DOM序列化并写入新的index.html文件
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
    const pagesDirectory = path.join(__dirname, '../pages');
    const diskDirectory = path.join(__dirname, '../disk');
    const originalIndexFilePath = path.join(__dirname, '../index.html');
    const homeMarkdownFilePath = path.join(pagesDirectory, 'home.md');
    const outputIndexFilePath = path.join(diskDirectory, 'index.html');
    const siteConfigPath = path.join(__dirname, '../site.config.js');
    delete require.cache[require.resolve(siteConfigPath)];
    const home = matter(fs.readFileSync(homeMarkdownFilePath, 'utf-8'));
    if (typeof home.data.brandName !== 'string' || typeof home.data.brandSuffix !== 'string' ||
        !Array.isArray(home.data.nav) || !home.data.nav.length ||
        home.data.nav.some(item => !item || typeof item.label !== 'string' || typeof item.href !== 'string') ||
        typeof home.data.postsTitle !== 'string') {
        throw new Error('pages/home.md must define brandName, brandSuffix, nav links, and postsTitle in front matter');
    }
    const siteConfig = { ...require(siteConfigPath), ...home.data };
    const articleCss = fs.readFileSync(path.join(postsDirectory, 'static/article.css'));
    const articleCssVersion = crypto.createHash('sha1').update(articleCss).digest('hex').slice(0, 8);
    const articleEntries = [];

    // 清空输出目录
    clearOutputDirectory(diskDirectory);

    // 确保输出目录存在
    ensureDirectoryExistence(diskDirectory);

    // 两类内容共用模板，但首页文章列表只收录 posts/。
    convertMarkdownToHtml(postsDirectory, diskDirectory, articleEntries, 'post', siteConfig, articleCssVersion);
    convertMarkdownToHtml(pagesDirectory, diskDirectory, articleEntries, 'page', siteConfig, articleCssVersion);

    // 在内存中生成新的index.html并写入到disk目录
    generateNewIndexHtml(originalIndexFilePath, home.content, outputIndexFilePath, articleEntries, siteConfig);

    // 复制assets文件夹
    copyAssetsDirectory(postsDirectory, diskDirectory,'assets');
    copyAssetsDirectory(pagesDirectory, diskDirectory,'assets');
    copyAssetsDirectory(postsDirectory, diskDirectory,'static');

    console.log('Markdown files converted and new index.html generated in disk directory.');
}

// 监视assets文件夹并在变更时重新构建
function watch() {
    const sources = [
        path.join(__dirname, '../posts'),
        path.join(__dirname, '../pages'),
        path.join(__dirname, '../index.html'),
        path.join(__dirname, '../site.config.js'),
    ];
    chokidar.watch(sources, { ignoreInitial: true })
        .on('all', (event, changedPath) => {
        console.log(`Detected ${event} on ${changedPath}. Rebuilding...`);
        build();
    });

    console.log(`Watching for changes in ${sources.join(', ')}`);
}

// 运行构建过程并开始监视
build();
if (isDebug){
    watch();
}
