/**
 * storage.to API 封装模块
 */

const API = {
    baseUrl: 'https://storage.to/api',

    /**
     * 获取访客令牌
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
     * 上传单个分片到 R2
     */
    uploadPartToR2(url, partBlob, onProgress) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.onprogress = (e) => {
                if (onProgress && e.lengthComputable) {
                    onProgress(e.loaded, e.total);
                }
            };

            xhr.onload = () => {
                console.log(`分片上传完成，状态码: ${xhr.status}`);
                if (xhr.status >= 200 && xhr.status < 300) {
                    const etag = xhr.getResponseHeader('ETag');
                    console.log(`ETag: ${etag}`);
                    resolve({ success: true, etag: etag ? etag.replace(/"/g, '') : null });
                } else {
                    const error = `分片上传失败: ${xhr.status} ${xhr.statusText}`;
                    console.error(error);
                    reject(new Error(error));
                }
            };

            xhr.onerror = (e) => {
                console.error('分片上传网络错误:', e);
                reject(new Error('网络错误，请检查网络连接'));
            };
            
            xhr.ontimeout = () => {
                console.error('分片上传超时');
                reject(new Error('分片上传超时，请重试'));
            };

            xhr.open('PUT', url, true);
            xhr.timeout = 10 * 60 * 1000; // 10分钟超时（单个分片）
            
            console.log(`开始上传分片，大小: ${(partBlob.size / 1024 / 1024).toFixed(2)} MB`);
            xhr.send(partBlob);
        });
    },

    /**
     * 上传文件到 R2（单次上传，用于小文件）
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
     * 获取分片上传 URL
     */
    async getUploadParts(uploadId, partNumbers) {
        return this.request(`${this.baseUrl}/upload/parts`, {
            method: 'POST',
            body: JSON.stringify({
                upload_id: uploadId,
                part_numbers: partNumbers
            })
        });
    },

    /**
     * 完成分片上传
     */
    async completeMultipartUpload(uploadId, parts) {
        return this.request(`${this.baseUrl}/upload/complete-multipart`, {
            method: 'POST',
            body: JSON.stringify({
                upload_id: uploadId,
                parts: parts
            })
        });
    },

    /**
     * 中止上传
     */
    async abortUpload(uploadId) {
        return this.request(`${this.baseUrl}/upload/abort`, {
            method: 'POST',
            body: JSON.stringify({
                upload_id: uploadId
            })
        });
    },

    /**
     * 确认上传
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
     */
    async getFileStatus(fileId) {
        return this.request(`${this.baseUrl}/file/${fileId}/status`);
    },

    /**
     * 设置文件密码
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
     */
    async verifyFilePassword(fileId, password) {
        return this.request(`${this.baseUrl}/file/${fileId}/verify-password`, {
            method: 'POST',
            body: JSON.stringify({ password })
        });
    },

    /**
     * 获取带宽状态
     */
    async getBandwidthStatus() {
        return this.request(`${this.baseUrl}/bandwidth/status`);
    },

    /**
     * 健康检查
     */
    async healthCheck() {
        return this.request(`${this.baseUrl}/health`);
    }
};
