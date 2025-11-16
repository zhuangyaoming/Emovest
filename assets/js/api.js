(function () {
    const config = {
        useMock: false, // 默认使用真实后端
        endpoint: "/api/workflows/execute",
        startEndpoint: "/api/workflows/start",
        statusEndpoint: "/api/workflows/status"
    };

    // 针对“市场情绪分析初始化”的单例缓存，避免多处并发触发重复调用
    let marketSentimentInitPromise = null; // in-flight promise
    let marketSentimentInitData = null;    // 成功结果缓存

    // 轮询工具
    async function poll(fn, { intervalMs = 3000, maxTimeMs = 10 * 60 * 1000 }) {
        const start = Date.now();
        // 指数退避的上限 8 秒
        let wait = intervalMs;
        while (true) {
            const res = await fn();
            if (res && res.done) return res.value;
            if (Date.now() - start > maxTimeMs) {
                throw new Error("轮询超时");
            }
            await new Promise(r => setTimeout(r, wait));
            wait = Math.min(wait * 1.4, 8000);
        }
    }

    async function invoke(workflowName, payload = null) {
        if (!workflowName) throw new Error("workflowName 不能为空");

        if (!config.useMock) {
            try {
                // 创建 AbortController 用于超时控制（工作流可能需要 110+ 秒）
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 分钟超时
                
                const response = await fetch(config.endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ workflow: workflowName, payload }),
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);

                if (!response.ok) {
                    // 如果是 504 网关超时错误，可能是工作流还在执行中，不应该立即回退到 mock
                    if (response.status === 504) {
                        console.warn(`Workflow ${workflowName} 服务器返回 504 超时，但工作流可能仍在执行中`);
                        // 504 错误不应该立即回退到 mock，应该抛出错误让调用者处理
                        throw new Error(`工作流 ${workflowName} 执行超时，请稍后重试`);
                    }
                    const message = await response.text();
                    throw new Error(message || "工作流调用失败");
                }

                const data = await response.json();
                return data;
            } catch (error) {
                // 如果是超时错误（AbortError 或 504），不应该回退到 mock 数据
                // 因为工作流可能仍在执行中，应该让用户重试
                if (error.name === 'AbortError') {
                    console.error(`Workflow ${workflowName} 调用超时（超过 3 分钟）`);
                    throw new Error(`工作流 ${workflowName} 执行超时，请稍后重试`);
                }
                // 其他错误也抛出，不自动回退到 mock
                console.error(`Workflow ${workflowName} 调用失败:`, error);
                throw error;
            }
        }

        return window.MockWorkflows.invoke(workflowName, payload);
    }

    // 新增：启动长任务并轮询，避免前端 504
    async function invokeWithPolling(workflowName, payload = null) {
        if (config.useMock) {
            return window.MockWorkflows.invoke(workflowName, payload);
        }
        // 1) 启动任务，立即拿到 jobId
        const startResp = await fetch(config.startEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workflow: workflowName, payload })
        });
        if (!startResp.ok) {
            const msg = await startResp.text();
            throw new Error(msg || "启动工作流失败");
        }
        const { jobId } = await startResp.json();
        if (!jobId) throw new Error("启动工作流失败：缺少 jobId");

        // 2) 轮询直到完成
        const result = await poll(async () => {
            try {
                const statusResp = await fetch(`${config.statusEndpoint}/${encodeURIComponent(jobId)}`);
                // 对于 404/400 等非致命状态，视为未完成继续轮询
                if (!statusResp.ok) {
                    if (statusResp.status === 404 || statusResp.status === 400 || statusResp.status === 409) {
                        return { done: false };
                    }
                    const msg = await statusResp.text();
                    throw new Error(msg || "查询任务状态失败");
                }
                const status = await statusResp.json();
                if (status.status === 'succeeded') {
                    return { done: true, value: status.result };
                }
                if (status.status === 'failed') {
                    const errMsg = status.error || "工作流执行失败";
                    throw new Error(errMsg);
                }
                return { done: false };
            } catch (e) {
                // 网络波动等异常：短暂忽略，继续轮询
                return { done: false };
            }
        }, { intervalMs: 2000, maxTimeMs: 15 * 60 * 1000 });

        return result;
    }

    // 调用市场情绪分析初始化 workflow
    async function getMarketSentimentInit() {
        // 若已有成功结果，直接返回
        if (marketSentimentInitData) {
            return marketSentimentInitData;
        }
        // 若已有进行中的请求，复用该 promise
        if (marketSentimentInitPromise) {
            return marketSentimentInitPromise;
        }
        try {
            // 使用启动+轮询的方式，避免前端等待阻塞导致 504
            marketSentimentInitPromise = invokeWithPolling("市场情绪分析初始化");
            const data = await marketSentimentInitPromise;
            // 检查数据是否有效（包含预期的字段）
            if (!data || typeof data !== 'object') {
                throw new Error("返回数据格式错误");
            }
            // 检查是否包含关键字段
            const hasValidData = data.total_score !== undefined || 
                                Array.isArray(data.news_lists) || 
                                Array.isArray(data.index) ||
                                Array.isArray(data.industry_emo);
            if (!hasValidData && Object.keys(data).length === 0) {
                throw new Error("返回数据为空");
            }
            console.log('市场情绪分析初始化数据获取成功，字段:', Object.keys(data));
            marketSentimentInitData = data; // 写入缓存
            return marketSentimentInitData;
        } catch (error) {
            // 检查是否是超时错误，如果是超时，不应该回退到 mock
            const isTimeoutError = error.message && (
                error.message.includes('超时') || 
                error.message.includes('timeout') ||
                error.message.includes('504')
            );
            
            if (isTimeoutError) {
                // 超时错误：抛出错误，让调用者决定如何处理（可以显示加载提示）
                console.error("市场情绪分析初始化超时:", error.message);
                throw error;
            }
            
            // 其他错误：回退到 mock 数据
            console.warn("市场情绪分析初始化失败，使用 mock 数据:", error);
            const mock = await window.MockWorkflows.invoke("市场情绪分析初始化");
            marketSentimentInitData = mock;
            return marketSentimentInitData;
        } finally {
            // 无论成功或失败（抛错），都清理 in-flight 引用（成功时已有 data 缓存）
            marketSentimentInitPromise = null;
        }
    }

    // 流式传输调用工作流
    async function invokeStream(workflowName, payload = null, onChunk = null) {
        if (!workflowName) throw new Error("workflowName 不能为空");

        if (config.useMock) {
            // Mock 模式下，直接返回完整数据
            const data = await window.MockWorkflows.invoke(workflowName, payload);
            if (onChunk) {
                // 模拟流式传输，逐步发送数据
                if (data.invest_summary) {
                    onChunk({ type: 'invest_summary', data: data.invest_summary });
                }
                if (data.risk_summary) {
                    onChunk({ type: 'risk_summary', data: data.risk_summary });
                }
                if (data.score !== undefined) {
                    onChunk({ type: 'score', data: data.score });
                }
                if (Array.isArray(data.fund)) {
                    onChunk({ type: 'fund', data: data.fund });
                }
                if (Array.isArray(data.news)) {
                    onChunk({ type: 'news', data: data.news });
                }
            }
            return data;
        }

        return new Promise((resolve, reject) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 分钟超时

            fetch(config.endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ workflow: workflowName, payload, stream: true }),
                signal: controller.signal
            })
            .then(response => {
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    return response.text().then(text => {
                        throw new Error(text || "工作流调用失败");
                    });
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                const result = {};

                function readStream() {
                    reader.read().then(({ done, value }) => {
                        if (done) {
                            resolve(result);
                            return;
                        }

                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n\n');
                        buffer = lines.pop() || ''; // 保留最后一个不完整的行

                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                const dataStr = line.slice(6);
                                if (dataStr === '[DONE]') {
                                    resolve(result);
                                    return;
                                }
                                
                                try {
                                    const chunk = JSON.parse(dataStr);
                                    if (chunk.type === 'error') {
                                        reject(new Error(chunk.error));
                                        return;
                                    }
                                    
                                    // 合并数据到结果对象
                                    if (chunk.type && chunk.data !== undefined) {
                                        result[chunk.type] = chunk.data;
                                        
                                        // 调用回调函数
                                        if (onChunk) {
                                            onChunk(chunk);
                                        }
                                    } else if (chunk.type === 'complete') {
                                        Object.assign(result, chunk.data);
                                        resolve(result);
                                        return;
                                    }
                                } catch (e) {
                                    console.warn('解析流式数据失败:', e, dataStr);
                                }
                            }
                        }

                        readStream();
                    }).catch(err => {
                        if (err.name !== 'AbortError') {
                            reject(err);
                        }
                    });
                }

                readStream();
            })
            .catch(error => {
                clearTimeout(timeoutId);
                if (error.name === 'AbortError') {
                    reject(new Error(`工作流 ${workflowName} 执行超时，请稍后重试`));
                } else {
                    reject(error);
                }
            });
        });
    }

    window.WorkflowAPI = {
        invoke,
        invokeStream,
        getMarketSentimentInit,
        setUseMock(flag) {
            config.useMock = Boolean(flag);
        },
        setEndpoint(url) {
            config.endpoint = url;
        },
        setAsyncEndpoints(startUrl, statusUrl) {
            if (startUrl) config.startEndpoint = startUrl;
            if (statusUrl) config.statusEndpoint = statusUrl;
        },
        get config() {
            return { ...config };
        }
    };
})();
