(function () {
    function initNav() {
        const views = {
            "view-home": document.getElementById("view-home"),
            "view-hotspot": document.getElementById("view-hotspot"),
            "view-strategy": document.getElementById("view-strategy"),
            "view-account": document.getElementById("view-account")
        };

        window.HomePage.render(views["view-home"]);
        window.HotspotPage.render(views["view-hotspot"]);
        window.StrategyPage.render(views["view-strategy"]);
        window.AccountPage.render(views["view-account"]);

        const navButtons = Array.from(document.querySelectorAll(".dock-btn"));
        const pageTitle = document.getElementById("pageTitle");
        const headerDesc = document.querySelector(".header-desc");
        const screenBody = document.querySelector(".screen-body");

        // 滚动时隐藏/显示描述文字
        function handleScroll() {
            if (screenBody.scrollTop > 20) {
                headerDesc.classList.add("hidden");
            } else {
                headerDesc.classList.remove("hidden");
            }
        }

        screenBody.addEventListener("scroll", handleScroll);

        navButtons.forEach((button) => {
            button.addEventListener("click", () => {
                const target = button.dataset.target;
                const title = button.dataset.title || "Emovest";

                Object.keys(views).forEach((key) => {
                    views[key].classList.toggle("active", key === target);
                });

                navButtons.forEach((btn) => btn.classList.toggle("active", btn === button));
                pageTitle.textContent = title;
                screenBody.scrollTo({ top: 0, behavior: "smooth" });
                // 重置描述文字显示状态
                headerDesc.classList.remove("hidden");
            });
        });
    }

    function initChat() {
        const btnEmovest = document.getElementById("btnEmovest");
        const chatModal = document.getElementById("chatModal");
        const chatClose = document.getElementById("chatClose");
        const chatMessages = document.getElementById("chatMessages");
        const chatForm = document.getElementById("chatForm");
        const chatInput = document.getElementById("chatInput");

        btnEmovest.addEventListener("click", () => {
            chatModal.classList.add("active");
            chatInput.focus();
            
            // 如果消息区域为空，添加默认欢迎消息和图标
            if (chatMessages.children.length === 0) {
                // 添加 Emovest 图标
                const iconDiv = document.createElement('div');
                iconDiv.className = 'emovest-welcome-icon';
                iconDiv.innerHTML = '<img src="Emovest.png" alt="Emovest" style="width: 70px; height: 70px; object-fit: contain;">';
                chatMessages.appendChild(iconDiv);
                
                const welcomeMessage = "你好呀，我是Emovest，今天想了解些什么呢？你可以问我近期市场热点，行业分析与相关基金推荐，或者当前持仓风险测评等相关内容哦〰";
                appendMessage(welcomeMessage, "ai welcome");
            }
        });

        chatClose.addEventListener("click", () => {
            chatModal.classList.remove("active");
        });

        chatModal.addEventListener("click", (event) => {
            if (event.target === chatModal) {
                chatModal.classList.remove("active");
            }
        });

        chatForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            const text = chatInput.value.trim();
            if (!text) return;

            appendMessage(text, "user");
            chatInput.value = "";

            const pending = appendMessage("Emovest 正在解析问题，请稍候...", "ai pending");

            try {
                // 调用 Emovestcharflow API（流式传输）
                const response = await fetch("/api/chatflow", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ message: text }),
                });

                if (!response.ok) {
                    // 尝试读取错误信息
                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();
                    let errorData = '';
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        errorData += decoder.decode(value, { stream: true });
                    }
                    try {
                        const errorJson = JSON.parse(errorData);
                        throw new Error(errorJson.error || "请求失败");
                    } catch (e) {
                        throw new Error(errorData || "请求失败");
                    }
                }

                // 处理流式响应
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let fullAnswer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n\n');
                    buffer = lines.pop() || ''; // 保留最后一个不完整的行

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const dataStr = line.slice(6);
                            if (dataStr === '[DONE]') {
                                // 流结束
                                if (fullAnswer) {
                                    pending.textContent = fullAnswer;
                                }
                                pending.classList.remove("pending");
                                return;
                            }

                            try {
                                const chunk = JSON.parse(dataStr);
                                
                                if (chunk.type === 'answer_chunk') {
                                    // 逐步追加内容
                                    fullAnswer += chunk.data;
                                    // 临时显示文本，最终会替换为 Markdown
                                    pending.textContent = fullAnswer || "正在思考...";
                                } else if (chunk.type === 'complete') {
                                    // 最终完整结果
                                    if (chunk.answer) {
                                        fullAnswer = chunk.answer;
                                    }
                                    // 移除 pending 类，重新渲染为 Markdown
                                    pending.classList.remove("pending");
                                    // 清空内容，重新渲染
                                    pending.textContent = '';
                                    pending.className = 'chat-bubble ai';
                                    if (typeof marked !== 'undefined') {
                                        marked.setOptions({
                                            breaks: true,
                                            gfm: true
                                        });
                                        const htmlContent = marked.parse(fullAnswer);
                                        pending.innerHTML = `<div class="chat-markdown">${htmlContent}</div>`;
                                        
                                        // 处理代码高亮
                                        if (typeof hljs !== 'undefined') {
                                            pending.querySelectorAll('pre code').forEach((block) => {
                                                hljs.highlightElement(block);
                                            });
                                        }
                                    } else {
                                        pending.textContent = fullAnswer;
                                    }
                                    chatMessages.scrollTop = chatMessages.scrollHeight;
                                    return;
                                } else if (chunk.type === 'error') {
                                    throw new Error(chunk.error || "发生错误");
                                }
                            } catch (e) {
                                if (e.message && e.message !== "Unexpected token") {
                                    throw e;
                                }
                                // 忽略 JSON 解析错误，继续处理
                            }
                        }
                    }
                }

                // 如果流结束但没有收到 complete 消息，使用已收集的内容
                if (fullAnswer) {
                    // 移除 pending 类，重新渲染为 Markdown
                    pending.classList.remove("pending");
                    pending.className = 'chat-bubble ai';
                    pending.textContent = '';
                    if (typeof marked !== 'undefined') {
                        marked.setOptions({
                            breaks: true,
                            gfm: true
                        });
                        const htmlContent = marked.parse(fullAnswer);
                        pending.innerHTML = `<div class="chat-markdown">${htmlContent}</div>`;
                        
                        // 处理代码高亮
                        if (typeof hljs !== 'undefined') {
                            pending.querySelectorAll('pre code').forEach((block) => {
                                hljs.highlightElement(block);
                            });
                        }
                    } else {
                        pending.textContent = fullAnswer;
                    }
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                } else {
                    pending.textContent = "响应不完整，请重试。";
                    pending.classList.remove("pending");
                }

            } catch (error) {
                pending.textContent = error?.message || "暂时无法连接到 Emovest，稍后再试试。";
                pending.classList.remove("pending");
                pending.classList.add("error");
            }
        });

        function appendMessage(content, role) {
            const bubble = document.createElement("div");
            bubble.className = `chat-bubble ${role}`;
            
            // 如果是 AI 的回答且不是 pending 状态，使用 Markdown 渲染
            if (role.includes('ai') && !role.includes('pending')) {
                if (typeof marked !== 'undefined') {
                    // 配置 marked 选项
                    marked.setOptions({
                        breaks: true,
                        gfm: true
                    });
                    const htmlContent = marked.parse(content);
                    bubble.innerHTML = `<div class="chat-markdown">${htmlContent}</div>`;
                    
                    // 处理代码高亮
                    if (typeof hljs !== 'undefined') {
                        bubble.querySelectorAll('pre code').forEach((block) => {
                            hljs.highlightElement(block);
                        });
                    }
                } else {
                    bubble.textContent = content;
                }
            } else {
                bubble.textContent = content;
            }
            
            chatMessages.appendChild(bubble);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            return bubble;
        }
    }

    async function initApp() {
        initNav();
        initChat();
        
        // 统一预加载市场情绪分析初始化数据，供首页、热点、策略三个页面共享
        // 这样三个页面只需要调用一次工作流，减少API调用次数
        try {
            console.log('应用启动：预加载市场情绪分析初始化数据...');
            await window.WorkflowAPI.getMarketSentimentInit();
            console.log('市场情绪分析初始化数据预加载完成');
        } catch (error) {
            console.warn('市场情绪分析初始化数据预加载失败，将在页面使用时重试:', error);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initApp);
    } else {
        initApp();
    }
})();
