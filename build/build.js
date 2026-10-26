
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
function normalizePostDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    const parts = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (!parts) throw new Error(`Invalid front matter date: ${value}`);
    const [, year, month, day, hour = '0', minute = '0', second = '0'] = parts;
    return new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute, +second));
}

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

function renderTypewriterContent(content) {
    const lines = content.trim().split(/\r?\n/);
    return `<div class="feeling" data-typewriter>${lines.map(line =>
        `<div class="feeling-line">${escapeHtml(line)}</div>`
    ).join('')}</div>`;
}

const contentRenderers = {
    markdown: (_content, renderedHtml) => renderedHtml,
    typewriter: renderTypewriterContent,
};

function resolvePageLayout(folder, file, data, siteConfig) {
    const sourceFile = path.relative(path.join(__dirname, '../pages'), path.join(folder.directory, file)).split(path.sep).join('/');
    const name = data.layout || siteConfig.fileLayouts?.[sourceFile] || folder.layout || siteConfig.defaultLayout || 'article';
    const layout = siteConfig.layouts?.[name];
    if (!layout) throw new Error(`Unknown layout "${name}" for ${sourceFile}`);
    if (!contentRenderers[layout.renderer]) throw new Error(`Unknown renderer "${layout.renderer}" for layout "${name}"`);
    return layout;
}

function renderBrand(template, siteConfig) {
    return template
        .replaceAll('<!-- SITE_BRAND -->', escapeHtml(siteConfig.brandName + siteConfig.brandSuffix))
        .replaceAll('<!-- BRAND_NAME -->', escapeHtml(siteConfig.brandName))
        .replaceAll('<!-- BRAND_SUFFIX -->', escapeHtml(siteConfig.brandSuffix));
}

function parseHomeMarkdown(markdown) {
    const document = new JSDOM(`<body>${marked.parse(markdown)}</body>`).window.document;
    if (document.body.firstElementChild?.tagName !== 'H1' || document.body.lastElementChild?.tagName !== 'H2') {
        throw new Error('pages/home.md needs a level-one title and a final level-two directory heading');
    }
    return document.body.innerHTML;
}

