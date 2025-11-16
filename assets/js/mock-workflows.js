(function () {
    const randomDelta = (spread = 1) => +((Math.random() * 2 - 1) * spread).toFixed(2);
    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    const deepCopy = (payload) => JSON.parse(JSON.stringify(payload));

    const INDEX_BASELINE = [
        { name: "上证指数", value: 3235.67, change: 0.72 },
        { name: "科创50", value: 1002.05, change: -0.48 },
        { name: "沪深300", value: 4650.63, change: 0.87 },
        { name: "深证成指", value: 11258.34, change: 0.38 },
        { name: "创业板指", value: 2354.91, change: 0.92 }
    ];

    const INDUSTRIES = [
        { name: "新能源", score: 3.2 },
        { name: "TMT", score: 2.6 },
        { name: "医药", score: 2.0 },
        { name: "消费", score: 1.9 },
        { name: "金融", score: 1.2 },
        { name: "先进制造", score: 1.1 }
    ];

    const FUNDS = [
        {
            name: "科创成长先锋A",
            return1Y: 18.6,
            manager: "李晨",
            info: "聚焦半导体、智能制造与算力基础设施，AI 动态调仓增强收益。",
            focus: "先进制造"
        },
        {
            name: "新能源双碳精选",
            return1Y: 22.4,
            manager: "陈思",
            info: "覆盖光伏、储能、整车全链条，评估政策情绪与订单兑现节奏。",
            focus: "新能源"
        },
        {
            name: "全球创新科技QDII",
            return1Y: 15.1,
            manager: "王悦",
            info: "全球 AI 与硬科技资产组合，强化风险对冲与货币敞口管理。",
            focus: "TMT"
        },
        {
            name: "医药健康平衡",
            return1Y: 11.3,
            manager: "周晗",
            info: "精选创新药、医疗器械龙头，关注政策催化节点与估值修复。",
            focus: "医药"
        }
    ];

    const NEWS_ITEMS = [
        {
            title: "AI驱动机构调研聚焦新能源供应链",
            summary: "新能源产业链订单回暖，机构强调智能制造与绿色金融融合。",
            event: "新能源产业链"
        },
        {
            title: "全球资金回流中国资产 北向资金净流入走高",
            summary: "北向资金连续第三日净流入，科技与消费白马双轮驱动。",
            event: "跨境资金动向"
        },
        {
            title: "算力中心扩容提速 AI基础设施需求爆发",
            summary: "多地出台算力扩容规划，液冷与GPU芯片企业迎来业绩弹性。",
            event: "算力基础设施"
        }
    ];

    const HOT_EVENTS = [
        {
            title: "智能驾驶政策窗口打开",
            sector: "汽车电子",
            analysis: "政策明确高级辅助驾驶补贴细则，汽车电子链条订单显著回升。"
        },
        {
            title: "算力中心扩容提速",
            sector: "算力基础设施",
            analysis: "增量项目释放 GPU 与液冷设备需求，关注中游设备商。"
        },
        {
            title: "绿色能源海外签约激增",
            sector: "新能源出海",
            analysis: "储能与风电企业获得大额长单，关注兑现节奏。"
        }
    ];

    const HOT_STOCKS = [
        { name: "宁德时代", price: 192.35, change: 4.26 },
        { name: "立讯精密", price: 31.48, change: 3.67 },
        { name: "隆基绿能", price: 43.12, change: 2.81 },
        { name: "海康威视", price: 33.95, change: 1.92 },
        { name: "招商银行", price: 35.27, change: 1.58 }
    ];

    const workflows = {
        "给出所选行业的基金推荐": async (payload = {}) => {
            const target = payload.industry;
            const matched = target ? FUNDS.filter((fund) => fund.focus === target) : FUNDS;
            return matched.length ? deepCopy(matched) : deepCopy(FUNDS.slice(0, 3));
        },
        "市场情绪分析初始化": async () => {
            return {
                total_score: 52,
                positive: 30,
                neutral: 40,
                negative: 30,
                detail_analysis: "当前市场正处于科技与消费双主线的强劲驱动之下，两大核心板块的协同发力为市场注入了充足动能。科技领域中，AI应用场景的持续拓展、算力基础设施的迭代升级，叠加消费板块里可选消费需求的逐步释放、必选消费的稳健托底，共同构筑了市场向上的基础逻辑，推动整体市场情绪维持偏暖态势，投资者风险偏好也随之稳步提升，多数行业板块呈现出结构性活跃特征。\n\n不过，短期市场仍面临局部领域的扰动，主要来源于储能与半导体产业链的阶段性波动。储能板块受上游原材料价格短期震荡、部分地区政策落地节奏不及预期等因素影响，企业盈利预期出现阶段性调整；半导体链条则因全球供应链博弈加剧、部分细分领域产能周期切换等问题，短期业绩兑现节奏存在不确定性，这两类资产的波动传导至市场，导致指数在整体上行过程中出现阶段性的震荡整理，但并未改变科技与消费双主线引领的长期向好趋势。",
                news_reports: [
                    {
                        news: {
                            title: "五家银行合计被罚超2.15亿元，监管风暴升级",
                            summary: "国家金融监督管理总局于10月31日对中国银行、农业银行、民生银行、平安银行及浦发银行五家金融机构处以总额2.15亿元的行政处罚，涉及信贷管理、内控合规等多个领域。",
                            analysis: "此次监管处罚规模较大，体现了金融监管部门对银行业合规经营的严格要求。预计将对相关银行股价产生短期负面影响，但长期有利于行业规范发展。",
                            label: "金融监管"
                        }
                    },
                    {
                        news: {
                            title: "AI驱动机构调研聚焦新能源供应链",
                            summary: "新能源产业链订单回暖，机构强调智能制造与绿色金融融合。",
                            analysis: "新能源产业链订单回暖，机构强调智能制造与绿色金融融合，预计将推动相关板块估值修复。",
                            label: "新能源产业链"
                        }
                    },
                    {
                        news: {
                            title: "算力中心扩容提速 AI基础设施需求爆发",
                            summary: "多地出台算力扩容规划，液冷与GPU芯片企业迎来业绩弹性。",
                            analysis: "算力中心扩容提速，AI基础设施需求爆发，液冷与GPU芯片企业迎来业绩弹性，建议关注相关龙头企业。",
                            label: "算力基础设施"
                        }
                    }
                ],
                analysis: "### 当前中国整体市场情绪得分分析\n\n基于今日市场数据，整体情绪得分52分，处于中性偏暖区间。科技与消费双主线协同发力，为市场提供上行动能。建议关注混合型基金与股票型基金的行业集中度，适时调整以平衡风险收益。",
                index: [
                    { industryName: "上证指数", point: -0.2 },
                    { industryName: "深证成指", point: 0.3 },
                    { industryName: "创业板指", point: 0.5 },
                    { industryName: "沪深300", point: 0.1 }
                ],
                industry_news_summary: "受科技与消费双主线驱动，市场情绪整体偏暖，短期波动来自储能与半导体链条扰动。",
                industry_news: [
                    {
                        title: "智能驾驶政策窗口打开",
                        sector: "汽车电子",
                        analysis: "政策明确高级辅助驾驶补贴细则，汽车电子链条订单显著回升。"
                    },
                    {
                        title: "算力中心扩容提速",
                        sector: "算力基础设施",
                        analysis: "增量项目释放 GPU 与液冷设备需求，关注中游设备商。"
                    },
                    {
                        title: "绿色能源海外签约激增",
                        sector: "新能源出海",
                        analysis: "储能与风电企业获得大额长单，关注兑现节奏。"
                    }
                ],
                industry_emo_score: {
                    "新能源": 3.2,
                    "先进制造": 2.1,
                    "金融": 1.2,
                    "消费": 0.9,
                    "医药": -1.4,
                    "TMT": 2.6
                },
                industry_emo_interpret: {
                    "新能源": "新能源情绪指数持续走高。政策催化 + 资金流向 + 盈利修复信号共同发力，预计本周净流入环比提升 18%，建议关注具备估值弹性的龙头。",
                    "先进制造": "先进制造板块情绪稳定，智能制造与绿色金融融合推动估值修复。",
                    "金融": "金融板块情绪中性，监管政策影响短期波动，长期看好。",
                    "消费": "消费板块情绪回暖，可选消费需求逐步释放，必选消费稳健托底。",
                    "医药": "医药板块情绪偏弱，政策不确定性影响短期表现。",
                    "TMT": "TMT板块情绪积极，AI应用场景持续拓展，算力基础设施需求增长。"
                }
            };
        }
    };

    window.MockWorkflows = {
        invoke(name, payload) {
            if (!workflows[name]) {
                throw new Error(`未配置的工作流：${name}`);
            }
            return workflows[name](payload || {});
        }
    };
})();
