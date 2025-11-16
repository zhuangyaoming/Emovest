require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 简单的内存任务存储（生产可换成 Redis/DB）
const workflowJobs = new Map(); // jobId -> { status, result, error, startedAt, workflow, payload }
let nextJobId = 1;

// 增加服务器超时时间（工作流执行可能需要 110+ 秒）
app.use((req, res, next) => {
    // 设置请求超时为 5 分钟（300000ms）
    req.setTimeout(300000);
    res.setTimeout(300000);
    next();
});

app.use(cors());
app.use(express.json());

const DIFY_BASE_URL = process.env.DIFY_BASE_URL || "https://api.dify.ai";
const DIFY_BASE_URL_2 = process.env.DIFY_BASE_URL_2 || "https://api.dify.ai";
const DIFY_BASE_URL_3 = process.env.DIFY_BASE_URL_3 || "https://api.dify.ai";

function readDifyStream(stream, { label = 'workflow' } = {}) {
    return new Promise((resolve, reject) => {
        if (!stream || typeof stream.on !== 'function') {
            return resolve(null);
        }

        let buffer = '';
        let lastPayload = null;
        let done = false;

        stream.on('data', (chunk) => {
            buffer += chunk.toString('utf8');

            let separatorIndex;
            while ((separatorIndex = buffer.indexOf('\n\n')) !== -1) {
                const rawEvent = buffer.slice(0, separatorIndex);
                buffer = buffer.slice(separatorIndex + 2);
                if (!rawEvent) continue;

                const lines = rawEvent.split('\n');
                const dataLines = [];
                let eventName = null;

                for (const line of lines) {
                    if (line.startsWith('data:')) {
                        dataLines.push(line.slice(5).trim());
                    } else if (line.startsWith('event:')) {
                        eventName = line.slice(6).trim();
                    }
                }

                if (!dataLines.length) continue;

                const dataText = dataLines.join('\n');
                if (!dataText || dataText === '[DONE]') {
                    done = true;
                    continue;
                }

                try {
                    const parsed = JSON.parse(dataText);
                    if (eventName) {
                        parsed.__event = eventName;
                    }
                    lastPayload = parsed;
                } catch (e) {
                    console.warn(`[Dify stream] ${label} 无法解析 JSON`, dataText);
                }
            }
        });

        stream.on('end', () => {
            resolve(lastPayload);
        });

        stream.on('error', (err) => {
            reject(err);
        });

        stream.on('close', () => {
            if (!done) {
                resolve(lastPayload);
            }
        });
    });
}

function extractWorkflowOutputs(payload) {
    if (!payload) {
        return payload;
    }

    const visited = new Set();
    const queue = [payload];

    while (queue.length) {
        const current = queue.shift();
        if (!current || typeof current !== "object") continue;
        if (visited.has(current)) continue;
        visited.add(current);

        if (Array.isArray(current)) {
            return current;
        }

        if (current.outputs && typeof current.outputs === "object") {
            return current.outputs;
        }

        if (current.result && typeof current.result === "object") {
            return current.result;
        }

        if (
            current.total_score !== undefined ||
            Array.isArray(current.news_lists) ||
            Array.isArray(current.news_reports) ||
            Array.isArray(current.index) ||
            Array.isArray(current.industry_emo)
        ) {
            return current;
        }

        if (current.data && typeof current.data === "object" && !visited.has(current.data)) {
            queue.push(current.data);
        }

        if (current.response && typeof current.response === "object" && !visited.has(current.response)) {
            queue.push(current.response);
        }
    }

    return payload;
}

function updateWorkflowJob(jobId, updater) {
    const prev = workflowJobs.get(jobId);
    if (!prev) return;
    workflowJobs.set(jobId, { ...prev, ...updater });
}