function collectFolders(pagesDirectory, siteConfig) {
    return fs.readdirSync(pagesDirectory, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => {
            const directory = path.join(pagesDirectory, entry.name);
            const files = fs.readdirSync(directory)
                .filter(file => file.endsWith('.md'))
                .filter(file => !matter(fs.readFileSync(path.join(directory, file), 'utf-8')).data.draft);
            if (!files.length) return null;
            const configuredIndex = siteConfig.folders.findIndex(folder => folder.name === entry.name);
            const configuredFolder = siteConfig.folders[configuredIndex];
            const label = configuredFolder?.label || entry.name;
            return {
                name: entry.name,
                directory,
                label,
                layout: configuredFolder?.layout,
                href: `${entry.name}/`,
                order: configuredIndex >= 0 ? configuredIndex : Number.MAX_SAFE_INTEGER,
                files,
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'zh-CN'));
}

function collectStandalonePages(pagesDirectory) {
    return fs.readdirSync(pagesDirectory, { withFileTypes: true })
        .filter(entry => entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'home.md')
        .map(entry => {
            const file = entry.name;
            const data = matter(fs.readFileSync(path.join(pagesDirectory, file), 'utf-8')).data;
            if (data.draft) return null;
            return { file, href: `${path.basename(file, '.md')}.html`, label: data.title || path.basename(file, '.md'), date: normalizePostDate(data.date) };
        })
        .filter(Boolean)
        .sort((a, b) => a.file.localeCompare(b.file, 'zh-CN'));
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
function convertMarkdownToHtml(folder, outputDirectory, articleEntries, siteConfig, articleCssVersion) {
    const directory = folder.directory;
    const files = folder.files;

    const options = {
        headerIds: true, // 启用 headerIds 选项
    };

    // 创建自定义 renderer
    const renderer = new marked.Renderer();

// 重写 image 方法，为 img 标签添加 class
    renderer.image = function(href, title, text) {
        const className = 'data-zoomable'; // 你想添加的 class
        let out = '<img class="' + className + '" src="' + href.href + '" alt="' +  href.text + '" loading="lazy" decoding="async"';
        const dimensions = getPngDimensions(path.resolve(directory, href.href)) ||
            getPngDimensions(path.resolve(__dirname, '../pages/posts', href.href));
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
            const date = normalizePostDate(data.date);
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
            const layout = resolvePageLayout(folder, file, data, siteConfig);
            const html = contentRenderers[layout.renderer](content, rendered.window.document.body.innerHTML);
            // 读取 static/article.html
            const templatePath = path.join(__dirname, '../pages/posts/static/article.html');
            const templateHtml = renderBrand(fs.readFileSync(templatePath, 'utf8'), siteConfig);
            const htmlFileName = basename + '.html';
            const backLabel = `返回${folder.label}`;

            const outputHtml = templateHtml.replace('<!-- CONTENT -->', html)
                .replace('./static/article.css', `./static/article.css?v=${articleCssVersion}`)
                .replaceAll('<!-- BACK_LABEL -->', escapeHtml(backLabel))
                .replaceAll('<!-- BACK_HREF -->', escapeHtml(folder.href))
                .replace('<!-- END_LABEL -->', escapeHtml(data.endLabel || '全文完'))
                .replace('<!-- AUTHOR -->', escapeHtml(data.author))
                .replaceAll('<!-- TITLE -->', escapeHtml(data.title))
                .replace('<!-- TIME -->', date ? formatPostDate(date, true) : '')
                .replace('<!-- LOCATION -->', escapeHtml(data.location))
                .replace('<body>', layout.bodyClass ? `<body class="${escapeHtml(layout.bodyClass)}">` : '<body>')
                .replace('</body>', layout.script ? `<script defer src="./${escapeHtml(layout.script)}"></script>\n</body>` : '</body>');

            const outputPath = path.join(outputDirectory, htmlFileName);
            if (fs.existsSync(outputPath)) throw new Error(`Duplicate output page: ${htmlFileName}`);
            fs.writeFileSync(outputPath, outputHtml, 'utf-8');
            articleEntries.push({ file: htmlFileName, title: data.title || basename, date });
        }
    });
}

function createArticleList(document, entries) {
    const list = document.createElement('div');
    list.className = 'article-list';
    const ul = document.createElement('ul');
    [...entries].sort((a, b) => (b.date || 0) - (a.date || 0)).forEach(({ file, title, date }) => {
        const li = document.createElement('li');
        const dateLabel = document.createElement('span');
        dateLabel.textContent = date ? formatPostDate(date) : '';
        const link = document.createElement('a');
        link.href = file;
        link.textContent = title;
        li.append(dateLabel, link);
        ul.appendChild(li);
    });
    list.appendChild(ul);
    return list;
}

function createDirectoryIcon(document, kind) {
    const icon = document.createElement('span');
    icon.className = `entry-icon entry-icon-${kind}`;
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = kind === 'folder'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 7.5V6.75a2 2 0 0 1 2-2h4.1l2 2.2h6.9a2 2 0 0 1 2 2v8.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7.5Z"/><path d="M3.5 9.25h17"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 2.75h7l4.25 4.25V19.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4.75a2 2 0 0 1 2-2Z"/><path d="M14 2.75V7h4.25M8.75 11.5h6.5M8.75 14.75h6.5"/></svg>';
    return icon;
}

