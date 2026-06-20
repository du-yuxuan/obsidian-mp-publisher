/**
 * 伪元素渲染器
 *
 * 在 DOM 挂载时将 CSS ::before / ::after 伪元素转为真实 <span> 元素，
 * 解决微信公众号和 juice 内联引擎无法处理伪元素的问题。
 *
 * 核心原理：
 *   1. 解析主题 CSS，提取所有 ::before / ::after 规则
 *   2. 手动追踪 CSS 计数器（counter-reset / counter-increment）
 *   3. 按 DOM 顺序遍历匹配元素，计算计数器当前值
 *   4. 创建真实 <span> 并写入 inline style + textContent
 *   5. 从 CSS 字符串中移除所有 ::before / ::after 规则块
 *
 * 赤霞主题适配：
 *   h1::after           → <span class="h1-dot">       （金色圆点）
 *   h2::before          → <span class="h2-num">        （01/02… 序号）
 *   h3::after           → <span class="h3-dot">        （金色小圆点）
 *   blockquote::before  → <span class="bq-mark">       （大引号 “）
 *   .mp-callout::before → <span class="callout-mark">  （装饰符号 ※✦◆…）
 */

// ============================================================
// 类型
// ============================================================

interface PseudoRule {
    baseSelector: string;
    pseudoType: 'before' | 'after';
    properties: Record<string, string>;
}

interface CounterConfig {
    resets: Array<{ selector: string; name: string; value: number }>;
    increments: Array<{ selector: string; name: string; value: number }>;
}

// ============================================================
// CSS 解析
// ============================================================

function parsePseudoRules(css: string): PseudoRule[] {
    const rules: PseudoRule[] = [];
    const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const blocks = splitCSSBlocks(cssWithoutComments);

    for (const block of blocks) {
        const braceIndex = block.indexOf('{');
        if (braceIndex === -1) continue;

        const selectorPart = block.substring(0, braceIndex).trim();
        const bodyPart = block.substring(braceIndex + 1).trim();
        if (!selectorPart || !bodyPart) continue;

        const selectors = splitSelectors(selectorPart);

        for (const sel of selectors) {
            const trimmed = sel.trim();
            if (!trimmed) continue;

            let pseudoType: 'before' | 'after' | null = null;
            if (trimmed.includes('::before')) pseudoType = 'before';
            else if (trimmed.includes('::after')) pseudoType = 'after';
            if (!pseudoType) continue;

            const baseSelector = trimmed
                .replace(/::before/g, '')
                .replace(/::after/g, '')
                .trim();
            if (!baseSelector) continue;

            rules.push({ baseSelector, pseudoType, properties: parseProperties(bodyPart) });
        }
    }

    return rules;
}

function parseCounterConfig(css: string): CounterConfig {
    const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const blocks = splitCSSBlocks(cssWithoutComments);
    const resets: CounterConfig['resets'] = [];
    const increments: CounterConfig['increments'] = [];

    for (const block of blocks) {
        const braceIndex = block.indexOf('{');
        if (braceIndex === -1) continue;

        const selectorPart = block.substring(0, braceIndex).trim();
        const bodyPart = block.substring(braceIndex + 1).trim();
        if (!selectorPart || !bodyPart) continue;

        // 跳过伪元素块
        if (selectorPart.includes('::before') || selectorPart.includes('::after')) continue;

        const properties = parseProperties(bodyPart);

        // counter-reset: "counter-name <value>?"
        if (properties['counter-reset']) {
            const parts = properties['counter-reset'].trim().split(/\s+/);
            const name = parts[0];
            const value = parts.length > 1 ? parseInt(parts[1], 10) : 0;
            if (name && !isNaN(value)) {
                for (const sel of splitSelectors(selectorPart)) {
                    if (!sel.includes('::before') && !sel.includes('::after')) {
                        resets.push({ selector: sel.trim(), name, value });
                    }
                }
            }
        }

        // counter-increment: "counter-name <value>?"
        if (properties['counter-increment']) {
            const parts = properties['counter-increment'].trim().split(/\s+/);
            const name = parts[0];
            const value = parts.length > 1 ? parseInt(parts[1], 10) : 1;
            if (name && !isNaN(value)) {
                for (const sel of splitSelectors(selectorPart)) {
                    if (!sel.includes('::before') && !sel.includes('::after')) {
                        increments.push({ selector: sel.trim(), name, value });
                    }
                }
            }
        }
    }

    return { resets, increments };
}

// ============================================================
// CSS 工具函数
// ============================================================

function splitCSSBlocks(css: string): string[] {
    const blocks: string[] = [];
    let depth = 0;
    let current = '';

    for (const ch of css) {
        if (ch === '{') { depth++; current += ch; }
        else if (ch === '}') {
            depth--;
            current += ch;
            if (depth === 0) { blocks.push(current); current = ''; }
        } else { current += ch; }
    }
    if (current.trim()) blocks.push(current);
    return blocks;
}

