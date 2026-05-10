/**
 * 工具函数模块
 */

const Utils = {
    /**
     * 格式化文件大小
     * @param {number} bytes - 字节数
     * @returns {string} 格式化后的大小
     */
    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    /**
     * 格式化日期
     * @param {string} dateStr - 日期字符串
     * @returns {string} 格式化后的日期
     */
    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    /**
     * 显示 Toast 提示
     * @param {string} message - 提示消息
     * @param {string} type - 类型：success, error, info
     */
    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = 'toast show ' + type;

        setTimeout(() => {
            toast.className = 'toast';
        }, 3000);
    },

    /**
     * 复制文本到剪贴板
     * @param {string} text - 要复制的文本
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast('已复制到剪贴板', 'success');
        } catch (err) {
            // 降级方案
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.showToast('已复制到剪贴板', 'success');
        }
    },

    /**
     * 生成二维码
     * @param {string} text - 二维码内容
     * @param {HTMLElement} container - 容器元素
     */
    generateQRCode(text, container) {
        // 使用第三方二维码库（如果引入了）
        if (typeof QRCode !== 'undefined') {
            container.innerHTML = '';
            new QRCode(container, {
                text: text,
                width: 150,
                height: 150
            });
        } else {
            // 简单的二维码显示（使用 Google Chart API）
            const qrUrl = `https://chart.googleapis.com/chart?chs=150x150&cht=qr&chl=${encodeURIComponent(text)}&choe=UTF-8`;
            container.innerHTML = `<img src="${qrUrl}" alt="QR Code" style="border-radius: 8px;">`;
        }
    },

    /**
     * 获取文件 MIME 类型
     * @param {File} file - 文件对象
     * @returns {string} MIME 类型
     */
    getMimeType(file) {
        return file.type || 'application/octet-stream';
    },

    /**
     * 从 URL 获取参数
     * @param {string} name - 参数名
     * @returns {string|null} 参数值
     */
    getUrlParam(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    },

    /**
     * 防抖函数
     * @param {Function} func - 要执行的函数
     * @param {number} wait - 等待时间（毫秒）
     * @returns {Function} 防抖后的函数
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * 检查文件大小是否超过限制
     * @param {number} size - 文件大小（字节）
     * @param {number} maxSize - 最大大小（字节），默认 25GB
     * @returns {boolean} 是否超过限制
     */
    isFileSizeValid(size, maxSize = 25 * 1024 * 1024 * 1024) {
        return size <= maxSize;
    },

    /**
     * 生成随机字符串
     * @param {number} length - 长度
     * @returns {string} 随机字符串
     */
    randomString(length = 16) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
};
