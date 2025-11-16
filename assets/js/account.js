(function () {
    let riskChart;
    let assetChart;
    let containerRef;
    let isLoading = false;

    // 辅助函数：检查元素是否包含 skeleton
    function hasSkeleton(el) {
        if (!el) return false;
        return el.innerHTML.includes("skeleton-group") || 
               el.innerHTML.includes("skeleton-line") ||
               el.querySelector(".skeleton-group") !== null;
    }

    function setLoadingState(isLoading) {
        if (isLoading) {
            // 显示加载状态（不显示 investSummary 和 riskWarning 的 skeleton）
            containerRef.querySelector("#alertList").innerHTML = window.ComponentKit.skeleton(3);
            containerRef.querySelector("#assetPie").innerHTML = window.ComponentKit.skeleton(3);
            containerRef.querySelector("#riskGauge").innerHTML = window.ComponentKit.skeleton(3);
        } else {
            // 清除所有残留的 skeleton（如果还在显示）
            const investSummaryEl = containerRef.querySelector("#investSummary");
            if (investSummaryEl && hasSkeleton(investSummaryEl)) {
                // 如果还在显示 skeleton 且没有有效内容，设置默认文本
                const textContent = investSummaryEl.textContent.trim();
                if (!textContent || textContent.includes("skeleton")) {
                    investSummaryEl.textContent = "暂无投资总结，请同步持仓后查看。";
                }
            }

            const riskWarningEl = containerRef.querySelector("#riskWarning");
            if (riskWarningEl && hasSkeleton(riskWarningEl)) {
                // 如果还在显示 skeleton 且没有有效内容，设置默认文本
                const textContent = riskWarningEl.textContent.trim();
                if (!textContent || textContent.includes("skeleton")) {
                    riskWarningEl.textContent = "暂无风险提醒。";
                }
            }

            const alertListEl = containerRef.querySelector("#alertList");
            if (alertListEl && hasSkeleton(alertListEl)) {
                // 如果还在显示 skeleton，检查是否有内容
                const hasContent = alertListEl.querySelector(".list-item");
                if (!hasContent) {
                    alertListEl.innerHTML = '<div class="error-state">暂无预警信息</div>';
                }
            }

            const assetPieEl = containerRef.querySelector("#assetPie");
            if (assetPieEl && hasSkeleton(assetPieEl)) {
                // 如果还在显示 skeleton，检查是否有图表
                const hasChart = assetPieEl.querySelector("canvas") || assetPieEl.querySelector("svg");
                if (!hasChart) {
                    assetPieEl.innerHTML = window.ComponentKit.errorState("未获取到资产分布信息。");
                }
            }

            const riskGaugeEl = containerRef.querySelector("#riskGauge");
            if (riskGaugeEl && hasSkeleton(riskGaugeEl)) {
                // 如果还在显示 skeleton，检查是否有图表
                const hasChart = riskGaugeEl.querySelector("canvas") || riskGaugeEl.querySelector("svg");
                if (!hasChart) {
                    riskGaugeEl.innerHTML = "";
                    if (riskChart) riskChart.dispose();
                    riskChart = window.ChartKit.renderRiskGauge(riskGaugeEl, 0);
                }
            }
        }
    }

    function renderError(error) {
        const message = error?.message || "加载失败，请稍后重试。";
        containerRef.querySelector("#investSummary").innerHTML = window.ComponentKit.errorState(message);
        containerRef.querySelector("#riskWarning").innerHTML = window.ComponentKit.errorState(message);
        containerRef.querySelector("#alertList").innerHTML = window.ComponentKit.errorState(message);
        containerRef.querySelector("#assetPie").innerHTML = window.ComponentKit.errorState(message);
        containerRef.querySelector("#riskGauge").innerHTML = window.ComponentKit.errorState(message);
    }

    function clearRemainingSkeletons(collectedData) {
        // 检查并清除所有残留的 skeleton
        const investSummaryEl = containerRef.querySelector("#investSummary");
        const riskWarningEl = containerRef.querySelector("#riskWarning");
        const alertListEl = containerRef.querySelector("#alertList");
        const assetPieEl = containerRef.querySelector("#assetPie");
        const riskGaugeEl = containerRef.querySelector("#riskGauge");

        // 检查 invest_summary
        if (hasSkeleton(investSummaryEl)) {
            if (!collectedData.invest_summary) {
                investSummaryEl.textContent = "暂无投资总结，请同步持仓后查看。";
            }
        }

        // 检查 risk_summary
        if (hasSkeleton(riskWarningEl)) {
            if (!collectedData.risk_summary) {
                riskWarningEl.textContent = "暂无风险提醒。";
            }
        }

        // 检查 alertList
        if (hasSkeleton(alertListEl)) {
            if (!collectedData.news || !Array.isArray(collectedData.news) || collectedData.news.length === 0) {
                alertListEl.innerHTML = '<div class="error-state">暂无预警信息</div>';
            }
        }

        // 检查 assetPie
        if (hasSkeleton(assetPieEl)) {
            if (!collectedData.fund || !Array.isArray(collectedData.fund) || collectedData.fund.length === 0) {
                assetPieEl.innerHTML = window.ComponentKit.errorState("未获取到资产分布信息。");
            }
        }

        // 检查 riskGauge
        if (hasSkeleton(riskGaugeEl)) {
            if (collectedData.score === undefined || collectedData.score === null) {
                riskGaugeEl.innerHTML = "";
                if (riskChart) riskChart.dispose();
                riskChart = window.ChartKit.renderRiskGauge(riskGaugeEl, 0);
            }
        }
    }

    function applyProfile(data, isMock = false) {
        // 处理用户风险评价工作流返回的数据
        if (data.invest_summary !== undefined || data.fund !== undefined || data.score !== undefined) {
            // 新格式：用户风险评价工作流返回的数据
            // AI 投资小结 - 确保清除 skeleton
            const investSummaryEl = containerRef.querySelector("#investSummary");
            if (investSummaryEl) {
                investSummaryEl.textContent = data.invest_summary || "暂无投资总结，请同步持仓后查看。";
            }
            
            // 风险监测与行为分析 - 确保清除 skeleton
            const riskWarningEl = containerRef.querySelector("#riskWarning");
            if (riskWarningEl) {
                riskWarningEl.textContent = data.risk_summary || "暂无风险提醒。";
            }
            const riskBox = containerRef.querySelector("#riskGauge");
            riskBox.innerHTML = "";
            if (riskChart) riskChart.dispose();
            const riskScore = typeof data.score === "number" ? data.score : 0;
            riskChart = window.ChartKit.renderRiskGauge(riskBox, riskScore);
            
            // 个性化预警列表：使用 news 前三条的 title, keyPoints, impactAnalysis
            const newsItems = Array.isArray(data.news) ? data.news.slice(0, 3).map(news => ({
                title: news.title || "",
                keyPoints: news.keyPoints || "",
                impactAnalysis: news.impactAnalysis || ""
            })) : [];
            containerRef.querySelector("#alertList").innerHTML = window.ComponentKit.personalizedAlertList(newsItems);
            
            // 我的投资快照：使用 fund 数据
            const assetBox = containerRef.querySelector("#assetPie");
            assetBox.innerHTML = "";
            if (assetChart) assetChart.dispose();
            if (Array.isArray(data.fund) && data.fund.length) {
                assetChart = window.ChartKit.renderAssetPie(assetBox, data.fund, riskScore);
            } else {
                assetBox.innerHTML = window.ComponentKit.errorState("未获取到资产分布信息。");
            }
        } else {
            // 数据格式不匹配，显示错误
            renderError(new Error("返回数据格式不正确"));
        }
    }

    async function loadProfile() {
        // 调用用户风险评价工作流，传递固定参数
        const payload = {
            fund: "50%是股票基金，10%是债券基金，20%是货币基金，20%是混合型基金",
            industry: "我关注电子行业"
        };
        
        // 显示加载状态
        setLoadingState(true);
        
        // 收集所有接收到的数据
        const collectedData = {};
        
        try {
            // 使用流式传输调用工作流，只调用一次
            await window.WorkflowAPI.invokeStream("用户风险评价工作流", payload, (chunk) => {
                // 接收到数据块时，逐步更新UI
                if (chunk.type && chunk.data !== undefined) {
                    collectedData[chunk.type] = chunk.data;
                    
                    // 根据数据类型逐步更新UI，并确保清除 skeleton
                    switch (chunk.type) {
                        case 'invest_summary':
                            const investSummaryEl = containerRef.querySelector("#investSummary");
                            if (investSummaryEl) {
                                // 使用 textContent 会替换整个内容，包括 skeleton
                                investSummaryEl.textContent = chunk.data || "暂无投资总结，请同步持仓后查看。";
                            }
                            break;
                        case 'risk_summary':
                            const riskWarningEl = containerRef.querySelector("#riskWarning");
                            if (riskWarningEl) {
                                // 使用 textContent 会替换整个内容，包括 skeleton
                                riskWarningEl.textContent = chunk.data || "暂无风险提醒。";
                            }
                            break;
                        case 'score':
                            const riskBox = containerRef.querySelector("#riskGauge");
                            if (riskBox && typeof chunk.data === "number") {
                                // 先清空，确保清除 skeleton
                                riskBox.innerHTML = "";
                                if (riskChart) riskChart.dispose();
                                riskChart = window.ChartKit.renderRiskGauge(riskBox, chunk.data);
                            }
                            break;
                        case 'fund':
                            const assetBox = containerRef.querySelector("#assetPie");
                            if (assetBox && Array.isArray(chunk.data) && chunk.data.length) {
                                // 先清空，确保清除 skeleton
                                assetBox.innerHTML = "";
                                if (assetChart) assetChart.dispose();
                                const streamingRiskScore = typeof collectedData.score === "number" ? collectedData.score : 0;
                                assetChart = window.ChartKit.renderAssetPie(assetBox, chunk.data, streamingRiskScore);
                            }
                            break;
                        case 'news':
                            const newsItems = Array.isArray(chunk.data) ? chunk.data.slice(0, 3).map(news => ({
                                title: news.title || "",
                                keyPoints: news.keyPoints || "",
                                impactAnalysis: news.impactAnalysis || ""
                            })) : [];
                            // 使用 innerHTML 会替换整个内容，包括 skeleton
                            const alertListEl = containerRef.querySelector("#alertList");
                            if (alertListEl) {
                                alertListEl.innerHTML = window.ComponentKit.personalizedAlertList(newsItems);
                            }
                            break;
                    }
                }
            });
            
            // 流式传输完成，确保所有数据都已应用
            applyProfile(collectedData, false);
            
            // 清除所有残留的 skeleton
            clearRemainingSkeletons(collectedData);
        } catch (error) {
            // 调用失败，显示错误
            console.error("用户风险评价工作流调用失败:", error);
            renderError(error);
        } finally {
            setLoadingState(false);
        }
    }

    function render(container) {
        containerRef = container;
        container.innerHTML = `
            <div class="account-trigger">
                <button class="btn-primary btn-full" type="button" id="btnAccountOverview">
                    <span class="btn-icon">⚡</span>
                    <span>一键添加我的资产全景视图</span>
                </button>
                </div>

            <div id="accountDataSection" style="display:none;">
            <article class="card">
                <div class="card-head">
                    <div>
                        <span class="badge badge--glow">AI Insight</span>
                        <h3 class="card-title">AI 投资小结</h3>
                            <p class="card-meta"></p>
                    </div>
                </div>
                <p class="list-desc" id="investSummary"></p>
            </article>

            <article class="card card--split">
                <div>
                    <h3 class="card-title">我的投资快照</h3>
                    <p class="card-meta">资产分布与风险等级</p>
                    <div class="chart-box chart-box--sm" id="assetPie">${window.ComponentKit.skeleton(3)}</div>
                </div>
                <div>
                    <h3 class="card-title">风险监测与行为分析</h3>
                        <p class="card-meta"></p>
                    <div class="chart-box chart-box--sm" id="riskGauge">${window.ComponentKit.skeleton(3)}</div>
                    <p class="list-desc" id="riskWarning"></p>
                </div>
            </article>

            <article class="card">
                <div class="card-head">
                    <div>
                        <h3 class="card-title">个性化预警列表</h3>
                            <p class="card-meta"></p>
                    </div>
                </div>
                <div class="list" id="alertList">${window.ComponentKit.skeleton(3)}</div>
            </article>
                </div>

            <article class="card card--highlight">
                <div class="card-head">
                    <div>
                        <h3 class="card-title">个性化设置中心</h3>
                        <p class="card-meta">风格主题</p>
                    </div>
                </div>
                <div class="pref-grid">
                    <div class="pref-card">
                        <h4>主题风格</h4>
                        <div class="pref-options">
                            <span class="pref-pill">极简</span>
                            <span class="pref-pill">炫酷</span>
                            <span class="pref-pill">长辈关怀</span>
                        </div>
                    </div>
                    <div class="pref-card">
                        <h4>无障碍选项</h4>
                        <div class="pref-options">
                            <span class="pref-pill">高对比度</span>
                            <span class="pref-pill">放大字号</span>
                            <span class="pref-pill">语音播报</span>
                        </div>
                    </div>
                </div>
            </article>
        `;

        const loadButton = container.querySelector("#btnAccountOverview");
        const dataSection = container.querySelector("#accountDataSection");

        loadButton.addEventListener("click", async () => {
            if (isLoading) return;
            isLoading = true;
            loadButton.disabled = true;
            loadButton.innerHTML = `<span class="btn-icon">⏳</span><span>正在生成资产全景...</span>`;
            
            // 显示数据区域
            dataSection.style.display = "block";

            try {
                // 只调用一次工作流，使用流式传输
                await loadProfile();
                loadButton.innerHTML = `<span class="btn-icon">✔</span><span>已生成资产全景视图</span>`;
            } catch (_error) {
                loadButton.disabled = false;
                loadButton.innerHTML = `<span class="btn-icon">🔄</span><span>重试生成资产全景视图</span>`;
                isLoading = false;
                return;
            }

            isLoading = false;
        });
    }

    window.AccountPage = { render };
})();