function splitSelectors(selectorStr: string): string[] {
    const result: string[] = [];
    let depth = 0;
    let current = '';

    for (const ch of selectorStr) {
        if (ch === '(') { depth++; current += ch; }
        else if (ch === ')') { depth--; current += ch; }
        else if (ch === ',' && depth === 0) { result.push(current); current = ''; }
        else { current += ch; }
    }
    if (current.trim()) result.push(current);
    return result;
}

function parseProperties(body: string): Record<string, string> {
    const props: Record<string, string> = {};
    for (const decl of body.split(';')) {
        const colonIndex = decl.indexOf(':');
        if (colonIndex === -1) continue;
        const prop = decl.substring(0, colonIndex).trim();
        const value = decl.substring(colonIndex + 1).trim();
        if (prop && value) props[prop] = value;
    }
    return props;
}

// ============================================================
// 计数器计算
// ============================================================

function formatCounterValue(value: number, style: string): string {
    switch (style) {
        case 'decimal-leading-zero': return String(value).padStart(2, '0');
        case 'upper-roman': return toRoman(value).toUpperCase();
        case 'lower-roman': return toRoman(value).toLowerCase();
        case 'upper-alpha': case 'upper-latin': return numToAlpha(value).toUpperCase();
        case 'lower-alpha': case 'lower-latin': return numToAlpha(value).toLowerCase();
        default: return String(value);
    }
}

function toRoman(num: number): string {
    const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
    const syms = ['m', 'cm', 'd', 'cd', 'c', 'xc', 'l', 'xl', 'x', 'ix', 'v', 'iv', 'i'];
    let result = '';
    for (let i = 0; i < vals.length; i++) while (num >= vals[i]) { result += syms[i]; num -= vals[i]; }
    return result;
}

function numToAlpha(num: number): string {
    if (num <= 0) return '';
    let result = '';
    while (num > 0) { num--; result = String.fromCharCode(97 + (num % 26)) + result; num = Math.floor(num / 26); }
    return result;
}

function computeCounters(
    container: HTMLElement,
    config: CounterConfig,
): Map<Element, Map<string, number>> {
    const result = new Map<Element, Map<string, number>>();
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT);
    const counters = new Map<string, number>();

    let node: Node | null;
    while ((node = walker.nextNode())) {
        const el = node as HTMLElement;

        // counter-reset 先于 increment
        for (const reset of config.resets) {
            if (!matchesSelectorInContainer(el, reset.selector, container)) continue;
            counters.set(reset.name, reset.value);
        }

        for (const inc of config.increments) {
            if (!matchesSelectorInContainer(el, inc.selector, container)) continue;
            const newVal = (counters.get(inc.name) ?? 0) + inc.value;
            counters.set(inc.name, newVal);
            if (!result.has(el)) result.set(el, new Map());
            result.get(el)!.set(inc.name, newVal);
        }
    }

    return result;
}

function matchesSelectorInContainer(
    el: HTMLElement,
    selector: string,
    container: HTMLElement,
): boolean {
    try {
        return container.contains(el) && el.matches(selector);
    } catch { return false; }
}

// ============================================================
// 内容解析
// ============================================================