// 调用 Dify workflow 的通用函数
async function callDifyWorkflow(workflowName, inputs = {}, options = {}) {
    const userId = process.env.USER_ID || "Seeya";
    // 根据工作流名称选择使用哪个API配置
    const useSecondAPI = workflowName === "用户风险评价工作流";
    const apiKey = useSecondAPI ? (process.env.DIFY_API_KEY_2 || process.env.DIFY_API_KEY) : process.env.DIFY_API_KEY;
    const baseUrl = useSecondAPI ? DIFY_BASE_URL_2 : DIFY_BASE_URL;
    const responseMode = options.responseMode === "blocking" ? "blocking" : "streaming";

    if (!apiKey) {
        const keyName = useSecondAPI ? 'DIFY_API_KEY_2' : 'DIFY_API_KEY';
        throw new Error(`${keyName} 未配置`);
    }

    if (!workflowName || typeof workflowName !== 'string' || !workflowName.trim()) {
        throw new Error('工作流名称不能为空');
    }

    const trimmedWorkflowName = workflowName.trim();

    console.log(`调用 Dify Workflow`, {
        workflowName: trimmedWorkflowName
    });

    // 读取错误响应流的辅助函数
    async function readErrorStream(stream) {
        return new Promise((resolve) => {
            let errorData = '';
            stream.on('data', (chunk) => {
                errorData += chunk.toString('utf8');
            });
            stream.on('end', () => {
                try {
                    resolve(JSON.parse(errorData));
                } catch (e) {
                    resolve({ raw: errorData });
                }
            });
            stream.on('error', () => {
                resolve({ raw: errorData || '无法读取错误信息' });
            });
        });
    }

    async function performPrimaryCall() {
        const response = await axios.post(
            `${baseUrl}/v1/workflows/run`,
            {
                workflow_name: trimmedWorkflowName,
                inputs: inputs,
                response_mode: responseMode,
                user: userId
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                // 增加超时时间到 5 分钟（工作流执行需要约 110 秒，留出足够余量）
                timeout: 300000,
                responseType: responseMode === 'streaming' ? 'stream' : 'json',
                validateStatus: () => true // 不自动抛出错误，让我们手动处理
            }
        );
        
        console.log('Dify API 响应状态:', response.status);
        
        // 检查是否是错误响应
        if (response.status >= 400) {
            let errorData;
            if (responseMode === 'streaming' && response.data) {
                errorData = await readErrorStream(response.data);
            } else {
                errorData = response.data;
            }
            console.error('Dify API 错误响应:', {
                status: response.status,
                statusText: response.statusText,
                errorData: errorData
            });
            throw new Error(`Dify API 错误 (${response.status}): ${JSON.stringify(errorData)}`);
        }
        
        if (responseMode === 'streaming') {
            const payload = await readDifyStream(response.data, { label: trimmedWorkflowName || 'workflow' });
            console.log('Dify 流式响应最终 payload keys:', payload ? Object.keys(payload || {}) : null);
            return payload || {};
        }

        console.log('Dify API 响应数据结构:', {
            hasData: !!response.data,
            hasDataData: !!response.data?.data,
            hasOutputs: !!response.data?.data?.outputs,
            topLevelKeys: Object.keys(response.data || {})
        });

        return response.data;
    }

    try {
        return await performPrimaryCall();
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            console.error('Dify API 调用超时（超过 5 分钟）');
            throw new Error('工作流执行超时，请稍后重试');
        }
        // 处理 504 网关超时错误
        if (error.response?.status === 504) {
            console.error('Dify API 返回 504 网关超时，工作流可能仍在执行中');
            throw new Error('工作流执行超时，请稍后重试');
        }
        console.error('Error calling Dify API:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            message: error.message
        });
        throw error;
    }
}

