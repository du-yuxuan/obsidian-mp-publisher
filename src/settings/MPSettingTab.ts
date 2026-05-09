import { App, PluginSettingTab, Setting, Notice, TFile } from 'obsidian';
import MPPlugin from '../main';

export class MPSettingTab extends PluginSettingTab {
    plugin: MPPlugin;

    constructor(app: App, plugin: MPPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.addClass('mp-settings');

        containerEl.createEl('h2', { text: 'MP Publisher 设置' });

        // 使用指南入口
        new Setting(containerEl)
            .setName('使用指南')
            .setDesc('查看插件的功能介绍和使用说明')
            .addButton(btn => btn
                .setButtonText('使用指南')
                .onClick(async () => {
                    const guidePath = this.plugin.manifest.dir + '/GUIDE.md';
                    const file = this.app.vault.getAbstractFileByPath(guidePath);
                    if (file instanceof TFile) {
                        await this.app.workspace.getLeaf(true).openFile(file);
                    } else {
                        new Notice('未找到使用指南文件');
                    }
                }));

        // 主题管理入口
        new Setting(containerEl)
            .setName('主题管理')
            .setDesc('管理内置主题、云端主题和本地自定义 CSS 主题')
            .addButton(btn => btn
                .setButtonText('打开主题管理')
                .setCta()
                .onClick(() => {
                    // 通过插件方法打开主题管理界面
                    this.plugin.activateThemeManager();
                }));

        // 微信公众号配置
        containerEl.createEl('h3', { text: '微信公众号配置' });

        // AppID 设置
        new Setting(containerEl)
            .setName('AppID')
            .setDesc('微信公众号的 AppID')
            .addText(text => text
                .setPlaceholder('输入 AppID')
                .setValue(this.plugin.settingsManager.getSettings().wechatAppId || '')
                .onChange(async (value) => {
                    await this.plugin.settingsManager.updateSettings({
                        wechatAppId: value,
                    });
                }));

        // AppSecret 设置
        new Setting(containerEl)
            .setName('AppSecret')
            .setDesc('微信公众号的 AppSecret')
            .addText(text => text
                .setPlaceholder('输入 AppSecret')
                .setValue(this.plugin.settingsManager.getSettings().wechatAppSecret || '')
                .onChange(async (value) => {
                    await this.plugin.settingsManager.updateSettings({
                        wechatAppSecret: value,
                    });
                }));

        // 调试模式
        new Setting(containerEl)
            .setName('调试模式')
            .setDesc('启用后将显示详细的调试日志信息')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settingsManager.getSettings().debugMode)
                .onChange(async (value) => {
                    await this.plugin.settingsManager.updateSettings({
                        debugMode: value,
                    });
                    this.plugin.logger.setDebugMode(value);
                }));

        // 数学公式配置
        containerEl.createEl('h3', { text: '数学公式配置' });

        // 转换数学公式为 SVG
        new Setting(containerEl)
            .setName('转换数学公式为 SVG')
            .setDesc('启用后将把 LaTeX 数学公式转换为 SVG 格式，确保在微信公众号中正确显示。支持 $...$（行内公式）和 $$...$$（块级公式）语法')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settingsManager.getSettings().convertMathToSVG)
                .onChange(async (value) => {
                    await this.plugin.settingsManager.updateSettings({
                        convertMathToSVG: value,
                    });
                }));
    }
}