function generateNewIndexHtml(indexTemplate, homeHtml, outputIndexFilePath, folders, standalonePages, siteConfig) {
    const dom = new JSDOM(renderBrand(indexTemplate, siteConfig));
    const document = dom.window.document;
    const homeContent = document.getElementById('home-content');
    homeContent.innerHTML = homeHtml;
    const homeTitle = homeContent.firstElementChild;
    homeTitle.id = 'home-title';
    const brand = siteConfig.brandName + siteConfig.brandSuffix;
    if (homeTitle.textContent.trim() === brand) {
        const name = document.createElement('span');
        name.textContent = siteConfig.brandName;
        const suffix = document.createElement('span');
        suffix.className = 'home-brand-suffix';
        suffix.textContent = siteConfig.brandSuffix;
        homeTitle.replaceChildren(name, suffix);
    }
    const directoryHeading = homeContent.lastElementChild;
    directoryHeading.id = 'directory-title';
    document.title = homeTitle.textContent.trim() === brand ? brand : `${brand} · ${homeTitle.textContent}`;

    const ul = document.createElement('ul');
    ul.className = 'folder-list';
    const homeRows = new Map();
    folders.forEach(folder => {
        const li = document.createElement('li');
        li.className = 'folder-row';
        const link = document.createElement('a');
        link.href = folder.href;
        const icon = createDirectoryIcon(document, 'folder');
        const label = document.createElement('span');
        label.className = 'folder-name';
        label.textContent = folder.label;
        const count = document.createElement('span');
        count.className = 'folder-count';
        count.textContent = folder.files.length ? `${folder.files.length} 个文件` : '';
        const arrow = document.createElement('span');
        arrow.className = 'folder-arrow';
        arrow.setAttribute('aria-hidden', 'true');
        arrow.textContent = '→';
        link.append(icon, label, count, arrow);
        li.appendChild(link);
        ul.appendChild(li);
        homeRows.set(folder.name, li);
    });
    standalonePages.forEach(page => {
        const li = document.createElement('li');
        li.className = 'file-row';
        const link = document.createElement('a');
        link.className = 'file-entry';
        link.href = page.href;
        const icon = createDirectoryIcon(document, 'file');
        const label = document.createElement('span');
        label.className = 'folder-name';
        label.textContent = page.label;
        const extension = document.createElement('span');
        extension.className = 'file-extension';
        extension.textContent = '.md';
        label.appendChild(extension);
        const date = document.createElement('span');
        date.className = 'folder-count';
        date.textContent = page.date ? formatPostDate(page.date) : '';
        const arrow = document.createElement('span');
        arrow.className = 'folder-arrow';
        arrow.setAttribute('aria-hidden', 'true');
        arrow.textContent = '→';
        link.append(icon, label, date, arrow);
        li.appendChild(link);
        ul.appendChild(li);
        homeRows.set(page.file, li);
    });
    const homeOrder = siteConfig.homeOrder ?? [];
    if (!Array.isArray(homeOrder)) throw new Error('site.config.js homeOrder must be an array');
    const orderedRows = [];
    const seen = new Set();
    homeOrder.forEach(key => {
        if (typeof key !== 'string') throw new Error('site.config.js homeOrder entries must be strings');
        if (seen.has(key)) throw new Error(`Duplicate homeOrder entry: ${key}`);
        seen.add(key);
        const row = homeRows.get(key);
        if (!row) {
            console.warn(`Home order entry not found: ${key}`);
            return;
        }
        orderedRows.push(row);
    });
    ul.prepend(...orderedRows);
    directoryHeading.after(ul);
    fs.writeFileSync(outputIndexFilePath, dom.serialize(), 'utf-8');
}

