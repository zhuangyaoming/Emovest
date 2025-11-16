(function () {
    let emotionChart;
    let lastEmotionData = null;
    let lastNewsList = [];

    let marketSentimentData = null; // 保存市场情绪分析初始化数据
    const MARKET_WORKFLOW_TIMEOUT = 110 * 1000; // 统一把工作流超时阈值提升到 180 秒

    async function loadMarket(container) {
        const grid = container.querySelector("#marketGrid");
        grid.innerHTML = window.ComponentKit.skeleton(4);
        try {
            // 直接使用统一加载的市场情绪分析初始化数据（已在render中统一调用）
            if (!marketSentimentData) {
                grid.innerHTML = window.ComponentKit.errorState("数据加载中，请稍候...");
                return;
            }

            const indexData = marketSentimentData?.index;
            if (indexData && Array.isArray(indexData)) {
                // 使用 changeRatio 或 point 字段
                grid.innerHTML = indexData.map((item) => {
                    // 优先使用 changeRatio（已经是百分比），否则使用 point
                    let changePercent = 0;
                    if (item.changeRatio !== undefined) {
                        changePercent = (parseFloat(item.changeRatio) * 100).toFixed(2);
                    } else if (item.point !== undefined) {
                        // point 范围是 -5 到 +5，转换为百分比
                        changePercent = (parseFloat(item.point) / 5 * 100).toFixed(2);
                    }
                    const value = item.currentPrice !== undefined
                        ? parseFloat(item.currentPrice).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : changePercent + "%";
                    return window.ComponentKit.metricCard({
                        label: item.industryName || item.name,
                        value: value,
                        delta: parseFloat(changePercent)
                    });
                }).join("");
            } else {
                grid.innerHTML = window.ComponentKit.errorState("指数数据格式错误，请稍后重试。");
            }
        } catch (error) {
            grid.innerHTML = window.ComponentKit.errorState("指数数据加载失败，请稍后重试。");
        }
    }

    async function loadEmotion(container) {
        const card = container.querySelector("#emotionCard");
        const chartBox = container.querySelector("#emotionChart");
        // 初始化图层结构，避免清空后丢失中心分数字样（若任一缺失则重建）
        if (!chartBox.querySelector("#emotionCanvas") || !chartBox.querySelector("#emotionScore")) {
            chartBox.innerHTML = `
                <div id="emotionCanvas" style="width:100%;height:100%;"></div>
                <div id="emotionScore" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none;"></div>
            `;
        }
        const canvas = chartBox.querySelector("#emotionCanvas");
        const scoreBox = chartBox.querySelector("#emotionScore");
        canvas.innerHTML = window.ComponentKit.skeleton(3);
        scoreBox.textContent = "";
        try {
            // 直接使用统一加载的市场情绪分析初始化数据（已在render中统一调用）
            if (!marketSentimentData) {
                canvas.innerHTML = window.ComponentKit.errorState("数据加载中，请稍候...");
                return;
            }

            // 处理 positive/neutral/negative 可能是小数（0.55）或整数（55）的情况
            let positive = marketSentimentData?.positive || 0;
            let neutral = marketSentimentData?.neutral || 0;
            let negative = marketSentimentData?.negative || 0;

            // 如果是小数（0-1 范围），转换为百分比
            if (positive <= 1 && positive > 0) {
                positive = Math.round(positive * 100);
            }
            if (neutral <= 1 && neutral > 0) {
                neutral = Math.round(neutral * 100);
            }
            if (negative <= 1 && negative > 0) {
                negative = Math.round(negative * 100);
            }

            const data = {
                total_score: marketSentimentData?.total_score || 50,
                positive: positive,
                neutral: neutral,
                negative: negative,
                detail_analysis: marketSentimentData?.detail_analysis || ""
            };

            lastEmotionData = data;
            canvas.innerHTML = "";
            if (emotionChart) emotionChart.dispose();
            emotionChart = window.ChartKit.renderEmotionDonut(canvas, {
                positive: data.positive,
                neutral: data.neutral,
                negative: data.negative
            });
            container.querySelector("#legendPositive").textContent = `积极 ${data.positive}%`;
            container.querySelector("#legendNeutral").textContent = `中性 ${data.neutral}%`;
            container.querySelector("#legendNegative").textContent = `消极 ${data.negative}%`;
            scoreBox.innerHTML = `<div style="text-align:center;">
                <div style="font-size:28px;font-weight:700;color:#7fa8ff;">${data.total_score}</div>
                <div style="font-size:12px;color:#9bb2e8;">总分 / 100</div>
            </div>`;
            const meta = card.querySelector(".card-meta");
            if (meta) meta.textContent = "";
        } catch (error) {
            canvas.innerHTML = window.ComponentKit.errorState("情绪数据加载失败。");
        }
    }

    function openEmotionDetailModal(data) {
        const exist = document.getElementById("emotionDetailModal");
        if (exist) exist.remove();
        const overlay = document.createElement("div");
        overlay.id = "emotionDetailModal";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.style.position = "fixed";
        overlay.style.left = "0";
        overlay.style.top = "0";
        overlay.style.right = "0";
        overlay.style.bottom = "0";
        overlay.style.background = "rgba(9,16,35,0.45)";
        overlay.style.backdropFilter = "blur(6px)";
        overlay.style.display = "flex";
        overlay.style.alignItems = "center";
        overlay.style.justifyContent = "center";
        overlay.style.zIndex = "1000";

        const panel = document.createElement("div");
        panel.className = "emotion-detail-panel";
        panel.style.position = "relative";
        panel.style.width = "min(340px, 88vw)";
        panel.style.maxWidth = "calc(100vw - 32px)";
        panel.style.maxHeight = "70vh";
        panel.style.overflow = "auto";
        panel.style.background = "#ffffff";
        panel.style.border = "1px solid rgba(16,26,51,0.08)";
        panel.style.borderRadius = "16px";
        panel.style.boxShadow = "0 18px 46px rgba(15,27,55,0.14)";
        panel.style.padding = "20px 18px";
        panel.style.margin = "16px 16px";
        panel.style.color = "#21304f";

        const closeBtn = document.createElement("button");
        closeBtn.textContent = "✕";
        closeBtn.setAttribute("aria-label", "关闭");
        closeBtn.style.position = "absolute";
        closeBtn.style.right = "16px";
        closeBtn.style.top = "12px";
        closeBtn.style.background = "transparent";
        closeBtn.style.border = "none";
        closeBtn.style.color = "#6c7a96";
        closeBtn.style.fontSize = "18px";
        closeBtn.style.cursor = "pointer";

        const title = document.createElement("h3");
        title.textContent = "情绪评分说明";
        title.style.margin = "0 0 8px 0";
        title.style.fontSize = "20px";
        title.style.color = "#3b63ff";
        title.style.fontWeight = "700";

        const sub = document.createElement("p");
        sub.textContent = "以下为影响今日市场情绪各分量的主要事件及理由：";
        sub.style.margin = "0 0 16px";
        sub.style.color = "#5a6b8e";
        sub.style.fontSize = "14px";

        // 使用 detail_analysis 字段，如果没有则使用默认内容
        const detailAnalysis = data.detail_analysis || "";
        const content = document.createElement("div");
        content.className = "markdown-content";
        if (detailAnalysis) {
            // 如果有 detail_analysis，使用 marked.js 渲染 markdown
            try {
                // 检查 marked.js 是否已加载
                if (typeof marked === 'undefined') {
                    throw new Error('marked.js 未加载');
                }
                
                // 使用 marked.js 将 Markdown 转换为 HTML
                const htmlContent = marked.parse(detailAnalysis);
                content.innerHTML = htmlContent;
                
                // 在 HTML 渲染完成后，调用 highlight.js 来高亮所有代码块，并处理标题颜色
                setTimeout(() => {
                    if (typeof hljs !== 'undefined') {
                        content.querySelectorAll('pre code').forEach((block) => {
                            hljs.highlightElement(block);
                        });
                    }
                    
                    // 确保标题颜色已通过 CSS 应用（CSS 选择器已设置）
                    // 如果 markdown 渲染的标题没有应用颜色，这里可以手动设置
                    const h1Elements = content.querySelectorAll('h1');
                    h1Elements.forEach(h1 => {
                        if (!h1.style.color) h1.style.color = '#3b63ff';
                    });
                    
                    const h2Elements = content.querySelectorAll('h2');
                    h2Elements.forEach(h2 => {
                        if (!h2.style.color) h2.style.color = '#9d4edd';
                    });
                    
                    const h3Elements = content.querySelectorAll('h3');
                    h3Elements.forEach(h3 => {
                        if (!h3.style.color) h3.style.color = '#ff6b35';
                    });
                    
                    const h4Elements = content.querySelectorAll('h4');
                    h4Elements.forEach(h4 => {
                        if (!h4.style.color) h4.style.color = '#15a07a';
                    });
                }, 0);
            } catch (error) {
                console.error('Markdown 渲染失败:', error);
                // 如果渲染失败，回退到纯文本显示
                content.innerHTML = `<div style="color:#4d5f82;font-size:13px;line-height:1.7;white-space:pre-wrap;">${detailAnalysis}</div>`;
            }
        } else {
            // 否则使用默认的详细分析
            content.innerHTML = `
                <div style="margin-bottom:20px;">
                    <div style="font-weight:700;color:#64f0b7;margin-bottom:8px;font-size:15px;">正向情绪（${data.positive}%）</div>
                    <div style="color:#4d5f82;font-size:13px;line-height:1.7;">
                        <div style="margin-bottom:6px;"><strong style="color:#3b63ff;">主要事件：</strong></div>
                        <ul style="margin:0 0 8px 1.2em;padding:0;list-style:disc;">
                            <li>北向资金连续净流入，科技与消费板块资金面改善</li>
                            <li>AI应用场景持续拓展，算力基础设施需求增长</li>
                            <li>可选消费需求逐步释放，必选消费稳健托底</li>
                            <li>机构调研活跃度提升，市场风险偏好稳步回升</li>
                        </ul>
                        <div><strong style="color:#3b63ff;">理由：</strong>科技与消费双主线协同发力，为市场注入充足动能，推动整体情绪维持偏暖态势。</div>
                    </div>
                </div>
                <div style="margin-bottom:20px;">
                    <div style="font-weight:700;color:#ffc76a;margin-bottom:8px;font-size:15px;">中性情绪（${data.neutral}%）</div>
                    <div style="color:#4d5f82;font-size:13px;line-height:1.7;">
                        <div style="margin-bottom:6px;"><strong style="color:#3b63ff;">主要事件：</strong></div>
                        <ul style="margin:0 0 8px 1.2em;padding:0;list-style:disc;">
                            <li>市场信息噪声较多，部分政策落地节奏待观察</li>
                            <li>行业轮动加快，资金流向未形成明确主线</li>
                            <li>部分板块处于估值修复阶段，方向性信号不明确</li>
                            <li>外部环境变化带来不确定性，市场观望情绪增加</li>
                        </ul>
                        <div><strong style="color:#3b63ff;">理由：</strong>市场处于结构性调整期，多空力量相对均衡，未定向信号占比较高。</div>
                    </div>
                </div>
                <div style="margin-bottom:8px;">
                    <div style="font-weight:700;color:#ff8cab;margin-bottom:8px;font-size:15px;">负向情绪（${data.negative}%）</div>
                    <div style="color:#4d5f82;font-size:13px;line-height:1.7;">
                        <div style="margin-bottom:6px;"><strong style="color:#3b63ff;">主要事件：</strong></div>
                        <ul style="margin:0 0 8px 1.2em;padding:0;list-style:disc;">
                            <li>储能板块受上游原材料价格短期震荡影响</li>
                            <li>半导体产业链面临全球供应链博弈加剧</li>
                            <li>部分细分领域产能周期切换带来业绩不确定性</li>
                            <li>短期市场波动传导至指数，出现阶段性震荡整理</li>
                        </ul>
                        <div><strong style="color:#3b63ff;">理由：</strong>储能与半导体链条的阶段性波动对市场情绪产生一定压制，但未改变长期向好趋势。</div>
                    </div>
                </div>
            `;
        }

        panel.appendChild(closeBtn);
        panel.appendChild(title);
        panel.appendChild(sub);
        panel.appendChild(content);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        function close() { overlay.remove(); }
        closeBtn.addEventListener("click", close);
        overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
        document.addEventListener("keydown", function onKey(e) {
            if (e.key === "Escape") { close(); document.removeEventListener("keydown", onKey); }
        });
    }

    async function loadNews(container) {
        const list = container.querySelector("#newsList");
        list.innerHTML = window.ComponentKit.skeleton(3);
        try {
            // 直接使用统一加载的市场情绪分析初始化数据（已在render中统一调用）
            if (!marketSentimentData) {
                list.innerHTML = window.ComponentKit.errorState("数据加载中，请稍候...");
                return;
            }

            // 使用 news_lists 字段（实际返回的字段名）
            const newsLists = marketSentimentData?.news_lists || marketSentimentData?.news_reports;
            if (newsLists && Array.isArray(newsLists)) {
                // 转换数据格式：news_lists 中每个元素是 { 事件标题, 事件概括, ... }
                const newsList = newsLists.map(item => {
                    return {
                        title: item["事件标题"] || item.title || "",
                        summary: item["事件概括"] || item.summary || "",
                        event: item["相关板块"]?.[0] || item.label || "市场动态"
                    };
                });
                lastNewsList = newsList;
                list.innerHTML = window.ComponentKit.newsList(newsList);
                
                // 绑定标题点击事件
                list.querySelectorAll('.news-title-clickable').forEach(titleEl => {
                    titleEl.addEventListener('click', function() {
                        const targetId = this.getAttribute('data-target');
                        const contentEl = document.getElementById(`${targetId}-content`);
                        
                        if (contentEl) {
                            if (contentEl.style.display === 'none') {
                                // 展开
                                contentEl.style.display = 'block';
                            } else {
                                // 收起
                                contentEl.style.display = 'none';
                            }
                        }
                    });
                });
            } else {
                lastNewsList = [];
                list.innerHTML = window.ComponentKit.errorState("热点新闻数据格式错误，请稍后重试。");
            }
        } catch (error) {
            lastNewsList = [];
            list.innerHTML = window.ComponentKit.errorState("热点新闻加载失败。");
        }
    }

    async function generateStrategySummary(container) {
        const summaryBox = container.querySelector("#strategySummary");
        if (!summaryBox) return;
        summaryBox.innerHTML = window.ComponentKit.skeleton(4);
        try {
            // 直接使用统一加载的市场情绪分析初始化数据（已在render中统一调用）
            if (!marketSentimentData) {
                summaryBox.innerHTML = window.ComponentKit.errorState("数据加载中，请稍候...");
                return;
            }

            // 使用 analysis 字段作为投资机会提示
            const analysis = marketSentimentData?.analysis || "";

            // 使用 news_lists 作为热点摘要
            const newsLists = marketSentimentData?.news_lists || marketSentimentData?.news_reports || [];
            const newsHighlights = newsLists.slice(0, 3).map(item => {
                // 处理两种数据格式
                if (item["事件标题"]) {
                    return {
                        title: item["事件标题"] || "",
                        summary: item["事件概括"] || ""
                    };
                } else {
                    const news = item.news || item;
                    return {
                        title: news.title || "",
                        summary: news.summary || ""
                    };
                }
            });

            summaryBox.innerHTML = `
                <div class="card strategy-card">
                    <div class="card-head" style="align-items:flex-start;">
                        <div>
                            <h3 class="card-title" style="margin-bottom:6px;color:#3b63ff;font-weight:700;">今日速览</h3>
                            <p class="card-meta"></p>
                        </div>
                    </div>
                    <div class="strategy-section" style="margin-top:18px;">
                        <div class="strategy-desc markdown-content" style="margin:0 0 12px;font-size:13px;line-height:1.6;">${analysis ? (() => {
                            try {
                                if (typeof marked !== 'undefined') {
                                    return marked.parse(analysis);
                                }
                            } catch (e) {
                                console.error('Markdown 渲染失败:', e);
                            }
                            return analysis.replace(/\n/g, '<br>');
                        })() : "AI 正在汇总市场情绪，请稍后再试获取完整解读。"}</div>
                    </div>
                </div>
            `;
            
            // 渲染完成后，处理代码高亮和情绪得分颜色
            setTimeout(() => {
                if (typeof hljs !== 'undefined') {
                    summaryBox.querySelectorAll('pre code').forEach((block) => {
                        hljs.highlightElement(block);
                    });
                }
                
                // 处理整体市场情绪打分的颜色
                const markdownContent = summaryBox.querySelector('.markdown-content');
                if (markdownContent) {
                    // 使用正则表达式匹配并替换文本
                    const processTextNode = (textNode) => {
                        const text = textNode.textContent;
                        const parent = textNode.parentElement;
                        
                        // 如果父元素已经是 span，跳过
                        if (parent.tagName === 'SPAN' && parent.style.color) {
                            return;
                        }
                        
                        let newHTML = text;
                        
                        // 处理整体得分（蓝色）
                        newHTML = newHTML.replace(/(整体得分[：:]\s*\d+)/g, '<span style="color:#3b63ff;">$1</span>');
                        newHTML = newHTML.replace(/(整体得分\s*\d+)/g, '<span style="color:#3b63ff;">$1</span>');
                        
                        // 处理积极（红色）
                        newHTML = newHTML.replace(/(积极[：:]\s*\d+)/g, '<span style="color:#fc3640;">$1</span>');
                        newHTML = newHTML.replace(/(积极\s+\d+)/g, '<span style="color:#fc3640;">$1</span>');
                        
                        // 处理消极（绿色）
                        newHTML = newHTML.replace(/(消极[：:]\s*\d+)/g, '<span style="color:#00bb5b;">$1</span>');
                        newHTML = newHTML.replace(/(消极\s+\d+)/g, '<span style="color:#00bb5b;">$1</span>');
                        
                        // 处理中性（灰色）
                        newHTML = newHTML.replace(/(中性[：:]\s*\d+)/g, '<span style="color:#72758e;">$1</span>');
                        newHTML = newHTML.replace(/(中性\s+\d+)/g, '<span style="color:#72758e;">$1</span>');
                        
                        if (newHTML !== text) {
                            const tempDiv = document.createElement('div');
                            tempDiv.innerHTML = newHTML;
                            while (tempDiv.firstChild) {
                                parent.insertBefore(tempDiv.firstChild, textNode);
                            }
                            parent.removeChild(textNode);
                        }
                    };
                    
                    // 遍历所有文本节点
                    const walker = document.createTreeWalker(
                        markdownContent,
                        NodeFilter.SHOW_TEXT,
                        null,
                        false
                    );
                    
                    const textNodes = [];
                    let node;
                    while (node = walker.nextNode()) {
                        if (node.textContent.trim()) {
                            textNodes.push(node);
                        }
                    }
                    
                    textNodes.forEach(processTextNode);
                }
            }, 0);
        } catch (error) {
            summaryBox.innerHTML = window.ComponentKit.errorState("策略简报生成失败，请稍后重试。");
        }
    }

    async function render(container) {
        container.innerHTML = `
            <article class="card card--hero">
                <div class="card-head">
                    <div>
                        <span class="badge badge--glow">实时市场</span>
                        <h2 class="card-title">全球指数速览</h2>
                    </div>
                   <div class="hero-spark" style="display: flex; align-items: center; white-space: nowrap;">
                        <span class="spark-dot"></span>
                        <span>AI 实时监控</span>
                    </div>
                </div>
                <div class="stat-grid" id="marketGrid">${window.ComponentKit.skeleton(4)}</div>
            </article>

            <article class="card" id="emotionCard">
                <div class="card-head">
                    <div>
                        <h3 class="card-title">今日市场情绪 EmoMeter</h3>
                        <p class="card-meta"></p>
                    </div>
                    <div class="legend">
                        <span class="legend-item"><span class="legend-dot legend-dot--positive"></span><span id="legendPositive" style="color:#fc3640;">积极 --%</span></span>
                        <span class="legend-item"><span class="legend-dot legend-dot--neutral"></span><span id="legendNeutral" style="color:#72758e;">中性 --%</span></span>
                        <span class="legend-item"><span class="legend-dot legend-dot--negative"></span><span id="legendNegative" style="color:#00bb5b;">消极 --%</span></span>
                        <button class="btn-ghost" id="btnEmotionDetail" type="button" style="margin-left:8px;">查看详细分析</button>
                    </div>

                </div>
                <div class="chart-box" id="emotionChart" style="position:relative;">
                    <div id="emotionCanvas" style="width:100%;height:100%;"></div>
                    <div id="emotionScore" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none;"></div>
                </div>
            </article>

            <article class="card">
                <div class="card-head">
                    <div>
                        <h3 class="card-title">热点事件摘要</h3>
                        <p class="card-meta"></p>
                    </div>
                </div>
                <div class="list" id="newsList">${window.ComponentKit.skeleton(3)}</div>
                <button class="btn-primary btn-full" type="button" id="btnStrategy" style="margin-top: 20px;">一键生成今日简报</button>
                <div id="strategySummary" class="strategy-summary" style="margin-top: 16px;"></div>
            </article>
        `;

        container.querySelector("#btnStrategy").addEventListener("click", () => {
            generateStrategySummary(container);
        });

        const btnDetail = container.querySelector("#btnEmotionDetail");
        if (btnDetail) {
            btnDetail.addEventListener("click", () => {
                if (lastEmotionData) openEmotionDetailModal(lastEmotionData);
            });
        }

        // 使用缓存的市场情绪分析初始化数据（已在 main.js 中预加载，避免重复调用 API）
        // getMarketSentimentInit 内部有缓存机制，如果数据已存在会直接返回，不会重复调用 API
        try {
            marketSentimentData = await window.WorkflowAPI.getMarketSentimentInit();
            
            // 数据加载完成后，统一更新所有前端展示
            loadMarket(container);
            loadEmotion(container);
            loadNews(container);
        } catch (error) {
            console.error('首页：市场情绪分析初始化数据加载失败:', error);
            // 即使加载失败，也尝试显示部分内容（使用回退数据）
            const grid = container.querySelector("#marketGrid");
            const canvas = container.querySelector("#emotionCanvas");
            const list = container.querySelector("#newsList");
            
            if (grid) grid.innerHTML = window.ComponentKit.errorState("指数数据加载失败，请稍后重试。");
            if (canvas) canvas.innerHTML = window.ComponentKit.errorState("情绪数据加载失败。");
            if (list) list.innerHTML = window.ComponentKit.errorState("热点新闻加载失败。");
        }
    }

    window.HomePage = { render };
})();
