(function () {
    const FALLBACK_FUNDS = [
        { name: "新能源先锋混合", popularity: 92, return3m: 12.6 },
        { name: "高端制造主题A", popularity: 88, return3m: 11.3 },
        { name: "黄金避险ETF", popularity: 83, return3m: 7.9 },
        { name: "消费升级精选", popularity: 81, return3m: 6.5 },
        { name: "全球科技指数QDII", popularity: 79, return3m: 9.2 }
    ];

    let impactChart;
    let marketSentimentData = null; // 保存市场情绪分析初始化数据

    async function loadData(container) {
        const impactBox = container.querySelector("#impactChart");
        impactBox.innerHTML = window.ComponentKit.skeleton(3);
        try {
            // 使用缓存的市场情绪分析初始化数据（已在 main.js 中预加载，避免重复调用 API）
            // getMarketSentimentInit 内部有缓存机制，如果数据已存在会直接返回，不会重复调用 API
            if (!marketSentimentData) {
                try {
                    marketSentimentData = await window.WorkflowAPI.getMarketSentimentInit();
                } catch (error) {
                    // 如果是超时错误，显示加载提示
                    if (error.message && (error.message.includes('超时') || error.message.includes('timeout'))) {
                        impactBox.innerHTML = window.ComponentKit.errorState("工作流执行中，请稍候...（预计需要 1-2 分钟）");
                        return;
                    }
                    throw error;
                }
            }
            
            // 使用 index 数据绘制大盘情绪影响预测图表
            const indexData = marketSentimentData?.index;
            if (indexData && Array.isArray(indexData)) {
                // 将 index 数据转换为 shareList 格式（用于图表）
                const shareList = indexData.map(item => {
                    // 优先使用 point，如果没有则使用 changeRatio
                    let value = 0;
                    if (item.point !== undefined) {
                        value = parseFloat(item.point) || 0;
                    } else if (item.changeRatio !== undefined) {
                        value = parseFloat(item.changeRatio) * 5; // 转换为 -5 到 +5 范围
                    }
                    return {
                        label: item.industryName || item.name,
                        value: value
                    };
                });
                impactBox.innerHTML = "";
                if (impactChart) impactChart.dispose();
                impactChart = window.ChartKit.renderImpactBar(impactBox, shareList);
            } else {
                impactBox.innerHTML = window.ComponentKit.errorState("预测数据格式错误，请稍后重试。");
            }
            
            // 使用 industry_news_summary 作为行业情绪评价
            const summaryEl = container.querySelector("#impactSummary");
            const summaryText = marketSentimentData?.industry_news_summary || "暂无行业情绪描述。";
            
            // 使用 industry_news 作为热点事件追踪
            const industryNews = marketSentimentData?.industry_news;
            
            // 获取 sentimentScore，如果有多个新闻，取第一个
            let sentimentScore = null;
            if (industryNews && Array.isArray(industryNews)) {
                for (const item of industryNews) {
                    if (item.data && Array.isArray(item.data) && item.data.length > 0) {
                        const firstNews = item.data[0];
                        if (firstNews.sentimentScore !== undefined) {
                            sentimentScore = parseFloat(firstNews.sentimentScore);
                            break;
                        }
                    } else if (item.sentimentScore !== undefined) {
                        sentimentScore = parseFloat(item.sentimentScore);
                        break;
                    }
                }
            }
            
            // 显示 sentimentScore 标签
            const scoreTag = sentimentScore !== null 
                ? `<span class="list-tag" style="color:${sentimentScore >= 0 ? '#ff4444' : '#15a07a'};border-color:${sentimentScore >= 0 ? '#ff4444' : '#15a07a'};background:${sentimentScore >= 0 ? 'rgba(255,68,68,0.1)' : 'rgba(21,160,122,0.1)'};margin-bottom:8px;display:inline-block;">情绪得分: ${sentimentScore > 0 ? '+' : ''}${sentimentScore.toFixed(2)}</span>`
                : '';
            
            summaryEl.innerHTML = scoreTag + '<div style="margin-top:8px;">' + summaryText + '</div>';
            summaryEl.dataset.detail = summaryText;
            const detailList = summaryText.split(/；|;|\n/).map((item) => item.trim()).filter(Boolean);
            summaryEl.dataset.details = JSON.stringify(detailList);
            
            // 处理热点事件追踪
            if (industryNews && Array.isArray(industryNews)) {
                // industry_news 是一个数组，每个元素包含 data 数组
                // 需要提取 data 数组中的新闻
                let events = [];
                industryNews.forEach(item => {
                    if (item.data && Array.isArray(item.data)) {
                        // 将 data 数组中的新闻转换为事件格式
                        const newsEvents = item.data.map(news => ({
                            title: news.title || "",
                            sector: news.themeCode || news.sector || "",
                            sentimentScore: news.sentimentScore !== undefined ? parseFloat(news.sentimentScore) : null,
                            investmentRisk: news.investmentRisk || "",
                            sentimentAnalysis: news.sentimentAnalysis || "",
                            keyPoints: news.keyPoints || "",
                            analysis: news.summary || news.sentimentAnalysis || ""
                        }));
                        events = events.concat(newsEvents);
                    } else if (item.title || item.sector) {
                        // 如果直接是事件对象
                        events.push({
                            title: item.title || "",
                            sector: item.sector || item.themeCode || "",
                            sentimentScore: item.sentimentScore !== undefined ? parseFloat(item.sentimentScore) : null,
                            investmentRisk: item.investmentRisk || "",
                            sentimentAnalysis: item.sentimentAnalysis || "",
                            keyPoints: item.keyPoints || "",
                            analysis: item.analysis || item.summary || ""
                        });
                    }
                });
                container.querySelector("#hotEvents").innerHTML = window.ComponentKit.eventList(events.slice(0, 10)); // 限制数量
                
                // 处理事件详情中的 Markdown 代码高亮
                setTimeout(() => {
                    const hotEventsEl = container.querySelector("#hotEvents");
                    if (hotEventsEl && typeof hljs !== 'undefined') {
                        hotEventsEl.querySelectorAll('.event-markdown pre code').forEach((block) => {
                            hljs.highlightElement(block);
                        });
                    }
                }, 0);
                
                // 绑定标题点击事件
                const hotEventsEl = container.querySelector("#hotEvents");
                if (hotEventsEl) {
                    hotEventsEl.querySelectorAll('.event-title-clickable').forEach(titleEl => {
                        titleEl.addEventListener('click', function() {
                            const targetId = this.getAttribute('data-target');
                            const contentEl = document.getElementById(`${targetId}-content`);
                            
                            if (contentEl) {
                                if (contentEl.style.display === 'none') {
                                    // 展开
                                    contentEl.style.display = 'block';
                                    
                                    // 展开后处理代码高亮（如果内容之前未渲染）
                                    if (typeof hljs !== 'undefined') {
                                        setTimeout(() => {
                                            contentEl.querySelectorAll('pre code').forEach((block) => {
                                                if (!block.classList.contains('hljs')) {
                                                    hljs.highlightElement(block);
                                                }
                                            });
                                        }, 0);
                                    }
                                } else {
                                    // 收起
                                    contentEl.style.display = 'none';
                                }
                            }
                        });
                    });
                }
            } else {
                container.querySelector("#hotEvents").innerHTML = window.ComponentKit.errorState("热点事件数据格式错误，请稍后重试。");
            }
            
            // 热门基金榜（暂时使用 fallback，后续可以扩展）
            container.querySelector("#hotFundTable").innerHTML = window.ComponentKit.fundHotTable(FALLBACK_FUNDS);
        } catch (error) {
            const fallback = window.ComponentKit.errorState("预测数据加载失败，请稍后重试。");
            impactBox.innerHTML = fallback;
            const summaryEl = container.querySelector("#impactSummary");
            summaryEl.innerHTML = fallback;
            summaryEl.dataset.detail = "";
            summaryEl.dataset.details = JSON.stringify([]);
            container.querySelector("#hotEvents").innerHTML = fallback;
            container.querySelector("#hotFundTable").innerHTML = window.ComponentKit.fundHotTable(FALLBACK_FUNDS);
        }
    }

    function render(container) {
        container.innerHTML = `
            <article class="card">
                <div class="card-head">
                    <div>
                        <span class="badge badge--glow">预测</span>
                        <h3 class="card-title">大盘情绪影响预测</h3>
                        <p class="card-meta"></p>
                    </div>
                </div>
                <div class="chart-box" id="impactChart">${window.ComponentKit.skeleton(3)}</div>
            </article>

            <article class="card card--split">
                <div>
                    <div class="card-head" style="display:flex;align-items:center;gap:8px;">
                        <h3 class="card-title" style="margin:0;">行业情绪评价</h3>
                        <button class="btn-ghost btn-ghost--sm" type="button" id="btnImpactDetail">查看详情</button>
                    </div>
                    <p class="card-meta">今日情绪与风险信号</p>
                    <p class="list-desc" id="impactSummary"></p>
                </div>
                <div>
                    <h3 class="card-title">热点事件追踪</h3>
                    <div class="list" id="hotEvents">${window.ComponentKit.skeleton(3)}</div>
                </div>
            </article>

            <article class="card">
                <div class="card-head">
                    <div>
                        <h3 class="card-title">热门基金榜</h3>
                        <p class="card-meta">高关注度 & 近3月收益表现</p>
                    </div>
                </div>
                <div id="hotFundTable">${window.ComponentKit.skeleton(4)}</div>
            </article>
        `;

        loadData(container);
        setupImpactDetail(container);
    }

    function setupImpactDetail(container) {
        const btn = container.querySelector("#btnImpactDetail");
        const summaryEl = container.querySelector("#impactSummary");
        if (!btn || !summaryEl) return;

        btn.addEventListener("click", () => {
            const detailText = summaryEl.dataset.detail || summaryEl.textContent || "暂无详细分析。";
            const overlayId = "impactDetailModal";
            const existing = document.getElementById(overlayId);
            if (existing) existing.remove();

            const overlay = document.createElement("div");
            overlay.id = overlayId;
            overlay.setAttribute("role", "dialog");
            overlay.setAttribute("aria-modal", "true");
            overlay.style.position = "fixed";
            overlay.style.left = "0";
            overlay.style.top = "0";
            overlay.style.right = "0";
            overlay.style.bottom = "0";
            overlay.style.display = "flex";
            overlay.style.alignItems = "center";
            overlay.style.justifyContent = "center";
            overlay.style.background = "rgba(12, 20, 38, 0.45)";
            overlay.style.backdropFilter = "blur(6px)";
            overlay.style.zIndex = "1000";

            const panel = document.createElement("div");
            panel.style.position = "relative";
            panel.style.width = "min(75vw, 380px)";
            panel.style.maxWidth = "calc(100vw - 32px)";
            panel.style.maxHeight = "86vh";
            panel.style.overflowY = "auto";
            panel.style.background = "#ffffff";
            panel.style.borderRadius = "16px";
            panel.style.boxShadow = "0 20px 48px rgba(14, 23, 45, 0.18)";
            panel.style.padding = "22px 24px 26px";
            panel.style.margin = "0 16px";
            panel.style.color = "#1f2f54";

            const title = document.createElement("h3");
            title.textContent = "行业情绪详细分析";
            title.style.margin = "0 0 12px 0";
            title.style.fontSize = "18px";
            title.style.color = "#14264b";

            const text = document.createElement("div");
            text.style.margin = "0";
            text.style.lineHeight = "1.75";
            text.style.fontSize = "14px";
            text.style.color = "#435274";

            let bulletPoints = [];
            try {
                bulletPoints = summaryEl.dataset.details ? JSON.parse(summaryEl.dataset.details) : [];
            } catch (_e) {
                bulletPoints = [];
            }

            if (!Array.isArray(bulletPoints) || !bulletPoints.length) {
                bulletPoints = (detailText || "").split(/；|;|\n/).map((item) => item.trim()).filter(Boolean);
            }

            if (bulletPoints.length > 1) {
                const list = document.createElement("ul");
                list.style.padding = "0";
                list.style.margin = "0";
                list.style.listStyle = "none";
                list.style.display = "flex";
                list.style.flexDirection = "column";
                list.style.gap = "10px";
                bulletPoints.forEach((point) => {
                    const li = document.createElement("li");
                    li.style.display = "flex";
                    li.style.alignItems = "flex-start";
                    li.style.gap = "8px";
                    li.innerHTML = `<span style="min-width:6px;min-height:6px;margin-top:9px;border-radius:50%;background:#6b8bff;"></span><span>${point}</span>`;
                    list.appendChild(li);
                });
                text.appendChild(list);
            } else {
                const paragraph = document.createElement("p");
                paragraph.textContent = detailText;
                paragraph.style.margin = "0";
                text.appendChild(paragraph);
            }

            const closeBtn = document.createElement("button");
            closeBtn.textContent = "✕";
            closeBtn.setAttribute("aria-label", "关闭");
            closeBtn.style.position = "absolute";
            closeBtn.style.right = "14px";
            closeBtn.style.top = "10px";
            closeBtn.style.background = "transparent";
            closeBtn.style.border = "none";
            closeBtn.style.fontSize = "18px";
            closeBtn.style.color = "#6a7c9e";
            closeBtn.style.cursor = "pointer";

            panel.appendChild(closeBtn);
            panel.appendChild(title);
            panel.appendChild(text);
            overlay.appendChild(panel);
            document.body.appendChild(overlay);

            function close() {
                overlay.remove();
                document.removeEventListener("keydown", onKey);
            }

            function onKey(event) {
                if (event.key === "Escape") close();
            }

            closeBtn.addEventListener("click", close);
            overlay.addEventListener("click", (event) => {
                if (event.target === overlay) close();
            });
            document.addEventListener("keydown", onKey);
        });
    }

    window.HotspotPage = { render };
})();
