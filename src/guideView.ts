import { ItemView, WorkspaceLeaf, MarkdownRenderer, Component, requestUrl } from 'obsidian';

export const VIEW_TYPE_GUIDE = 'mp-guide';
export const VIEW_TYPE_CHANGELOG = 'mp-changelog';

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/joeytoday/obsidian-mp-publisher/main';

interface DocViewConfig {
    viewType: string;
    displayText: string;
    icon: string;
    fileName: string;
}

const VIEW_CONFIGS: Record<string, Omit<DocViewConfig, 'viewType'>> = {
    [VIEW_TYPE_GUIDE]: {
        displayText: 'MP Publisher 使用指南',
        icon: 'book-open',
        fileName: 'GUIDE.md',
    },
    [VIEW_TYPE_CHANGELOG]: {
        displayText: 'MP Publisher 更新日志',
        icon: 'list-ordered',
        fileName: 'CHANGELOG.md',
    },
};

export class MarkdownDocView extends ItemView {
    private pluginDir: string;
    private viewTypeId: string;
    private config: Omit<DocViewConfig, 'viewType'>;

    constructor(leaf: WorkspaceLeaf, pluginDir: string, viewType: string) {
        super(leaf);
        this.pluginDir = pluginDir;
        this.viewTypeId = viewType;
        this.config = VIEW_CONFIGS[viewType] ?? VIEW_CONFIGS[VIEW_TYPE_GUIDE];
    }

    getViewType(): string {
        return this.viewTypeId;
    }

    getDisplayText(): string {
        return this.config.displayText;
    }

    getIcon(): string {
        return this.config.icon;
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('mp-guide-view');

        try {
            const content = await this.loadContent();
            const renderComponent = new Component();
            renderComponent.load();
            await MarkdownRenderer.render(this.app, content, container as HTMLElement, '', renderComponent);
        } catch {
            container.createEl('p', { text: '无法加载文件', cls: 'mp-guide-error' });
        }
    }

    private async loadContent(): Promise<string> {
        // 优先从本地插件目录读取
        try {
            const filePath = this.pluginDir + '/' + this.config.fileName;
            return await this.app.vault.adapter.read(filePath);
        } catch {
            // 本地不存在时从 GitHub 远程加载
        }

        const remoteUrl = `${GITHUB_RAW_BASE}/${this.config.fileName}`;
        const response = await requestUrl({ url: remoteUrl });
        return response.text;
    }
}
