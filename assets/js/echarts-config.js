// Chart factory functions using ECharts.
const ChartFactory = (() => {
    const buildEmotionPie = (el, data) => {
        const chart = echarts.init(el, "dark");
        chart.setOption({
            backgroundColor: "transparent",
            tooltip: { trigger: "item" },
            series: [{
                name: "市场情绪",
                type: "pie",
                radius: ["50%", "70%"],
                avoidLabelOverlap: false,
                itemStyle: {
                    borderRadius: 16,
                    borderColor: "#0c162a",
                    borderWidth: 4
                },
                label: {
                    show: true,
                    color: "#dbe7ff",
                    formatter: "{b}: {d}%"
                },
                data: [
                    { value: data.positive, name: "正向", itemStyle: { color: "#58d39c" } },
                    { value: data.negative, name: "负向", itemStyle: { color: "#ff7c98" } },
                    { value: data.neutral, name: "中性", itemStyle: { color: "#ffc371" } }
                ]
            }]
        });
        return chart;
    };

    const buildShareImpactBar = (el, items) => {
        const chart = echarts.init(el, "dark");
        chart.setOption({
            backgroundColor: "transparent",
            grid: { left: 10, right: 10, top: 20, bottom: 10, containLabel: true },
            xAxis: { type: "value", axisLabel: { color: "#d3e1ff" }, splitLine: { show: false } },
            yAxis: { type: "category", axisLabel: { color: "#d3e1ff" }, data: items.map(i => i.label) },
            series: [{
                name: "预测涨跌",
                type: "bar",
                data: items.map(i => i.value),
                itemStyle: {
                    borderRadius: 12,
                    color: (param) => param.value >= 0 ? "#64f5c1" : "#ff8ca2"
                },
                label: {
                    show: true,
                    position: "right",
                    formatter: "{c}%",
                    color: "#e5eeff"
                }
            }]
        });
        return chart;
    };

    const buildRadar = (el, industries, values) => {
        const chart = echarts.init(el, "dark");
        chart.setOption({
            backgroundColor: "transparent",
            radar: {
                indicator: industries.map(name => ({ name, max: Math.max(...values.map(v => Math.abs(v))) + 2 })),
                axisName: { color: "#d4e2ff" },
                splitLine: { lineStyle: { color: ["rgba(144, 171, 255, 0.2)"] } },
                splitArea: { areaStyle: { color: ["rgba(78, 114, 255, 0.08)", "rgba(144, 171, 255, 0.04)"] } }
            },
            series: [{
                type: "radar",
                data: [
                    {
                        value: values,
                        name: "行业情绪",
                        areaStyle: { color: "rgba(109, 162, 255, 0.35)" },
                        lineStyle: { color: "#6ba4ff" },
                        symbol: "circle",
                        symbolSize: 6,
                        itemStyle: { color: "#92c5ff" }
                    }
                ]
            }]
        });
        return chart;
    };

    const buildRiskGauge = (el, value) => {
        const chart = echarts.init(el, "dark");
        chart.setOption({
            backgroundColor: "transparent",
            series: [{
                type: "gauge",
                startAngle: 200,
                endAngle: -20,
                min: 0,
                max: 100,
                progress: { show: true, width: 14 },
                axisLine: { lineStyle: { width: 14 } },
                axisTick: { show: false },
                splitLine: { show: false },
                axisLabel: { color: "#bac9ff" },
                pointer: { show: true, length: "70%", width: 6 },
                detail: {
                    valueAnimation: true,
                    formatter: "{value}",
                    color: "#e8f0ff",
                    fontSize: 24
                },
                title: {
                    show: true,
                    offsetCenter: [0, "60%"],
                    color: "#aab8e4",
                    fontSize: 12
                },
                data: [{ value, name: "30天风险指数" }]
            }]
        });
        return chart;
    };

    return {
        buildEmotionPie,
        buildShareImpactBar,
        buildRadar,
        buildRiskGauge
    };
})();