// Emovestcharflow 聊天接口（流式传输）
app.post('/api/chatflow', async (req, res) => {
    const userMessage = req.body.message;
    const userId = process.env.USER_ID || "Seeya";
    const apiKey = process.env.DIFY_API_KEY_3;
    const baseUrl = DIFY_BASE_URL_3;

    if (!userMessage) {
        return res.status(400).json({ error: 'Message is required' });
    }

    if (!apiKey) {
        return res.status(500).json({ error: 'DIFY_API_KEY_3 未配置，请在 .env 文件中添加 DIFY_API_KEY_3' });
    }

    try {
        // 设置 SSE (Server-Sent Events) 响应头
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // 禁用 nginx 缓冲

        // 调用 Dify chatflow，使用 chat-messages API，通过 query 传递用户问题
        const chatResponse = await axios.post(
            `${baseUrl}/v1/chat-messages`,
            {
                query: userMessage,  // query 必须在请求体顶层
                inputs: {},  // 如果需要其他输入参数，可以在这里添加
                response_mode: "streaming",
                user: userId,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                timeout: 300000,
                responseType: 'stream',
                validateStatus: () => true
            }
        );

        // 检查错误响应
        if (chatResponse.status >= 400) {
            let errorData = '';
            chatResponse.data.on('data', (chunk) => {
                errorData += chunk.toString('utf8');
            });
            await new Promise((resolve) => {
                chatResponse.data.on('end', resolve);
            });
            res.write(`data: ${JSON.stringify({ type: 'error', error: `Dify API 错误 (${chatResponse.status}): ${errorData}` })}\n\n`);
            res.end();
            return;
        }

        // 解析流式响应并转发给客户端
        let buffer = '';
        let lastPayload = null;
        let answer = '';
        let files = [];

        chatResponse.data.on('data', (chunk) => {
            buffer += chunk.toString('utf8');
            let separatorIndex;
            while ((separatorIndex = buffer.indexOf('\n\n')) !== -1) {
                const rawEvent = buffer.slice(0, separatorIndex);
                buffer = buffer.slice(separatorIndex + 2);
                if (!rawEvent) continue;

                const lines = rawEvent.split('\n');
                const dataLines = [];
                for (const line of lines) {
                    if (line.startsWith('data:')) {
                        dataLines.push(line.slice(5).trim());
                    }
                }

                if (!dataLines.length) continue;
                const dataText = dataLines.join('\n');
                if (!dataText || dataText === '[DONE]') continue;

                try {
                    const parsed = JSON.parse(dataText);
                    lastPayload = parsed;
                    
                    // chat-messages API 的响应格式可能不同，需要从多个位置提取 answer
                    let extractedAnswer = '';
                    let extractedFiles = [];
                    
                    // 尝试从不同位置提取 answer
                    if (parsed?.answer) {
                        extractedAnswer = parsed.answer;
                    } else if (parsed?.data?.answer) {
                        extractedAnswer = parsed.data.answer;
                    } else if (parsed?.message?.answer) {
                        extractedAnswer = parsed.message.answer;
                    } else {
                        // 尝试从 outputs 中提取
                        const outputs = parsed?.data?.outputs || parsed?.outputs || {};
                        if (outputs.answer) {
                            extractedAnswer = outputs.answer;
                        }
                    }
                    
                    // 如果找到 answer，发送增量内容
                    if (extractedAnswer && extractedAnswer !== answer) {
                        const incrementalText = extractedAnswer.slice(answer.length);
                        if (incrementalText) {
                            res.write(`data: ${JSON.stringify({ type: 'answer_chunk', data: incrementalText })}\n\n`);
                        }
                        answer = extractedAnswer;
                    }
                    
                    // 提取 files
                    if (parsed?.files && Array.isArray(parsed.files)) {
                        extractedFiles = parsed.files;
                    } else if (parsed?.data?.files && Array.isArray(parsed.data.files)) {
                        extractedFiles = parsed.data.files;
                    } else {
                        const outputs = parsed?.data?.outputs || parsed?.outputs || {};
                        if (outputs.files && Array.isArray(outputs.files)) {
                            extractedFiles = outputs.files;
                        }
                    }
                    
                    if (extractedFiles.length > 0) {
                        files = extractedFiles;
                    }
                } catch (e) {
                    console.warn('解析流式数据失败:', e, dataText);
                }
            }
        });

        chatResponse.data.on('end', () => {
            // 发送最终完整数据
            if (lastPayload) {
                // 再次尝试从最终 payload 中提取完整数据
                if (!answer) {
                    // 尝试从多个位置提取 answer
                    if (lastPayload.answer) {
                        answer = lastPayload.answer;
                    } else if (lastPayload.data?.answer) {
                        answer = lastPayload.data.answer;
                    } else if (lastPayload.message?.answer) {
                        answer = lastPayload.message.answer;
                    } else {
                        const outputs = lastPayload?.data?.outputs || lastPayload?.outputs || {};
                        if (outputs.answer) {
                            answer = outputs.answer;
                        }
                    }
                }
                
                // 提取 files
                if (lastPayload.files && Array.isArray(lastPayload.files)) {
                    files = lastPayload.files;
                } else if (lastPayload.data?.files && Array.isArray(lastPayload.data.files)) {
                    files = lastPayload.data.files;
                } else {
                    const outputs = lastPayload?.data?.outputs || lastPayload?.outputs || {};
                    if (outputs.files && Array.isArray(outputs.files)) {
                        files = outputs.files;
                    }
                }
            }
            
            // 发送最终结果
            res.write(`data: ${JSON.stringify({ type: 'complete', answer: answer, files: files || [] })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
        });

        chatResponse.data.on('error', (err) => {
            console.error('Dify 流式响应错误:', err);
            res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
            res.end();
        });

    } catch (error) {
        console.error('Error calling Emovestcharflow API:', error.response ? error.response.data : error.message);
        res.write(`data: ${JSON.stringify({ type: 'error', error: '抱歉，连接 Emovestcharflow 时发生错误。请检查后端服务日志。', details: error.response ? error.response.data : error.message })}\n\n`);
        res.end();
    }
});

// 工作流调用接口（支持流式传输）
app.post('/api/workflows/execute', async (req, res) => {
    console.log('收到工作流调用请求:', req.body);
    const { workflow, payload, stream } = req.body;
    
    if (!workflow) {
        console.error('工作流名称缺失');
        return res.status(400).json({ error: 'Workflow name is required' });
    }

    console.log(`调用工作流: ${workflow}, 流式传输: ${stream || false}`);
    
    // 如果需要流式传输
    if (stream) {
        try {
            // 根据不同的 workflow 名称，构建不同的 inputs
            let inputs = {};
            
            if (workflow === "市场情绪分析初始化") {
                inputs = {};
            } else if (workflow === "用户风险评价工作流") {
                inputs = {
                    fund: payload?.fund || [
                        { category: "债券基金", percentage: 50 },
                        { category: "股票基金", percentage: 10 },
                        { category: "货币基金", percentage: 40 }
                    ],
                    industry: payload?.industry || "我关注半导体行业"
                };
            } else {
                inputs = payload || {};
            }

            // 设置响应头为 SSE (Server-Sent Events)
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no'); // 禁用 nginx 缓冲

            // 调用 Dify 工作流（流式模式）
            // 注意：callDifyWorkflow 在流式模式下会等待整个流完成并解析，所以我们需要直接调用 Dify API
            const userId = process.env.USER_ID || "Seeya";
            const useSecondAPI = workflow === "用户风险评价工作流";
            const apiKey = useSecondAPI ? (process.env.DIFY_API_KEY_2 || process.env.DIFY_API_KEY) : process.env.DIFY_API_KEY;
            const baseUrl = useSecondAPI ? DIFY_BASE_URL_2 : DIFY_BASE_URL;
            
            if (!apiKey) {
                throw new Error(`${useSecondAPI ? 'DIFY_API_KEY_2' : 'DIFY_API_KEY'} 未配置`);
            }

            // 直接调用 Dify API，获取流式响应
            const difyResponse = await axios.post(
                `${baseUrl}/v1/workflows/run`,
                {
                    workflow_name: workflow.trim(),
                    inputs: inputs,
                    response_mode: "streaming",
                    user: userId
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    timeout: 300000,
                    responseType: 'stream',
                    validateStatus: () => true
                }
            );

            if (difyResponse.status >= 400) {
                let errorData = '';
                difyResponse.data.on('data', (chunk) => {
                    errorData += chunk.toString('utf8');
                });
                await new Promise((resolve) => {
                    difyResponse.data.on('end', resolve);
                });
                throw new Error(`Dify API 错误 (${difyResponse.status}): ${errorData}`);
            }

            // 解析 Dify 流式响应并转发给客户端
            let buffer = '';
            let lastPayload = null;

            difyResponse.data.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
                let separatorIndex;
                while ((separatorIndex = buffer.indexOf('\n\n')) !== -1) {
                    const rawEvent = buffer.slice(0, separatorIndex);
                    buffer = buffer.slice(separatorIndex + 2);
                    if (!rawEvent) continue;

                    const lines = rawEvent.split('\n');
                    const dataLines = [];
                    for (const line of lines) {
                        if (line.startsWith('data:')) {
                            dataLines.push(line.slice(5).trim());
                        }
                    }

                    if (!dataLines.length) continue;
                    const dataText = dataLines.join('\n');
                    if (!dataText || dataText === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(dataText);
                        lastPayload = parsed;
                        
                        // 提取 outputs 数据
                        const outputs = parsed?.data?.outputs || parsed?.outputs || {};
                        
                        // 如果是用户风险评价工作流，逐步发送各个字段
                        if (workflow === "用户风险评价工作流") {
                            if (outputs.invest_summary) {
                                res.write(`data: ${JSON.stringify({ type: 'invest_summary', data: outputs.invest_summary })}\n\n`);
                            }
                            if (outputs.risk_summary) {
                                res.write(`data: ${JSON.stringify({ type: 'risk_summary', data: outputs.risk_summary })}\n\n`);
                            }
                            if (outputs.score !== undefined) {
                                res.write(`data: ${JSON.stringify({ type: 'score', data: outputs.score })}\n\n`);
                            }
                            if (Array.isArray(outputs.fund)) {
                                res.write(`data: ${JSON.stringify({ type: 'fund', data: outputs.fund })}\n\n`);
                            }
                            if (Array.isArray(outputs.news)) {
                                res.write(`data: ${JSON.stringify({ type: 'news', data: outputs.news })}\n\n`);
                            }
                        } else {
                            // 其他工作流，发送完整数据
                            res.write(`data: ${JSON.stringify({ type: 'complete', data: outputs })}\n\n`);
                        }
                    } catch (e) {
                        // 忽略解析错误，继续处理
                    }
                }
            });

            difyResponse.data.on('end', () => {
                // 发送结束标记
                res.write('data: [DONE]\n\n');
                res.end();
            });

            difyResponse.data.on('error', (err) => {
                console.error('Dify 流式响应错误:', err);
                res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
                res.end();
            });
        } catch (error) {
            console.error(`流式传输错误 ${workflow}:`, error.message);
            res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
            res.end();
        }
        return;
    }

    // 非流式传输（原有逻辑）
    try {
        // 根据不同的 workflow 名称，构建不同的 inputs
        let inputs = {};
        
        if (workflow === "市场情绪分析初始化") {
            // 无输入参数
            inputs = {};
        } else if (workflow === "用户风险评价工作流") {
            // 用户风险评价工作流的输入参数：fund 和 industry
            inputs = {
                fund: payload?.fund || [
                    { category: "债券基金", percentage: 50 },
                    { category: "股票基金", percentage: 10 },
                    { category: "货币基金", percentage: 40 }
                ],
                industry: payload?.industry || "我关注半导体行业"
            };
        } else {
            // 其他 workflow 的输入参数
            inputs = payload || {};
        }

        const difyResponse = await callDifyWorkflow(workflow, inputs);
        
        const outputs = extractWorkflowOutputs(difyResponse) || {};
        
        console.log('解析后的 outputs 字段:', Object.keys(outputs || {}));
        console.log('outputs 示例字段值:', {
            hasTotalScore: outputs?.total_score !== undefined,
            hasNewsLists: Array.isArray(outputs?.news_lists),
            hasIndex: Array.isArray(outputs?.index),
            hasIndustryEmo: Array.isArray(outputs?.industry_emo)
        });
        
        // 根据 workflow 名称返回不同的数据格式
        if (workflow === "市场情绪分析初始化") {
            // 市场情绪分析初始化：直接返回整个 outputs 对象
            // 根据用户提供的数据结构，outputs 直接包含所有字段（total_score, positive, news_lists 等）
            if (!outputs || (typeof outputs === 'object' && Object.keys(outputs).length === 0)) {
                console.error('市场情绪分析初始化返回数据为空');
                return res.status(500).json({ error: '工作流返回数据为空' });
            }
            res.json(outputs);
        } else {
            // 其他 workflow：返回 result 字段或整个 outputs
            res.json(outputs?.result || outputs || {});
        }

    } catch (error) {
        console.error(`Error calling workflow ${workflow}:`, error.response ? error.response.data : error.message);
        
        // 如果是超时错误，返回 504 状态码
        if (error.message && (error.message.includes('超时') || error.message.includes('timeout'))) {
            return res.status(504).json({ error: `调用工作流 ${workflow} 失败: ${error.message}` });
        }
        
        res.status(500).json({ error: `调用工作流 ${workflow} 失败: ${error.message}` });
    }
});

// 后台异步执行 Dify 工作流
async function runWorkflowInBackground(jobId, workflow, inputs) {
    const startedAt = Date.now();
    workflowJobs.set(jobId, { status: 'running', result: null, error: null, startedAt, workflow, payload: inputs });
    try {
        const raw = await callDifyWorkflow(workflow, inputs);
        const outputs = extractWorkflowOutputs(raw) || {};
        updateWorkflowJob(jobId, { status: 'succeeded', result: outputs, error: null, startedAt, workflow, payload: inputs });
    } catch (error) {
        updateWorkflowJob(jobId, { status: 'failed', result: null, error: error.message || String(error), startedAt, workflow, payload: inputs });
    }
}

// 启动异步工作流（立即返回 jobId）
app.post('/api/workflows/start', async (req, res) => {
    const { workflow, payload } = req.body || {};
    if (!workflow) {
        return res.status(400).json({ error: 'Workflow name is required' });
    }
    // 根据不同的 workflow 名称，构建不同的 inputs（与 /execute 一致）
    let inputs = {};
    if (workflow === "市场情绪分析初始化") {
        inputs = {};
    } else if (workflow === "用户风险评价工作流") {
        // 用户风险评价工作流的输入参数：fund 和 industry
        inputs = {
            fund: payload?.fund || [
                { category: "债券基金", percentage: 50 },
                { category: "股票基金", percentage: 10 },
                { category: "货币基金", percentage: 40 }
            ],
            industry: payload?.industry || "我关注半导体行业"
        };
    } else {
        inputs = payload || {};
    }
    const jobId = String(nextJobId++);
    workflowJobs.set(jobId, { status: 'pending', result: null, error: null, startedAt: Date.now(), workflow, payload: inputs });
    // 异步执行
    runWorkflowInBackground(jobId, workflow, inputs);
    // 立即返回 jobId
    res.status(202).json({ jobId });
});

// 轮询任务状态
app.get('/api/workflows/status/:jobId', (req, res) => {
    const job = workflowJobs.get(req.params.jobId);
    if (!job) {
        // 返回 200 并标记为 pending，避免前端轮询因为 404 中断
        return res.json({ status: 'pending' });
    }
    res.json({
        status: job.status,
        result: job.status === 'succeeded' ? job.result : undefined,
        error: job.status === 'failed' ? job.error : undefined,
        startedAt: job.startedAt,
        workflow: job.workflow
    });
});

// 简易静态代理/缓存：提供本地同源的 ECharts 脚本，避免浏览器追踪防护拦截第三方存储
let echartsScriptCache = null;
app.get('/vendor/echarts.min.js', async (req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    try {
        if (echartsScriptCache) {
            return res.send(echartsScriptCache);
        }
        const cdnUrl = 'https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js';
        const resp = await axios.get(cdnUrl, { responseType: 'text', timeout: 60000 });
        echartsScriptCache = resp.data;
        res.send(echartsScriptCache);
    } catch (e) {
        // 降级：返回最小占位，避免前端报错
        const fallback = 'window.echarts=window.echarts||{};';
        res.send(fallback);
    }
});

// 静态文件服务，用于提供前端页面（放在 API 路由之后，避免拦截 API 请求）
app.use(express.static(__dirname));

function startServer(preferredPort, maxRetries = 10, attempt = 0) {
    const server = app.listen(preferredPort, () => {
        const actualPort = server.address().port;
        console.log(`Server is running on http://localhost:${actualPort}`);
        console.log(`Please make sure DIFY_API_KEY is set in .env file`);
        console.log(`API endpoints:`);
        console.log(`  POST /api/chatflow`);
        console.log(`  POST /api/workflows/execute`);
        console.log(`  POST /api/workflows/start`);
        console.log(`  GET  /api/workflows/status/:jobId`);
    });
    server.on('error', (err) => {
        if (err && err.code === 'EADDRINUSE' && attempt < maxRetries) {
            const nextPort = preferredPort + 1;
            console.warn(`Port ${preferredPort} is in use, trying ${nextPort}...`);
            setTimeout(() => startServer(nextPort, maxRetries, attempt + 1), 300);
        } else {
            console.error('Failed to start server:', err);
            process.exit(1);
        }
    });
}

startServer(Number(PORT));

