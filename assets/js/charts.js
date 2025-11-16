(function () {
    const attachResize = (chart, container) => {
        if (window.ResizeObserver) {
            const observer = new ResizeObserver(() => chart.resize());
            observer.observe(container);
            chart.__resizeObserver = observer;
        } else {
            window.addEventListener("resize", () => chart.resize());
        }
    };

    function renderEmotionDonut(container, data) {
        const chart = echarts.init(container, "dark");
        chart.setOption({
            backgroundColor: "transparent",
            tooltip: { trigger: "item" },
            series: [{
                type: "pie",
                radius: ["52%", "75%"],
                itemStyle: {
                    borderRadius: 16,
                    borderColor: "#0b1428",
                    borderWidth: 4
                },
                label: { 
                    show: true,
                    formatter: function(params) {
                        return params.name;
                    },
                    color: function(params) {
                        if (params.data && params.data.itemStyle && params.data.itemStyle.color) {
                            return params.data.itemStyle.color;
                        }
                        if (params.name === "积极") return "#fc3640";
                        if (params.name === "消极") return "#00bb5b";
                        return "#72758e";
                    }
                },
                data: [
                { value: data.positive, name: "积极", itemStyle: { color: "#fc3640" }, label: { color: "#fc3640" } },
                { value: data.neutral, name: "中性", itemStyle: { color: "#72758e" }, label: { color: "#72758e" } },
                { value: data.negative, name: "消极", itemStyle: { color: "#00bb5b" }, label: { color: "#00bb5b" } }
            ]
            }]
        });
        attachResize(chart, container);
        return chart;
    }

    function renderImpactBar(container, shareList) {
        const chart = echarts.init(container, "dark");
        chart.setOption({
            backgroundColor: "transparent",
            grid: { left: 10, right: 10, top: 10, bottom: 10, containLabel: true },
            xAxis: {
                type: "value",
                axisLabel: { color: "#9d4edd" },
                splitLine: { show: false }
            },
            yAxis: {
                type: "category",
                axisLabel: { color: "#9d4edd", fontSize: 12 },
                data: shareList.map((item) => item.label)
            },
            series: [{
                type: "bar",
                data: shareList.map((item) => item.value),
                barWidth: 14,
                itemStyle: {
                    borderRadius: 12,
                    color: (params) => params.value >= 0 ? "#ff4444" : "#15a07a"
                },
                label: {
                    show: true,
                    position: "right",
                    formatter: "{c}",
                    color: "#9d4edd",
                    fontSize: 12
                }
            }]
        });
        attachResize(chart, container);
        return chart;
    }

    function renderRadar(container, industries, performance) {
        const maxValue = Math.max(...performance.map((value) => Math.abs(value))) + 1;
        const chart = echarts.init(container, "dark");
        chart.setOption({
            backgroundColor: "transparent",
            radar: {
                indicator: industries.map((name) => ({ name, max: maxValue })),
                axisName: { color: "#d4e2ff" },
                splitLine: { lineStyle: { color: "rgba(125, 160, 255, 0.3)" } },
                splitArea: { areaStyle: { color: ["rgba(110, 150, 255, 0.16)", "rgba(110, 150, 255, 0.08)"] } },
                axisLine: { lineStyle: { color: "rgba(120, 160, 255, 0.3)" } }
            },
            series: [{
                type: "radar",
                data: [{
                    value: performance,
                    name: "行业情绪",
                    areaStyle: { color: "rgba(106, 158, 255, 0.35)" },
                    lineStyle: { color: "#7caeff", width: 1 },
                    symbol: "circle",
                    symbolSize: 6,
                    itemStyle: { color: "#a1c6ff" }
                }]
            }]
        });
        attachResize(chart, container);
        return chart;
    }

    function renderRiskGauge(container, value) {
        const chart = echarts.init(container, "dark");
        chart.setOption({
            backgroundColor: "transparent",
            series: [{
                type: "gauge",
                startAngle: 210,
                endAngle: -30,
                min: 0,
                max: 100,
                progress: {
                    show: true,
                    width: 14,
                    itemStyle: {
                        color: value > 70 ? "#8B0000" : value > 40 ? "#8B0000" : "#8B0000"
                    }
                },
                axisLine: {
                    lineStyle: {
                        width: 14,
                        color: [
                            [0.4, "#60f0ba"],
                            [0.7, "#ffc76a"],
                            [1, "#ff8cab"]
                        ]
                    }
                },
                axisLabel: { color: "#b9c8f3", distance: -40, fontSize: 11 },
                axisTick: { show: false },
                splitLine: { show: false },
                pointer: { length: "60%", width: 6, itemStyle: { color: "#8B0000" } },
                detail: { formatter: "{value}", fontSize: 24, color: "#8B0000", offsetCenter: [0, "55%"] },
                title: { show: true, offsetCenter: [0, "85%"], fontSize: 12, color: "#bcd0ff", text: "风险指数" },
                data: [{ value }]
            }]
        });
        attachResize(chart, container);
        return chart;
    }

    function renderAssetPie(container, items, riskScore) {
        const chart = echarts.init(container, "dark");
        // 定义资产类别颜色映射
        const assetColors = {
            "现金": "#6ef0c0",
            "货币型基金": "#7fa8ff",
            "货币基金": "#7fa8ff",
            "债券型基金": "#9c7bff",
            "债券基金": "#9c7bff",
            "混合型基金": "#ffc76a",
            "股票型基金": "#ff8cab",
            "股票基金": "#ff8cab"
        };
        
        // 处理两种数据格式：
        // 旧格式: [{ asset: "现金", ratio: 12 }, ...]
        // 新格式: [{ category: "货币基金", percentage: 50 }, ...]
        const data = items.map((item) => {
            if (item.category && item.percentage !== undefined) {
                // 新格式：使用 category 和 percentage
                return {
                    value: item.percentage,
                    name: item.category,
                    itemStyle: {
                        color: assetColors[item.category] || "#94b2f5"
                    }
                };
            } else {
                // 旧格式：使用 asset 和 ratio
                return {
                    value: item.ratio,
                    name: item.asset,
                    itemStyle: {
                        color: assetColors[item.asset] || "#94b2f5"
                    }
                };
            }
        });

        // 根据风险得分计算风险等级标签及颜色
        let riskLevelText = "";
        let riskLevelColor = "#e8f0ff";
        if (typeof riskScore === "number" && !Number.isNaN(riskScore)) {
            const score = Math.max(0, Math.min(100, riskScore));
            if (score <= 32) {
                riskLevelText = "保守型";
                riskLevelColor = "#15a07a"; // 较深绿色
            } else if (score <= 65) {
                riskLevelText = "平衡型";
                riskLevelColor = "#3b63ff"; // 深蓝色
            } else {
                riskLevelText = "激进型";
                riskLevelColor = "#fc3640"; // 较深红色
            }
        }
        
        chart.setOption({
            backgroundColor: "transparent",
            tooltip: { trigger: "item" },
            series: [{
                type: "pie",
                radius: ["48%", "70%"],
                itemStyle: { borderRadius: 14, borderColor: "#0b1428", borderWidth: 4 },
                label: { show: true, formatter: "{b}\n{d}%", color: "#94b2f5", fontSize: 12 },
                data: data
            }],
            graphic: riskLevelText
                ? [{
                    type: "text",
                    left: "center",
                    top: "center",
                    style: {
                        text: riskLevelText,
                        fill: riskLevelColor,
                        fontSize: 18,
                        fontWeight: 700,
                        textAlign: "center"
                    },
                    z: 10
                }]
                : []
        });
        attachResize(chart, container);
        return chart;
    }

    window.ChartKit = {
        renderEmotionDonut,
        renderImpactBar,
        renderRadar,
        renderRiskGauge,
        renderAssetPie
    };
})();
