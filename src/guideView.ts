import { ItemView, WorkspaceLeaf, MarkdownRenderer, Component } from 'obsidian';

export const VIEW_TYPE_GUIDE = 'mp-guide';
export const VIEW_TYPE_CHANGELOG = 'mp-changelog';

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
            const filePath = this.pluginDir + '/' + this.config.fileName;
            const content = await this.app.vault.adapter.read(filePath);
            await MarkdownRenderer.render(this.app, content, container as HTMLElement, '', new Component());
        } catch {
            container.createEl('p', { text: '无法加载文件', cls: 'mp-guide-error' });
        }
    }
}
