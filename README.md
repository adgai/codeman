# codeman.im

一个将 Markdown 构建为静态 HTML 的个人站点。

```sh
npm install
npm run build
```

构建结果在 `disk/`，部署时将它作为静态站点的输出目录。开发时可以运行 `npm run build-debug`，它会监听内容、模板和站点配置的变化。

## 添加内容

- 首页正文写在 `pages/home.md`。它最后的二级标题下会自动列出 `pages/` 中的内容文件夹和独立 Markdown 文件。
- 直接放在 `pages/` 下的 Markdown 文件会作为文件链接出现在首页，点击后打开正文；`home.md` 只用于生成首页，不会出现在列表中。
- 文件夹里直接放 Markdown 文件，不需要 `_index.md`。点开文件夹会列出其中的文件，再点文件查看正文；草稿文件（`draft: true`）不会显示。
- 例如文章放在 `pages/posts/`，项目内容放在 `pages/projects/`。有 Markdown 文件的新增文件夹会自动出现在首页，目录地址是 `文件夹名/`。已知文件夹的中文名称和顺序在 `site.config.js` 中设置。
- 可以在 `site.config.js` 的 `homeOrder` 中指定首页条目顺序，例如 `['aboutme.md', 'posts', 'tools']`。文件夹写目录名，单独文件写完整 `.md` 文件名；两者可以交错排列。未列出的条目仍按默认顺序排在后面，留空则完全使用默认顺序（先按配置排列文件夹，再按文件名排列单独文件）。
- 单篇 Markdown 仍生成根目录下的同名 HTML，保留现有文章链接。例如 `pages/myproject.md` 仍生成 `myproject.html`。
- 页面共用 `pages/posts/static/article.html`；首页和文件夹页使用根目录的 `index.html`。`site.config.js` 保留站点品牌配置。

单篇 Markdown 使用 front matter 设置 `title`、`date`、`author` 和 `location`。可选的 `draft: true` 会跳过构建；`layout: directory` 为表格目录启用额外样式；`endLabel` 可自定义页尾文字。图片放在内容目录的 `assets/` 中，并在 Markdown 中使用 `assets/文件名` 引用；构建时会复制到输出目录的 `assets/`。

## 页面渲染方式

`site.config.js` 的 `defaultLayout` 设置默认方式，`folders[].layout` 设置文件夹内文件的默认方式，`fileLayouts` 可以按相对 `pages/` 的文件路径单独指定。Markdown 的 front matter 也可以写 `layout`，优先级最高。例如：

```js
defaultLayout: 'article',
folders: [
  { name: 'posts', label: '文章' },
  { name: 'thoughts', label: '年少常有所感', layout: 'typewriter' },
],
fileLayouts: {
  'thoughts/AI前夜.md': 'article',
},
```

上例中 `thoughts` 下默认是打字机效果，但 `AI前夜.md` 使用普通文章样式。如果只想在该文件内指定，也可以在 front matter 写 `layout: article`。当前可选方式为 `article`（普通 Markdown）、`directory`（普通 Markdown 加表格目录样式）和 `typewriter`（按 Markdown 源文件逐行打字，空行保留为间隔）。方式的渲染器、页面 class 和脚本集中定义在 `site.config.js` 的 `layouts` 中；新增一种渲染器时才需要修改 `build/build.js`。修改配置或 Markdown 后运行 `npm run build`；开发时运行 `npm run build-debug` 可自动重建。
