// ==UserScript==
// @name         获取发票号码
// @namespace    https://github.com/vigor-jzy/Scripts/edit/main/jd_fapiao_zhushou.js
// @version      1.1
// @description  展示对应发票号码到当前页的发票详情下方
// @author       vigor
// @match        https://myivc.jd.com/fpzz*
// @match        https://order.jd.com/center/list.action*
// @match        https://order.jd.com/center/search.action*
// @grant        GM_xmlhttpRequest
// @connect      *
// ==/UserScript==

(function() {
    'use strict';

    // --- 1. 样式定义 ---
    const style = document.createElement('style');
    style.innerHTML = `
        #my-extractor-btn {
            position: fixed; top: 20px; right: 10px; z-index: 9999;
            padding: 10px 15px; background: #007bff; color: white;
            border: none; border-radius: 5px; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            font-size: 14px;
        }
        #my-extractor-panel {
            position: fixed; top: 70px; right: 10px; z-index: 9999;
            width: 320px; padding: 15px; background: white; border: 1px solid #ccc;
            border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            display: none; flex-direction: column; gap: 10px; font-family: sans-serif;
        }
        #my-extractor-panel textarea {
            height: 200px; width: 100%; box-sizing: border-box;
            font-size: 12px; padding: 5px; border: 1px solid #ddd; border-radius: 4px;
        }
        #my-extractor-panel .btn-group { display: flex; gap: 10px; }
        .btn-match { background: #28a745; color: white; border: none; padding: 10px; cursor: pointer; flex: 2; border-radius: 4px; font-weight: bold; }
        .btn-close { background: #6c757d; color: white; border: none; padding: 10px; cursor: pointer; flex: 1; border-radius: 4px; }
        .extracted-info-p { margin: 5px 0; font-weight: bold; font-size: 13px; transition: all 0.3s; }
    `;
    document.head.appendChild(style);

    // --- 2. 工具函数 ---
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // --- 3. UI 创建 ---
    const btn = document.createElement('button');
    btn.id = 'my-extractor-btn';
    btn.innerText = '🔍 打开匹配面板';
    document.body.appendChild(btn);

    const panel = document.createElement('div');
    panel.id = 'my-extractor-panel';
    panel.innerHTML = `
        <div style="font-size:14px; font-weight:bold; margin-bottom:5px;">输入匹配字符串 (每行一个):</div>
        <textarea id="match-input" placeholder="请在这里粘贴多行字符串..."></textarea>
        <div class="btn-group">
            <button class="btn-match" id="start-match">🚀 执行匹配</button>
            <button class="btn-close" id="close-panel">关闭</button>
        </div>
    `;
    document.body.appendChild(panel);

    // --- 4. 交互逻辑：匹配与统计 ---
    btn.onclick = () => panel.style.display = 'flex';
    document.getElementById('close-panel').onclick = () => panel.style.display = 'none';

    document.getElementById('start-match').onclick = () => {
        const inputText = document.getElementById('match-input').value;
        const searchList = inputText.split('\n').map(s => s.trim()).filter(s => s.length > 0);
        const infoPs = document.querySelectorAll('.extracted-info-p');
        let matchCount = 0;

        infoPs.forEach(p => {
            const currentText = p.textContent.trim();
            if (searchList.includes(currentText)) {
                p.style.color = 'red';
                p.style.backgroundColor = '#fff0f0';
                matchCount++;
            } else {
                p.style.color = 'blue';
                p.style.backgroundColor = 'transparent';
            }
        });

        if (searchList.length === 0) {
            alert("请输入要匹配的内容！");
        } else {
            alert(`匹配完成！\n------------------\n输入待比对项：${searchList.length} 条\n成功匹配变红：${matchCount} 条`);
        }
    };

    // --- 5. 核心逻辑：异步提取数据 ---
    function fetchData(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: url,
                timeout: 10000,
                onload: (res) => resolve(res),
                onerror: (err) => reject(err)
            });
        });
    }

    async function startExtraction() {
        const operateDivs = document.querySelectorAll('div.operate');
        console.log(`[提取器] 找到 ${operateDivs.length} 个 operate 容器，准备过滤链接...`);

        for (const div of operateDivs) {
            // --- 修改点：在 div.operate 下寻找特定文本的 a 标签 ---
            const allAnchors = div.querySelectorAll('a');
            let targetAnchor = null;

            for (const a of allAnchors) {
                const text = a.textContent.trim();
                if (text.includes('发票详情') || text.includes('查看发票')) {
                    targetAnchor = a;
                    break; // 找到第一个符合条件的就跳出循环
                }
            }

            if (!targetAnchor || !targetAnchor.href) {
                console.log("[提取器] 未在当前 div 找到匹配文本的链接，跳过");
                continue;
            }

            const targetUrl = targetAnchor.href;

            try {
                const response = await fetchData(targetUrl);
                if (response.status === 200) {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(response.responseText, "text/html");

                    // 兼容拼写错误 calss
                    let targetTable = doc.querySelector('table.tb-void.tb-e-invoice') ||
                                     doc.querySelector('table[calss*="tb-void"]');

                    if (targetTable) {
                        const firstTd = targetTable.querySelector('tbody tr:first-child td:first-child');
                        if (firstTd) {
                            const content = firstTd.textContent.trim();

                            const pTag = document.createElement('p');
                            pTag.className = 'extracted-info-p';
                            pTag.textContent = content;
                            pTag.style.color = "blue";

                            div.insertAdjacentElement('afterend', pTag);
                        }
                    }
                }
            } catch (error) {
                console.error("请求失败:", targetUrl, error);
            }

            // 每次请求后固定延迟 500ms
            await sleep(500);
        }
        console.log("[提取器] 所有请求已完成");
    }

    // 执行
    if (document.readyState === 'complete') {
        startExtraction();
    } else {
        window.addEventListener('load', startExtraction);
    }

})();
