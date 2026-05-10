/**
 * 历史记录模块
 */

const History = {
    STORAGE_KEY: 'upload_history',

    /**
     * 初始化历史记录模块
     */
    init() {
        this.render();
    },

    /**
     * 获取上传历史
     * @returns {Array} 上传历史列表
     */
    getUploads() {
        const data = localStorage.getItem(this.STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    },

    /**
     * 保存上传历史
     * @param {Array} uploads - 上传历史列表
     */
    saveUploads(uploads) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(uploads));
    },

    /**
     * 添加上传记录
     * @param {Object} upload - 上传记录
     */
    addUpload(upload) {
        const uploads = this.getUploads();
        uploads.unshift(upload); // 添加到开头

        // 最多保存 100 条记录
        if (uploads.length > 100) {
            uploads.pop();
        }

        this.saveUploads(uploads);
        this.render();
    },

    /**
     * 删除上传记录
     * @param {string} fileId - 文件 ID
     */
    removeUpload(fileId) {
        const uploads = this.getUploads();
        const index = uploads.findIndex(u => u.id === fileId);

        if (index !== -1) {
            uploads.splice(index, 1);
            this.saveUploads(uploads);
            this.render();
            Utils.showToast('已删除记录', 'success');
        }
    },

    /**
     * 删除文件（从 storage.to）
     * @param {string} fileId - 文件 ID
     * @param {string} ownerToken - 所有者令牌
     */
    async deleteFile(fileId, ownerToken) {
        if (!confirm('确定要删除这个文件吗？删除后无法恢复。')) {
            return;
        }

        try {
            Utils.showToast('正在删除文件...', 'info');

            const result = await API.deleteFile(fileId, ownerToken);

            if (result.success) {
                this.removeUpload(fileId);
                Utils.showToast('文件已删除', 'success');
            }
        } catch (error) {
            console.error('删除文件失败:', error);
            Utils.showToast('删除失败: ' + error.message, 'error');
        }
    },

    /**
     * 复制分享链接
     * @param {string} url - 分享链接
     */
    copyLink(url) {
        Utils.copyToClipboard(url);
    },

    /**
     * 渲染历史记录列表
     */
    render() {
        const container = document.getElementById('historyList');
        const uploads = this.getUploads();

        if (uploads.length === 0) {
            container.innerHTML = '<p class="empty-history">暂无上传记录</p>';
            return;
        }

        container.innerHTML = uploads.map(upload => `
            <div class="history-item" data-id="${upload.id}">
                <div class="history-info">
                    <div class="history-name">${this.escapeHtml(upload.filename)}</div>
                    <div class="history-meta">
                        ${Utils.formatSize(upload.size)} · 
                        ${Utils.formatDate(upload.uploaded_at)}
                    </div>
                </div>
                <div class="history-actions">
                    <button class="btn btn-secondary" onclick="History.copyLink('${upload.url}')">
                        复制链接
                    </button>
                    <button class="btn btn-danger" onclick="History.deleteFile('${upload.id}', '${upload.owner_token}')">
                        删除
                    </button>
                </div>
            </div>
        `).join('');
    },

    /**
     * HTML 转义
     * @param {string} text - 原始文本
     * @returns {string} 转义后的文本
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * 清空历史记录
     */
    clearAll() {
        if (!confirm('确定要清空所有上传记录吗？这不会删除已上传的文件。')) {
            return;
        }

        localStorage.removeItem(this.STORAGE_KEY);
        this.render();
        Utils.showToast('已清空历史记录', 'success');
    }
};