function resolveContent(
    cssContentValue: string,
    _el: HTMLElement,
    counterMap: Map<string, number> | undefined,
): string | null {
    if (!cssContentValue || cssContentValue === 'none' || cssContentValue === 'normal') {
        return null;
    }

    // 字符串字面量: "\201C" → "“"
    const stringMatch = cssContentValue.match(/^["'](.*)["']$/s);
    if (stringMatch) {
        const inner = stringMatch[1];
        if (!inner) return '';
        return inner.replace(/\\([0-9A-Fa-f]{4})\s?/g, (_, hex) =>
            String.fromCodePoint(parseInt(hex, 16))
        );
    }

    // counter() 表达式
    const cMatch = cssContentValue.match(/counter\(\s*([a-zA-Z_-]+)\s*(?:,\s*([a-zA-Z_-]+)\s*)?\)/);
    if (cMatch && counterMap) {
        const val = counterMap.get(cMatch[1]);
        if (val !== undefined) return formatCounterValue(val, cMatch[2] || 'decimal');
    }

    return null;
}

// ============================================================
// span 生成
// ============================================================

function generateSpanClass(
    tagName: string,
    pseudoType: 'before' | 'after',
    element: Element,
): string {
    const tag = tagName.toLowerCase();

    if (element.classList.contains('mp-callout') ||
        (element.className && String(element.className).includes('mp-callout-'))) {
        return 'callout-mark';
    }
    if (tag === 'blockquote') return 'bq-mark';
    if (pseudoType === 'before' && tag === 'h2') return 'h2-num';
    if (pseudoType === 'after' && tag === 'h1') return 'h1-dot';
    if (pseudoType === 'after' && tag === 'h3') return 'h3-dot';

    return `${tag}-${pseudoType}`;
}

function isVisualOnly(properties: Record<string, string>): boolean {
    const content = properties['content'];
    if (!content || content === '""' || content === "''" || content === 'none') {
        const visualProps = ['background', 'background-color', 'border', 'border-radius',
            'width', 'height', 'min-width', 'min-height'];
        return visualProps.some(p => p in properties);
    }
    return false;
}

function safeQuerySelectorAll(container: HTMLElement, selector: string): Element[] {
    try { return Array.from(container.querySelectorAll(selector)); }
    catch { return []; }
}

// ============================================================
// 核心渲染
// ============================================================

function renderPseudoForElement(
    el: Element,
    rule: PseudoRule,
    counterMap: Map<string, number> | undefined,
): void {
    const htmlEl = el as HTMLElement;
    const cssContent = rule.properties['content'] || '';
    let textContent: string | null = null;
    let isEmptyVisual = false;

    if (isVisualOnly(rule.properties)) {
        // 纯装饰性，填充 &nbsp; 防止 XMLSerializer 自闭合导致 DOM 错乱
        isEmptyVisual = true;
        textContent = ' ';
    } else if (cssContent.includes('counter(')) {
        // 计数器表达式 → 字符串拆分解析
        const parenStart = cssContent.indexOf('(');
        const parenEnd = cssContent.lastIndexOf(')');
        if (parenStart !== -1 && parenEnd !== -1) {
            const args = cssContent.substring(parenStart + 1, parenEnd).split(',').map(s => s.trim());
            const cName = args[0];
            const cStyle = args[1] || 'decimal';
            if (counterMap) {
                const cVal = counterMap.get(cName);
                if (cVal !== undefined) textContent = formatCounterValue(cVal, cStyle);
            }
        }
        if (!textContent) return;
    } else {
        // 普通字符串
        textContent = resolveContent(cssContent, htmlEl, counterMap);
        if (textContent === null) {
            try {
                const computed = getComputedStyle(htmlEl,
                    rule.pseudoType === 'before' ? '::before' : '::after');
                const compContent = computed.content;
                if (compContent && compContent !== 'none' && compContent !== 'normal') {
                    textContent = compContent.replace(/^["']|["']$/g, '');
                }
            } catch { /* ignore */ }
        }
        if (!textContent && textContent !== '') return;
    }

    // 创建 span
    const span = document.createElement('span');
    span.className = generateSpanClass(htmlEl.tagName, rule.pseudoType, el);

    // 将 CSS 属性写入 inline style
    for (const [prop, value] of Object.entries(rule.properties)) {
        if (prop === 'content' || prop.startsWith('counter-')) continue;
        try { span.style.setProperty(prop, value); } catch { /* skip */ }
    }

    // 写入文本内容
    // 纯装饰 span 用 innerHTML 设置 &nbsp;，防止 XMLSerializer 输出自闭合标签
    if (textContent) {
        if (isEmptyVisual) {
            span.innerHTML = '&nbsp;';
        } else {
            span.textContent = textContent;
        }
    }

    // 插入 DOM
    try {
        if (rule.pseudoType === 'before') {
            htmlEl.insertBefore(span, htmlEl.firstChild);
        } else {
            htmlEl.appendChild(span);
        }
    } catch { /* skip */ }
}

// ============================================================
// CSS 清理
// ============================================================

function removePseudoRulesFromCSS(css: string): string {
    const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const blocks = splitCSSBlocks(cssWithoutComments);

    const filtered = blocks.filter(block => {
        const braceIndex = block.indexOf('{');
        const selectorPart = braceIndex >= 0 ? block.substring(0, braceIndex) : block;
        return !selectorPart.includes('::before') && !selectorPart.includes('::after');
    });

    return filtered.join('');
}

// ============================================================
// 主入口
// ============================================================

export function prerenderPseudoElements(container: HTMLElement, css: string): string {
    if (!css || !container) return css;

    // 1. 解析伪元素规则
    const pseudoRules = parsePseudoRules(css);
    if (pseudoRules.length === 0) return css;

    // 2. 计算计数器
    const counterConfig = parseCounterConfig(css);
    const counterMap = computeCounters(container, counterConfig);

    // 3. 渲染为真实 span
    for (const rule of pseudoRules) {
        const elements = safeQuerySelectorAll(container, rule.baseSelector);
        for (const el of elements) {
            const elCounters = counterMap.get(el as HTMLElement);
            renderPseudoForElement(el, rule, elCounters);
        }
    }

    // 4. 移除伪元素规则
    return removePseudoRulesFromCSS(css);
}
