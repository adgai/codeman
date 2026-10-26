module.exports = {
    brandName: 'codeman',
    brandSuffix: '.im',
    homeOrder: [], // 例如 ['aboutme.md', 'posts', 'tools']；未列出的条目保持默认顺序
    defaultLayout: 'article',
    layouts: {
        article: { renderer: 'markdown' },
        directory: { renderer: 'markdown', bodyClass: 'directory-page' },
        typewriter: { renderer: 'typewriter', bodyClass: 'feeling-page', script: 'static/typewriter.js' },
    },
    folders: [
        { name: 'posts', label: '文章' },
        { name: 'thoughts', label: '年少常有所感', layout: 'typewriter' },
        { name: 'projects', label: '项目' },
        { name: 'tools', label: '工具' },
        { name: 'about', label: '关于我' },
    ],
    fileLayouts: {},
};