function generateFolderHtml(indexTemplate, folder, entries, outputDirectory, siteConfig) {
    const folderOutputDirectory = path.join(outputDirectory, folder.name);
    fs.ensureDirSync(folderOutputDirectory);
    const outputPath = path.join(folderOutputDirectory, 'index.html');
    if (fs.existsSync(outputPath)) throw new Error(`Duplicate output page: ${folder.href}`);
    const dom = new JSDOM(renderBrand(indexTemplate, siteConfig));
    const document = dom.window.document;
    document.body.classList.remove('home-page');
    const base = document.createElement('base');
    base.href = '../';
    document.head.prepend(base);
    document.title = `${folder.label} · ${siteConfig.brandName + siteConfig.brandSuffix}`;
    const main = document.querySelector('.page-shell');
    const breadcrumb = document.createElement('nav');
    breadcrumb.className = 'breadcrumb';
    breadcrumb.setAttribute('aria-label', '面包屑导航');
    const homeLink = document.createElement('a');
    homeLink.href = 'index.html';
    homeLink.textContent = '首页';
    const separator = document.createElement('span');
    separator.setAttribute('aria-hidden', 'true');
    separator.textContent = '/';
    const current = document.createElement('span');
    current.textContent = folder.label;
    breadcrumb.append(homeLink, separator, current);
    main.prepend(breadcrumb);
    const content = document.getElementById('home-content');
    content.classList.add('folder-content');
    const heading = document.createElement('h1');
    heading.textContent = folder.label;
    const summary = document.createElement('p');
    summary.className = 'folder-summary';
    summary.textContent = `${entries.length} 个文件`;
    content.append(heading, summary, createArticleList(document, entries));
    fs.writeFileSync(outputPath, dom.serialize(), 'utf-8');
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
    const pagesDirectory = path.join(__dirname, '../pages');
    const postsDirectory = path.join(pagesDirectory, 'posts');
    const diskDirectory = path.join(__dirname, '../disk');
    const originalIndexFilePath = path.join(__dirname, '../index.html');
    const homeMarkdownFilePath = path.join(pagesDirectory, 'home.md');
    const outputIndexFilePath = path.join(diskDirectory, 'index.html');
    const siteConfigPath = path.join(__dirname, '../site.config.js');
    delete require.cache[require.resolve(siteConfigPath)];
    const homeHtml = parseHomeMarkdown(fs.readFileSync(homeMarkdownFilePath, 'utf-8'));
    const siteConfig = require(siteConfigPath);
    const folders = collectFolders(pagesDirectory, siteConfig);
    const standalonePages = collectStandalonePages(pagesDirectory);
    const contentCss = fs.readFileSync(path.join(postsDirectory, 'static/content.css'));
    const contentCssVersion = crypto.createHash('sha1').update(contentCss).digest('hex').slice(0, 8);
    const indexTemplate = fs.readFileSync(originalIndexFilePath, 'utf-8')
        .replace('./static/content.css', `./static/content.css?v=${contentCssVersion}`);
    const articleCss = fs.readFileSync(path.join(postsDirectory, 'static/article.css'));
    const articleCssVersion = crypto.createHash('sha1').update(articleCss).digest('hex').slice(0, 8);

    // 清空输出目录
    clearOutputDirectory(diskDirectory);

    // 确保输出目录存在
    ensureDirectoryExistence(diskDirectory);

    folders.forEach(folder => {
        const entries = [];
        convertMarkdownToHtml(folder, diskDirectory, entries, siteConfig, articleCssVersion);
        generateFolderHtml(indexTemplate, folder, entries, diskDirectory, siteConfig);
    });
    convertMarkdownToHtml({
        directory: pagesDirectory,
        label: '首页',
        href: 'index.html',
        files: standalonePages.map(page => page.file),
    }, diskDirectory, [], siteConfig, articleCssVersion);
    generateNewIndexHtml(indexTemplate, homeHtml, outputIndexFilePath, folders, standalonePages, siteConfig);

    // 复制assets文件夹
    folders.forEach(folder => copyAssetsDirectory(folder.directory, diskDirectory, 'assets'));
    copyAssetsDirectory(pagesDirectory, diskDirectory,'assets');
    copyAssetsDirectory(postsDirectory, diskDirectory,'static');

    console.log('Folder and Markdown pages generated in disk directory.');
}

// 监视assets文件夹并在变更时重新构建
function watch() {
    const sources = [
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
