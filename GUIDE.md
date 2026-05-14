# MP Publisher 使用指南

写完 Markdown，想直接发到公众号？这个插件就是干这事的。

## 主要功能

### 预览和复制

打开一篇 Markdown 笔记，通过左侧边栏的发送图标（或命令面板搜索 `MP Publisher`）打开预览面板。右侧会实时显示公众号排版效果，点击「复制到公众号」，粘贴到微信编辑器就行。

<video src="https://github.com/user-attachments/assets/b62e82a0-9b3c-4406-8007-1bbb6b9b7bac"  controls></video>

### 主题切换

预览面板顶部的下拉菜单可以快速切换主题。内置了 8 个主题，也支持社区投稿和自定义主题。

想更精细地管理主题，在设置页点击「打开主题管理」，或者命令面板搜索「打开主题管理」。

<video src="https://github.com/user-attachments/assets/78e8df0e-ea0d-4902-bcb5-dd384e19fefe"  controls></video>


### 主题管理

在主题管理界面：
- **点击卡片**切换当前使用的主题
- **☑ 勾选框**控制该主题是否出现在预览界面的快速切换下拉列表中
- **👁 预览**在侧边栏预览主题效果
- **</> 代码**查看或编辑主题的 CSS 源码

### 自定义主题

两种方式：
1. 在主题管理界面底部新建主题，直接写 CSS
2. 把 `.css` 文件放到插件目录的 `custom/` 文件夹下，重启后自动加载

编写自定义主题前建议先看 [CSS 主题编写指南](./CSS_THEME_GUIDE.md)。

### 直接发布

如果配置了微信公众号的 AppID 和 AppSecret，可以直接从 Obsidian 发布草稿到公众号后台，不用手动复制粘贴。

配置步骤：
1. 登录[微信公众平台](https://mp.weixin.qq.com/) → 设置与开发 → 基本配置
2. 记录 AppID 和 AppSecret
3. 设置 IP 白名单：填入你当前的 IP 地址。家用宽带 IP 经常变？直接填 `0.0.0.0/0` 允许所有 IP，省去频繁更新的麻烦
4. 在插件设置中添加公众号，填入 AppID 和 AppSecret 即可

<video src="https://github.com/user-attachments/assets/24288345-b5c8-4613-956b-78b622317d95"  controls></video>

### 数学公式

支持 LaTeX 数学公式（`$...$` 行内，`$$...$$` 块级），发布时自动转为图片，微信公众号能正常显示。在设置里可以开关这个功能。
