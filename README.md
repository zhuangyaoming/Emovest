# Emovest 智能投资助手（前端展示版）

Emovest 是一款移动端取向的智能投资助手页面原型，定位为“千人千面的智能理财赋能平台”。我们核心不做“直接告诉你买什么”，而是通过 AI 将市场情绪、热点事件、策略洞察、个人持仓风险等信息以沉浸式视觉呈现出来，帮助用户理解市场、提升决策能力。当前仓库为纯前端展示版，所有 AI 工作流接口都已预留调用层，方便在后续接入真实后端时无缝切换。

---

## 目录结构

emovest-ai-assistant/
├── index.html
├── README.md
└── assets/
├── css/
│ ├── reset.css # 全局重置
│ └── style.css # 玻璃拟态风格 + 手机框样式
└── js/
├── mock-workflows.js # 模拟 AI_workflow 数据
├── api.js # 工作流调用封装，可切换真实后端
├── components.js # 复用 UI 片段
├── charts.js # ECharts 图表封装
├── home.js # 首页逻辑（指数、情绪、新闻）
├── hotspot.js # 热点预测（情绪影响、事件、热股）
├── strategy.js # 策略页（行业雷达、解读、基金推荐）
├── account.js # 我的账户（持仓同步、风险仪表、预警）
└── main.js # 页面切换、聊天弹窗、全局交互


---

## 页面概览

- **首页**：展示上证、纳指、恒生等指数的实时概览，搭配 EmoMeter 情绪仪表盘与热点新闻摘要，一键跳转到策略页获取今日建议。
- **热点预测**：集中在“每日情绪影响预测分析”工作流，输出大盘预测条形图、市场情绪评语、热点事件追踪与个股热榜。
- **策略页**：调用“各行业情绪雷达”“选定行业的行业情绪解读”“给出所选行业的基金推荐”三个工作流，形成“行业雷达 → 情绪解读 → 基金卡片”的 AI 策略工作流。
- **我的账户**：具备持仓输入区域、一键触发“用户持仓画像”工作流后，生成投资小结、资产分布饼图、风险仪表盘、个性化预警列表及偏好设置卡片。

---

## 工作流调用说明

所有工作流调用统一走 `WorkflowAPI.invoke(workflowName, payload)`。默认使用 `mock-workflows.js` 中的模拟响应，未来对接真实后端时：

1. 在 `assets/js/api.js` 中将 `config.useMock = false`。
2. 设置 `config.endpoint` 为真实的工作流执行地址。
3. 确保后端返回的数据形状与各页面对应字段一致（参考 `mock-workflows.js` 的返回结构）。

---

## 环境配置

项目使用 `.env` 文件配置 Dify 工作流 API。请复制 `.env.example` 文件为 `.env` 并填写相应的配置：

```bash
cp .env.example .env
```

### 环境变量说明

- `DIFY_API_KEY`: 第一个 Dify 工作流的 API Key（用于市场情绪分析、用户持仓画像等工作流）
- `DIFY_BASE_URL`: 第一个 Dify 工作流的 Base URL（默认为 `https://api.dify.ai`）
- `DIFY_API_KEY_2`: 第二个 Dify 工作流的 API Key（用于用户评价风险工作流，如果未配置将回退使用 `DIFY_API_KEY`）
- `DIFY_BASE_URL_2`: 第二个 Dify 工作流的 Base URL（默认为 `https://api.dify.ai`）
- `DIFY_API_KEY_3`: Emovestcharflow 的 API Key（用于智能问答功能，**必填**）
- `DIFY_BASE_URL_3`: Emovestcharflow 的 Base URL（默认为 `https://api.dify.ai`）
- `DIFY_CHATFLOW_NAME`: Emovestcharflow 的工作流名称（可选，默认为 "Emovestcharflow"）
- `USER_ID`: 用户ID（可选，默认为 "Seeya"）
- `PORT`: 服务器端口（可选，默认为 3000）

### Emovestcharflow 智能问答功能

项目已集成 Emovestcharflow 智能问答功能，用户可以在四个页面（首页、热点预测、策略洞察、我的账户）通过顶部的"唤起 Emovest"按钮打开聊天窗口进行智能问答。

**配置说明：**
1. 在 `.env` 文件中添加 `DIFY_API_KEY_3`，填写您的 Emovestcharflow API Key
2. （可选）如果您的 chatflow 名称不是 "Emovestcharflow"，可以在 `.env` 文件中添加 `DIFY_CHATFLOW_NAME` 指定工作流名称
3. （可选）如果您的 Dify 服务地址不是默认的 `https://api.dify.ai`，可以在 `.env` 文件中添加 `DIFY_BASE_URL_3` 指定服务地址

**API 接口：**
- 前端调用：`POST /api/chatflow`
- 请求参数：`{ "message": "用户问题" }`
- 返回格式：`{ "answer": "回答内容", "files": [] }`

**工作原理：**
- 前端将用户输入通过 `sys.query` 参数传递给 Emovestcharflow
- Emovestcharflow 处理用户问题并返回 `answer` 和 `files`
- 前端将 `answer` 内容展示在对话窗口中

## 启动方式

### 使用 Node.js 服务器（推荐）

1. 安装依赖：
  ```bash
  npm install
  ```

2. 配置 `.env` 文件（参考上面的环境配置说明）

3. 启动服务器：
  ```bash
  node server.js
  ```

4. 在浏览器中访问 `http://localhost:3000`

### 快速预览（仅前端）

直接双击 `index.html`，使用 Chrome / Edge 打开，并开启设备模式查看移动端效果。注意：此方式只能使用 mock 数据，无法调用真实的工作流 API。
