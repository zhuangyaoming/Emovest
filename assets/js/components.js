(function () {
    const formatPercent = (value) => {
        const number = typeof value === "number" ? value : parseFloat(value);
        if (Number.isNaN(number)) return "--%";
        const prefix = number > 0 ? "+" : "";
        return `${prefix}${number.toFixed(2)}%`;
    };

    const metricCard = ({ label, value, delta }) => {
        const state = delta > 0 ? "delta-up" : delta < 0 ? "delta-down" : "delta-flat";
        return `
            <div class="stat-card">
                <div class="stat-title">
                    <span>${label}</span>
                    <span class="stat-delta ${state}">${formatPercent(delta)}</span>
                </div>
                <div class="stat-value">${value}</div>
            </div>
        `;
    };

    const newsList = (items = []) => {
        const timestamp = Date.now();
        return items.map((item, index) => {
            const newsId = `news-${index}-${timestamp}`;
            const summaryText = item.summary || "";
            
            return `
            <div class="list-item news-item-collapsible" data-news-id="${newsId}">
                <div>
                    <p class="list-title news-title-clickable" style="cursor:pointer;user-select:none;" data-target="${newsId}">${item.title}</p>
                    <p class="list-desc news-summary-content" id="${newsId}-content" style="display:none;">
                        ${summaryText}
                    </p>
                </div>
                <span class="list-tag">${item.event}</span>
            </div>
        `;
        }).join("");
    };

    const eventList = (items = []) => {
        const timestamp = Date.now();
        return items.map((item, index) => {
            const eventId = `event-${index}-${timestamp}`;
            const sentimentScore = item.sentimentScore !== null && item.sentimentScore !== undefined 
                ? parseFloat(item.sentimentScore) 
                : null;
            const scoreColor = sentimentScore !== null 
                ? (sentimentScore >= 0 ? '#ff4444' : '#15a07a')
                : 'rgba(62, 84, 138, 0.78)';
            const scoreBg = sentimentScore !== null 
                ? (sentimentScore >= 0 ? 'rgba(255,68,68,0.1)' : 'rgba(21,160,122,0.1)')
                : 'rgba(231, 237, 255, 0.6)';
            const scoreBorder = sentimentScore !== null 
                ? (sentimentScore >= 0 ? '#ff4444' : '#15a07a')
                : 'rgba(140, 162, 214, 0.45)';
            
            const hasDetails = item.investmentRisk || item.sentimentAnalysis || item.keyPoints;
            
            // 渲染 Markdown 内容
            const renderMarkdown = (text) => {
                if (!text) return '';
                if (typeof marked !== 'undefined') {
                    marked.setOptions({
                        breaks: true,
                        gfm: true
                    });
                    return marked.parse(text);
                }
                return text;
            };
            
            const keyPointsHtml = item.keyPoints ? renderMarkdown(item.keyPoints) : '';
            const sentimentAnalysisHtml = item.sentimentAnalysis ? renderMarkdown(item.sentimentAnalysis) : '';
            const investmentRiskHtml = item.investmentRisk ? renderMarkdown(item.investmentRisk) : '';
            
            return `
            <div class="list-item">
                <div>
                    <p class="list-title event-title-clickable" style="cursor:pointer;user-select:none;" data-target="${eventId}">${item.title}</p>
                    ${hasDetails ? `
                    <div class="event-detail-content" id="${eventId}-content" style="display:none;margin-top:8px;">
                        ${item.keyPoints ? `<div style="margin-bottom:12px;"><strong style="color:#3b63ff;font-size:13px;">关键要点：</strong><div class="event-markdown" style="color:#4d5f82;font-size:12px;line-height:1.6;margin-top:4px;">${keyPointsHtml}</div></div>` : ''}
                        ${item.sentimentAnalysis ? `<div style="margin-bottom:12px;"><strong style="color:#9d4edd;font-size:13px;">情绪分析：</strong><div class="event-markdown" style="color:#4d5f82;font-size:12px;line-height:1.6;margin-top:4px;">${sentimentAnalysisHtml}</div></div>` : ''}
                        ${item.investmentRisk ? `<div style="margin-bottom:12px;"><strong style="color:#ff6b35;font-size:13px;">投资风险：</strong><div class="event-markdown" style="color:#4d5f82;font-size:12px;line-height:1.6;margin-top:4px;">${investmentRiskHtml}</div></div>` : ''}
                    </div>
                    ` : ''}
                </div>
                <span class="list-tag" style="color:${scoreColor};border-color:${scoreBorder};background:${scoreBg};">
                    ${sentimentScore !== null ? `情绪得分：${sentimentScore > 0 ? '+' : ''}${sentimentScore.toFixed(2)}` : (item.sector || '')}
                </span>
            </div>
        `;
        }).join("");
    };

    const fundHotTable = (funds = []) => {
        if (!Array.isArray(funds) || !funds.length) {
            return errorState("暂无热门基金数据");
        }
        return `
            <table class="table">
                <thead>
                <tr>
                    <th>#</th>
                    <th>基金</th>
                    <th>热度</th>
                    <th>近3月收益率</th>
                </tr>
                </thead>
                <tbody>
                ${funds.map((fund, index) => {
                    const heat = fund.popularity != null ? `${fund.popularity}` : "--";
                    const heatClass = typeof fund.popularity === "number" && fund.popularity >= 70 ? "trend-up" : "trend-down";
                    const returnText = fund.return3m != null ? formatPercent(fund.return3m) : "--";
                    const returnClass = typeof fund.return3m === "number" && fund.return3m >= 0 ? "trend-up" : "trend-down";
                    return `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${fund.name || "未命名基金"}</td>
                            <td class="${heatClass}">${heat}</td>
                            <td class="${returnClass}">${returnText}</td>
                        </tr>
                    `;
                }).join("")}
                </tbody>
            </table>
        `;
    };

    const holdingList = (holdings = []) => holdings.map((item) => `
        <div class="list-item">
            <div>
                <p class="list-title">${item.asset}</p>
                <p class="list-desc">风险等级：${item.risk}</p>
            </div>
            <span class="list-tag">${item.ratio}%</span>
        </div>
    `).join("");

    const alertList = (alerts = []) => alerts.map((text) => `
        <div class="list-item">
            <div>
                <p class="list-title">${text.split("：")[0]}</p>
                <p class="list-desc">${text.split("：")[1] || "请保持关注"}</p>
            </div>
            <span class="list-tag">提醒</span>
        </div>
    `).join("");

    const personalizedAlertList = (newsItems = []) => {
        // 只取前三条新闻
        const items = newsItems.slice(0, 3);
        return items.map((item) => `
            <div class="list-item">
                <div>
                    <p class="list-title">${item.title || "无标题"}</p>
                    <p class="list-desc">${item.keyPoints || ""}</p>
                    <p class="list-desc" style="margin-top: 8px; color: #94b2f5;">${item.impactAnalysis || ""}</p>
                </div>
                <span class="list-tag">预警</span>
            </div>
        `).join("");
    };

    const fundCards = (funds = []) => {
        if (!Array.isArray(funds) || funds.length === 0) {
            return '<div class="error-state">暂无基金推荐数据</div>';
        }
        return funds.map((fund) => `
        <div class="card fund-card">
            <div class="fund-card__top">
                <span class="fund-card__title">${fund.name}</span>
                <span class="fund-yield ${fund.return1Y >= 0 ? "delta-up" : "delta-down"}">${formatPercent(fund.return1Y)}</span>
            </div>
            <p class="fund-card__meta">基金经理：${fund.manager}</p>
            <p class="fund-card__desc">${fund.info}</p>
            <span class="fund-card__tag">聚焦行业：${fund.focus || "多行业"}</span>
        </div>
    `).join("");
    };

    const skeleton = (lines = 3) => `
        <div class="skeleton-group">
            ${Array.from({ length: lines }, () => `<span class="skeleton-line"></span>`).join("")}
        </div>
    `;

    const errorState = (message) => `<div class="error-state">${message}</div>`;

    window.ComponentKit = {
        metricCard,
        newsList,
        eventList,
        fundHotTable,
        holdingList,
        alertList,
        personalizedAlertList,
        fundCards,
        skeleton,
        errorState
    };
})();
