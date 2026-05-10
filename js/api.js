/**
 * storage.to API 封装模块
 */

const API = {
    baseUrl: 'https://storage.to/api',

    /**
     * 获取访客令牌
     * @returns {string} 访客令牌
     */
    getVisitorToken() {
        let token = localStorage.getItem('visitor_token');
        if (!token) {
            token = 'visitor_' + Utils.randomString(16);
            localStorage.setItem('visitor_token', token);
        }
        return token;
    },

    /**
     * 发送请求
     * @param {string} url - URL
     * @param {Object} options - 请求选项
     * @returns {Promise<Object>} 响应数据
     */
    async request(url, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            'X-Visitor-Token': this.getVisitorToken(),
            ...options.headers
        };

        const response = await fetch(url, {
            ...options,
            headers
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }

        return data;
    },

    /**
     * 初始化上传
     * @param {string} filename - 文件名
     * @param {string} contentType - MIME 类型
     * @param {number} size - 文件大小
     * @returns {Promise<Object>} 上传初始化数据
     */
    async initUpload(filename, contentType, size) {
        return this.request(`${this.baseUrl}/upload/init`, {
            method: 'POST',
            body: JSON.stringify({
                filename,
                content_type: contentType,
                size
            })
        });
    },

    /**
     * 上传文件到 R2
     * @param {string} url - 预签名 URL
     * @param {File} file - 文件对象
     * @param {Function} onProgress - 进度回调 (percent, loaded, total)
     * @returns {Promise<Object>} 上传结果
     */
    uploadToR2(url, file, onProgress) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.onprogress = (e) => {
                if (onProgress && e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    onProgress(percent, e.loaded, e.total);
                }
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve({
                        success: true,
                        etag: xhr.getResponseHeader('ETag')
                    });
                } else {
                    reject(new Error(`上传失败: ${xhr.status}`));
                }
            };

            xhr.onerror = () => reject(new Error('网络错误'));
            xhr.ontimeout = () => reject(new Error('上传超时'));

            xhr.open('PUT', url, true);
            xhr.timeout = 30 * 60 * 1000; // 30分钟超时
            xhr.send(file);
        });
    },

    /**
     * 确认上传
     * @param {string} filename - 文件名
     * @param {number} size - 文件大小
     * @param {string} contentType - MIME 类型
     * @param {string} r2Key - R2 键
     * @returns {Promise<Object>} 确认结果
     */
    async confirmUpload(filename, size, contentType, r2Key) {
        return this.request(`${this.baseUrl}/upload/confirm`, {
            method: 'POST',
            body: JSON.stringify({
                filename,
                size,
                content_type: contentType,
                r2_key: r2Key
            })
        });
    },

    /**
     * 获取文件状态
     * @param {string} fileId - 文件 ID
     * @returns {Promise<Object>} 文件状态
     */
    async getFileStatus(fileId) {
        return this.request(`${this.baseUrl}/file/${fileId}/status`);
    },

    /**
     * 设置文件密码
     * @param {string} fileId - 文件 ID
     * @param {string} password - 密码
     * @param {string} ownerToken - 所有者令牌
     * @returns {Promise<Object>} 设置结果
     */
    async setFilePassword(fileId, password, ownerToken) {
        return this.request(`${this.baseUrl}/file/${fileId}/password`, {
            method: 'POST',
            headers: {
                'X-Owner-Token': ownerToken
            },
            body: JSON.stringify({ password })
        });
    },

    /**
     * 设置文件过期时间
     * @param {string} fileId - 文件 ID
     * @param {number} days - 天数
     * @param {string} ownerToken - 所有者令牌
     * @returns {Promise<Object>} 设置结果
     */
    async setFileExpiry(fileId, days, ownerToken) {
        return this.request(`${this.baseUrl}/file/${fileId}/expiry`, {
            method: 'POST',
            headers: {
                'X-Owner-Token': ownerToken
            },
            body: JSON.stringify({ days })
        });
    },

    /**
     * 设置文件最大下载次数
     * @param {string} fileId - 文件 ID
     * @param {number} maxDownloads - 最大下载次数
     * @param {string} ownerToken - 所有者令牌
     * @returns {Promise<Object>} 设置结果
     */
    async setFileMaxDownloads(fileId, maxDownloads, ownerToken) {
        return this.request(`${this.baseUrl}/file/${fileId}/max-downloads`, {
            method: 'POST',
            headers: {
                'X-Owner-Token': ownerToken
            },
            body: JSON.stringify({ max_downloads: maxDownloads })
        });
    },

    /**
     * 删除文件
     * @param {string} fileId - 文件 ID
     * @param {string} ownerToken - 所有者令牌
     * @returns {Promise<Object>} 删除结果
     */
    async deleteFile(fileId, ownerToken) {
        return this.request(`${this.baseUrl}/file/${fileId}`, {
            method: 'DELETE',
            headers: {
                'X-Owner-Token': ownerToken
            }
        });
    },

    /**
     * 验证文件密码
     * @param {string} fileId - 文件 ID
     * @param {string} password - 密码
     * @returns {Promise<Object>} 验证结果
     */
    async verifyFilePassword(fileId, password) {
        return this.request(`${this.baseUrl}/file/${fileId}/verify-password`, {
            method: 'POST',
            body: JSON.stringify({ password })
        });
    },

    /**
     * 获取带宽状态
     * @returns {Promise<Object>} 带宽状态
     */
    async getBandwidthStatus() {
        return this.request(`${this.baseUrl}/bandwidth/status`);
    },

    /**
     * 健康检查
     * @returns {Promise<Object>} 健康状态
     */
    async healthCheck() {
        return this.request(`${this.baseUrl}/health`);
    }
};
