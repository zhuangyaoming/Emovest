(function () {
    let radarChart;
    let selectedIndustry = null;
    let marketSentimentData = null; // 保存市场情绪分析初始化数据

    async function updateInsight(container) {
        const insight = container.querySelector("#industryInsight");
        insight.innerHTML = window.ComponentKit.skeleton(2);
        try {
            // 使用缓存的市场情绪分析初始化数据（已在 main.js 中预加载，避免重复调用 API）
            // getMarketSentimentInit 内部有缓存机制，如果数据已存在会直接返回，不会重复调用 API
            if (!marketSentimentData) {
                try {
                    marketSentimentData = await window.WorkflowAPI.getMarketSentimentInit();
                } catch (error) {
                    // 如果是超时错误，显示加载提示
                    if (error.message && (error.message.includes('超时') || error.message.includes('timeout'))) {
                        insight.innerHTML = window.ComponentKit.errorState("工作流执行中，请稍候...（预计需要 1-2 分钟）");
                        return;
                    }
                    throw error;
                }
            }
            
            // 使用 industry_emo 数组中的 analysis 字段
            const industryEmo = marketSentimentData?.industry_emo;
            if (industryEmo && Array.isArray(industryEmo)) {
                const selectedItem = industryEmo.find(item => (item.industry || item.name) === selectedIndustry);
                if (selectedItem && selectedItem.analysis) {
                    insight.textContent = selectedItem.analysis;
                } else {
                    // 回退到旧的对象格式
                    const industryInterpret = marketSentimentData?.industry_emo_interpret;
                    if (industryInterpret && industryInterpret[selectedIndustry]) {
                        insight.textContent = industryInterpret[selectedIndustry];
                    } else {
                        insight.innerHTML = window.ComponentKit.errorState("暂无该行业的情绪解读数据。");
                    }
                }
            } else {
                // 回退到旧的对象格式
                const industryInterpret = marketSentimentData?.industry_emo_interpret;
                if (industryInterpret && industryInterpret[selectedIndustry]) {
                    insight.textContent = industryInterpret[selectedIndustry];
                } else {
                    insight.innerHTML = window.ComponentKit.errorState("暂无该行业的情绪解读数据。");
                }
            }
        } catch (error) {
            insight.innerHTML = window.ComponentKit.errorState("行业解读加载失败。");
        }
    }

    async function loadFunds(container) {
        const fundStack = container.querySelector("#fundCards");
        if (!fundStack) return; // 如果元素不存在，直接返回
        
        fundStack.innerHTML = window.ComponentKit.skeleton(3);
        try {
            // 直接使用 mock 数据，不调用工作流
            // 即使 selectedIndustry 为 null，mock 数据也会返回所有基金
            const funds = await window.MockWorkflows.invoke("给出所选行业的基金推荐", { industry: selectedIndustry || null });
            
            // 确保返回的是数组格式
            if (Array.isArray(funds) && funds.length > 0) {
                fundStack.innerHTML = window.ComponentKit.fundCards(funds);
            } else {
                // 如果返回的数据格式不对，使用默认的mock数据（所有基金）
                const defaultFunds = await window.MockWorkflows.invoke("给出所选行业的基金推荐", {});
                if (Array.isArray(defaultFunds) && defaultFunds.length > 0) {
                    fundStack.innerHTML = window.ComponentKit.fundCards(defaultFunds);
                } else {
                    fundStack.innerHTML = window.ComponentKit.errorState("暂无基金推荐数据");
                }
            }
        } catch (error) {
            console.error("基金推荐加载失败:", error);
            // 如果出错，尝试直接使用默认数据
            try {
                const defaultFunds = await window.MockWorkflows.invoke("给出所选行业的基金推荐", {});
                if (Array.isArray(defaultFunds) && defaultFunds.length > 0) {
                    fundStack.innerHTML = window.ComponentKit.fundCards(defaultFunds);
                } else {
                    fundStack.innerHTML = window.ComponentKit.errorState("基金推荐加载失败：" + (error.message || "未知错误"));
                }
            } catch (fallbackError) {
                fundStack.innerHTML = window.ComponentKit.errorState("基金推荐加载失败：" + (error.message || "未知错误"));
            }
        }
    }

    function renderIndustryChips(container, industries) {
        const chipBox = container.querySelector("#industryChips");
        chipBox.innerHTML = industries.map((industry) => `
            <span class="chip ${industry === selectedIndustry ? "active" : ""}" data-industry="${industry}">
                ${industry}
            </span>
        `).join("");

        chipBox.querySelectorAll(".chip").forEach((chip) => {
            chip.addEventListener("click", () => {
                selectedIndustry = chip.dataset.industry;
                chipBox.querySelectorAll(".chip").forEach((node) =>
                    node.classList.toggle("active", node === chip)
                );
                updateInsight(container);
                loadFunds(container);
            });
        });
    }

    async function loadRadar(container) {
        const radarBox = container.querySelector("#industryRadar");
        radarBox.innerHTML = window.ComponentKit.skeleton(3);
        try {
            // 使用缓存的市场情绪分析初始化数据（已在 main.js 中预加载，避免重复调用 API）
            // getMarketSentimentInit 内部有缓存机制，如果数据已存在会直接返回，不会重复调用 API
            if (!marketSentimentData) {
                try {
                    marketSentimentData = await window.WorkflowAPI.getMarketSentimentInit();
                } catch (error) {
                    // 如果是超时错误，显示加载提示
                    if (error.message && (error.message.includes('超时') || error.message.includes('timeout'))) {
                        radarBox.innerHTML = window.ComponentKit.errorState("工作流执行中，请稍候...（预计需要 1-2 分钟）");
                        return;
                    }
                    throw error;
                }
            }
            
            // 使用 industry_emo 数组（实际返回的格式）
            const industryEmo = marketSentimentData?.industry_emo;
            if (industryEmo && Array.isArray(industryEmo)) {
                // industry_emo 是数组格式：[{ industry: "新能源", score: 4.1, analysis: "..." }, ...]
                const industries = industryEmo.map(item => item.industry || item.name || "");
                const performance = industryEmo.map(item => parseFloat(item.score) || 0);
                selectedIndustry = industries[0];
                radarBox.innerHTML = "";
                if (radarChart) radarChart.dispose();
                radarChart = window.ChartKit.renderRadar(radarBox, industries, performance);
                renderIndustryChips(container, industries);
                updateInsight(container);
                loadFunds(container);
            } else if (marketSentimentData?.industry_emo_score && typeof marketSentimentData.industry_emo_score === 'object') {
                // 回退到旧的对象格式
                const industryEmoScore = marketSentimentData.industry_emo_score;
                const industries = Object.keys(industryEmoScore);
                const performance = industries.map(industry => parseFloat(industryEmoScore[industry]) || 0);
                selectedIndustry = industries[0];
                radarBox.innerHTML = "";
                if (radarChart) radarChart.dispose();
                radarChart = window.ChartKit.renderRadar(radarBox, industries, performance);
                renderIndustryChips(container, industries);
                updateInsight(container);
                loadFunds(container);
            } else {
                radarBox.innerHTML = window.ComponentKit.errorState("行业雷达数据格式错误，请稍后重试。");
                container.querySelector("#industryInsight").innerHTML =
                    window.ComponentKit.errorState("暂时无法获取行业解读。");
            }
        } catch (error) {
            radarBox.innerHTML = window.ComponentKit.errorState("行业雷达加载失败。");
            container.querySelector("#industryInsight").innerHTML =
                window.ComponentKit.errorState("暂时无法获取行业解读。");
        }
    }

    function render(container) {
        container.innerHTML = `
            <article class="card">
                <div class="card-head">
                    <div>
                        <span class="badge badge--glow">行业洞察</span>
                        <h3 class="card-title">行业情绪雷达</h3>
                        <p class="card-meta"></p>
                    </div>
                </div>
                <div class="chart-box" id="industryRadar">${window.ComponentKit.skeleton(3)}</div>
                <div class="chip-group" id="industryChips"></div>
            </article>

            <article class="card">
                <div class="card-head">
                    <div>
                        <h3 class="card-title">行业情绪解读</h3>
                        <p class="card-meta"></p>
                    </div>
                </div>
                <div class="list-desc" id="industryInsight">${window.ComponentKit.skeleton(2)}</div>
            </article>

            <article class="card">
                <div class="card-head">
                    <div>
                        <h3 class="card-title">基金智能推荐</h3>
                        <p class="card-meta"></p>
                    </div>
                    <div style="font-size:10px;color:rgba(108,130,180,0.7);line-height:1.4;text-align:right;max-width:140px;">以下推荐结果由AI生成，市场有风险，投资需谨慎</div>
                </div>
                <div class="card-stack" id="fundCards">${window.ComponentKit.skeleton(3)}</div>
            </article>
        `;

        // 立即加载基金推荐，不等待 loadRadar 完成
        loadFunds(container);
        loadRadar(container);
    }

    window.StrategyPage = { render };
})();
