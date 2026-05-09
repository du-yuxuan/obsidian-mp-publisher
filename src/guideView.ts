import { ItemView, WorkspaceLeaf, MarkdownRenderer, Component } from 'obsidian';

export const VIEW_TYPE_GUIDE = 'mp-guide';

export class GuideView extends ItemView {
    private pluginDir: string;

    constructor(leaf: WorkspaceLeaf, pluginDir: string) {
        super(leaf);
        this.pluginDir = pluginDir;
    }

    getViewType(): string {
        return VIEW_TYPE_GUIDE;
    }

    getDisplayText(): string {
        return 'MP Publisher 使用指南';
    }

    getIcon(): string {
        return 'book-open';
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('mp-guide-view');

        try {
            const guidePath = this.pluginDir + '/GUIDE.md';
            const content = await this.app.vault.adapter.read(guidePath);
            await MarkdownRenderer.render(this.app, content, container as HTMLElement, '', new Component());
        } catch {
            container.createEl('p', { text: '无法加载使用指南文件', cls: 'mp-guide-error' });
        }
    }
}
