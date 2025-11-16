// Mocked AI workflow results to mimic backend responses.
// Replace fetchWorkflow with real API requests when backend is ready.
const AI_WORKFLOWS = {
    "市场情绪分析": () => Promise.resolve({
        positive: 48,
        negative: 27,
        neutral: 25
    }),
    "今日金融新闻摘要": () => Promise.resolve({
        newsList: [
            {
                title: "AI驱动的机构调研聚焦新能源供应链",
                summary: "多家机构在最新调研中强调上下游协同，加速智能制造与绿色金融融合。",
                event: "新能源产业链"
            },
            {
                title: "全球资金回流中国资产，北向资金净流入走高",
                summary: "北向资金连续第三日净流入，科技与消费白马双轮驱动，市场情绪修复。",
                event: "跨境资本动向"
            },
            {
                title: "量化资金激活中小盘，成长风格回暖",
                summary: "AI量化模型显示成长板块风险偏好回升，价值成长再度均衡。",
                event: "风格切换"
            }
        ]
    }),
    "每日情绪影响预测分析": () => Promise.resolve({
        shareList: [
            { label: "上证指数", value: -0.62 },
            { label: "深证成指", value: 0.38 },
            { label: "北证50", value: 0.14 },
            { label: "创业板指", value: 0.92 },
            { label: "科创50", value: -0.27 }
        ],
        summary: "受科技与消费双主线驱动，市场情绪整体偏暖，短期波动来自储能和半导体供应链扰动。",
        hotEvents: [
            { title: "智能驾驶政策窗口打开", sector: "汽车电子", analysis: "政策明确高级辅助驾驶补贴细则，汽车电子链条订单显著回升。" },
            { title: "算力中心扩容提速", sector: "算力基础设施", analysis: "多地发布算力中心扩容规划，AI芯片及液冷设备企业受关注。" },
            { title: "绿色能源海外签约激增", sector: "新能源出海", analysis: "多家公司签署海外长单，锂电与储能企业迎来订单验证周期。" }
        ],
        hotStocks: [
            { name: "宁德时代", price: 192.35, change: 4.26 },
            { name: "立讯精密", price: 31.48, change: 3.67 },
            { name: "隆基绿能", price: 43.12, change: 2.81 },
            { name: "海康威视", price: 33.95, change: 1.92 },
            { name: "招商银行", price: 35.27, change: 1.58 }
        ]
    }),
    "各行业情绪雷达": () => Promise.resolve({
        industries: ["新能源", "TMT", "医药", "消费", "金融", "先进制造"],
        performance: [3.2, 2.6, -1.4, 0.9, 1.2, 2.1]
    }),
    "选定行业的行业情绪解读": (payload) => Promise.resolve({
        industry: payload.industry,
        analysis: `${payload.industry}情绪指数处于上升通道，AI对政策催化与订单修复的联合分析显示，本周资金净流入环比增加18%，建议关注盈利弹性较强的龙头标的。`
    }),
    "基金推荐输出": () => Promise.resolve([
        {
            name: "科创成长先锋A",
            return1Y: 18.6,
            manager: "李晨",
            info: "专注半导体与算力链布局，AI动态配置模型加持。"
        },
        {
            name: "新能源双碳精选",
            return1Y: 22.4,
            manager: "陈思",
            info: "聚焦新能源出海龙头，强化供需景气组合。"
        },
        {
            name: "全球创新科技QDII",
            return1Y: 15.1,
            manager: "王悦",
            info: "AI筛选全球AI+硬科技资产，组合分散度高。"
        }
    ]),
    "用户持仓画像": () => Promise.resolve({
        position_holding: [
            { asset: "股票", ratio: 52, risk: "中" },
            { asset: "基金", ratio: 34, risk: "中低" },
            { asset: "现金", ratio: 14, risk: "低" }
        ],
        invest_property: "本月您主要受益于新能源ETF上涨，建议保持均衡配置，适度增加防御资产权重。",
        risk_level: 42,
        risk_warning: "组合中科技股集中度较高，如遇短期回撤建议分批调仓。",
        market_event: [
            "新能源行业政策再加码，关注龙头公司订单兑现节奏。",
            "美联储议息会议临近，关注海外市场波动传导。",
            "算力基础设施建设提速，半导体设备需求改善。"
        ]
    })
};

function fetchWorkflow(name, payload = {}) {
    if (!AI_WORKFLOWS[name]) {
        return Promise.reject(new Error(`未配置的工作流：${name}`));
    }
    return AI_WORKFLOWS[name](payload);
}
