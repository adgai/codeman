# codeman.im

一个将 Markdown 构建为静态 HTML 的个人站点。

```sh
npm install
npm run build
```

构建结果在 `disk/`，部署时将它作为静态站点的输出目录。开发时可以运行 `npm run build-debug`，它会监听内容、模板和站点配置的变化。

## 添加内容

- 将文章放在 `posts/`。它会生成同名 HTML，并按日期倒序出现在首页的文章列表中。
- 将固定页面放在 `pages/`。它也会生成同名 HTML，但不会进入文章列表。要将页面加入顶部导航，在 `pages/home.md` 的导航列表中添加 Markdown 链接。
- 首页内容写在纯 Markdown 的 `pages/home.md`：开头的链接文字是站点品牌，一级标题是首页标题，标题后的第一段是副标题；第一个二级标题下的列表是全站导航，第二个二级标题是文章列表标题。它不会单独生成 `home.html`，最近文章仍从 `posts/` 自动生成。
- 导航链接使用生成后的文件名，例如 `tools.md` 对应 `tools.html`。移动 Markdown 源文件不会改变页面 URL。
- 页面和文章共用 `posts/static/article.html`；首页使用根目录的 `index.html`。构建器从 `pages/home.md` 读取导航并应用到所有页面。

Markdown 文件使用 front matter 设置 `title`、`date`、`author` 和 `location`。可选的 `draft: true` 会跳过构建；`layout: directory` 为表格目录启用额外样式；`endLabel` 可自定义页尾文字。图片放在 `posts/assets/` 或 `pages/assets/`，并在 Markdown 中使用 `./assets/文件名` 引用。
