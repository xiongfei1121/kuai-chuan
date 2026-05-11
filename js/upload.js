/**
 * 上传模块
 */

const Upload = {
    currentFile: null,
    isUploading: false,
    uploadStartTime: null,
    lastUploadedBytes: 0,
    lastUpdateTime: null,
    speedHistory: [],
    uploadedBytes: 0, // 已上传的总字节数

    // 分片上传配置
    CHUNK_SIZE: 10 * 1024 * 1024, // 10MB 每个分片
    MAX_RETRIES: 3, // 最大重试次数

    /**
     * 初始化上传模块
     */
    init() {
        this.bindEvents();
        this.checkUrlParams();
    },

    /**
     * 绑定事件
     */
    bindEvents() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const uploadBtn = document.getElementById('uploadBtn');
        const cancelFile = document.getElementById('cancelFile');
        const settingsToggle = document.getElementById('settingsToggle');
        const copyLink = document.getElementById('copyLink');
        const uploadAnother = document.getElementById('uploadAnother');

        // 点击上传区域
        uploadArea.addEventListener('click', () => fileInput.click());

        // 文件选择
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files[0]));

        // 拖拽上传
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) this.handleFileSelect(file);
        });

        // 上传按钮
        uploadBtn.addEventListener('click', () => this.uploadFile());

        // 取消文件
        cancelFile.addEventListener('click', () => this.resetUpload());

        // 高级设置切换
        settingsToggle.addEventListener('click', () => {
            const content = document.getElementById('settingsContent');
            const isHidden = content.style.display === 'none';
            content.style.display = isHidden ? 'block' : 'none';
            settingsToggle.classList.toggle('active', isHidden);
        });

        // 复制链接
        copyLink.addEventListener('click', () => {
            const link = document.getElementById('shareLink').value;
            Utils.copyToClipboard(link);
        });

        // 继续上传
        uploadAnother.addEventListener('click', () => this.resetUpload());
    },

    /**
     * 检查 URL 参数
     */
    checkUrlParams() {
        const fileId = Utils.getUrlParam('id');
        if (fileId) {
            document.getElementById('downloadCode').value = fileId;
            Download.loadFileInfo(fileId);
        }
    },

    /**
     * 处理文件选择
     */
    handleFileSelect(file) {
        if (!file) return;

        if (!Utils.isFileSizeValid(file.size)) {
            Utils.showToast('文件大小超过 25GB 限制', 'error');
            return;
        }

        this.currentFile = file;

        document.getElementById('fileName').textContent = file.name;
        document.getElementById('fileSize').textContent = Utils.formatSize(file.size);
        document.getElementById('fileInfo').style.display = 'flex';
        document.getElementById('uploadBtn').style.display = 'block';
        document.getElementById('uploadArea').style.display = 'none';
    },

    /**
     * 更新进度显示
     */
    updateProgress(loaded, total) {
        const now = Date.now();
        const percent = Math.round((loaded / total) * 100);

        document.getElementById('progressFill').style.width = percent + '%';
        document.getElementById('progressPercent').textContent = percent + '%';
        document.getElementById('progressUploaded').textContent = 
            Utils.formatSize(loaded) + ' / ' + Utils.formatSize(total);

        if (this.lastUpdateTime && this.lastUploadedBytes) {
            const timeDiff = (now - this.lastUpdateTime) / 1000;
            const bytesDiff = loaded - this.lastUploadedBytes;
            const currentSpeed = bytesDiff / timeDiff;

            this.speedHistory.push({ time: now, speed: currentSpeed });
            if (this.speedHistory.length > 10) {
                this.speedHistory.shift();
            }

            const avgSpeed = this.speedHistory.reduce((sum, item) => sum + item.speed, 0) / this.speedHistory.length;
            
            document.getElementById('progressSpeed').textContent = Utils.formatSize(avgSpeed) + '/s';

            if (avgSpeed > 0) {
                const remainingBytes = total - loaded;
                const remainingSeconds = remainingBytes / avgSpeed;
                document.getElementById('progressTime').textContent = this.formatTime(remainingSeconds);
            }
        }

        this.lastUpdateTime = now;
        this.lastUploadedBytes = loaded;
    },

    /**
     * 格式化时间
     */
    formatTime(seconds) {
        if (seconds < 60) {
            return Math.round(seconds) + ' 秒';
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            const secs = Math.round(seconds % 60);
            return minutes + ' 分 ' + secs + ' 秒';
        } else {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            return hours + ' 小时 ' + minutes + ' 分';
        }
    },

    /**
     * 上传文件（自动选择单次上传或分片上传）
     */
    async uploadFile() {
        if (!this.currentFile || this.isUploading) return;

        this.isUploading = true;
        const file = this.currentFile;

        this.uploadStartTime = Date.now();
        this.lastUploadedBytes = 0;
        this.lastUpdateTime = null;
        this.speedHistory = [];
        this.uploadedBytes = 0;

        document.getElementById('uploadBtn').style.display = 'none';
        document.getElementById('uploadProgress').style.display = 'block';
        document.getElementById('progressStatus').textContent = '正在初始化上传...';

        try {
            // 初始化上传
            const initRes = await API.initUpload(
                file.name,
                Utils.getMimeType(file),
                file.size
            );

            if (!initRes.success) {
                throw new Error(initRes.error || '初始化失败');
            }

            const r2Key = initRes.r2_key;

            // 根据文件大小选择上传方式
            if (file.size > this.CHUNK_SIZE) {
                // 大文件：分片上传
                await this.uploadMultipart(file, r2Key, initRes.upload_url);
            } else {
                // 小文件：单次上传
                await this.uploadSingle(file, r2Key, initRes.upload_url);
            }

            // 确认上传
            document.getElementById('progressStatus').textContent = '正在确认上传...';
            document.getElementById('progressSpeed').textContent = '--';
            document.getElementById('progressTime').textContent = '--';
            
            const confirmRes = await API.confirmUpload(
                file.name,
                file.size,
                Utils.getMimeType(file),
                r2Key
            );

            if (!confirmRes.success) {
                throw new Error(confirmRes.error || '确认失败');
            }

            // 应用高级设置
            const fileId = confirmRes.file.id;
            const ownerToken = confirmRes.owner_token;
            const password = document.getElementById('password').value;
            const expiryDays = parseInt(document.getElementById('expiryDays').value);
            const maxDownloads = document.getElementById('maxDownloads').value;

            if (password) {
                document.getElementById('progressStatus').textContent = '正在设置密码...';
                await API.setFilePassword(fileId, password, ownerToken);
            }

            if (expiryDays !== 3) {
                document.getElementById('progressStatus').textContent = '正在设置过期时间...';
                await API.setFileExpiry(fileId, expiryDays, ownerToken);
            }

            if (maxDownloads) {
                document.getElementById('progressStatus').textContent = '正在设置下载限制...';
                await API.setFileMaxDownloads(fileId, parseInt(maxDownloads), ownerToken);
            }

            // 显示成功
            this.showSuccess(confirmRes.file, ownerToken);

            History.addUpload({
                id: fileId,
                filename: file.name,
                size: file.size,
                uploaded_at: new Date().toISOString(),
                owner_token: ownerToken,
                url: confirmRes.file.url
            });

            Utils.showToast('上传成功！', 'success');

        } catch (error) {
            console.error('上传失败:', error);
            let errorMsg = error.message;
            if (errorMsg.includes("Too many uploads")) {
                errorMsg = "上传请求过多，请等待 30 秒后重试";
            }
            Utils.showToast("上传失败: " + errorMsg, 'error');
            document.getElementById('uploadBtn').style.display = 'block';
            document.getElementById('uploadProgress').style.display = 'none';
        } finally {
            this.isUploading = false;
        }
    },

    /**
     * 单次上传（小文件）
     */
    async uploadSingle(file, r2Key, uploadUrl) {
        document.getElementById('progressStatus').textContent = '正在上传文件...';
        
        await API.uploadToR2(uploadUrl, file, (percent, loaded, total) => {
            this.updateProgress(loaded || (percent / 100 * file.size), total || file.size);
        });
    },

    /**
     * 分片上传（大文件）
     */
    async uploadMultipart(file, r2Key, firstPartUrl) {
        const totalChunks = Math.ceil(file.size / this.CHUNK_SIZE);
        const parts = [];

        document.getElementById('progressStatus').textContent = `正在上传文件 (0/${totalChunks} 分片)...`;

        // 上传第一个分片
        const firstPartBlob = file.slice(0, this.CHUNK_SIZE);
        const firstPartResult = await this.uploadPartWithRetry(firstPartUrl, firstPartBlob, 0);
        parts.push({ part_number: 1, etag: firstPartResult.etag });
        this.uploadedBytes = Math.min(this.CHUNK_SIZE, file.size);
        this.updateProgress(this.uploadedBytes, file.size);

        // 如果有多个分片，获取剩余分片的上传 URL
        if (totalChunks > 1) {
            const partsRes = await API.getUploadParts(r2Key, totalChunks - 1);
            
            if (!partsRes.success) {
                throw new Error(partsRes.error || '获取分片URL失败');
            }

            // 上传剩余分片
            for (let i = 1; i < totalChunks; i++) {
                const start = i * this.CHUNK_SIZE;
                const end = Math.min(start + this.CHUNK_SIZE, file.size);
                const chunkBlob = file.slice(start, end);
                const partUrl = partsRes.upload_urls[i - 1];

            document.getElementById('progressStatus').textContent = 
                `正在上传文件 (${i + 1}/${totalChunks} 分片)...`;
            
            // 显示分片进度
            const chunkProgress = document.getElementById('progressChunk');
            chunkProgress.style.display = 'block';
            chunkProgress.textContent = `当前分片: ${Utils.formatSize(chunkBlob.size)}`;

                const partResult = await this.uploadPartWithRetry(partUrl, chunkBlob, i);
                parts.push({ part_number: i + 1, etag: partResult.etag });

                this.uploadedBytes = end;
                this.updateProgress(this.uploadedBytes, file.size);
            }
        }

        // 完成分片上传
        document.getElementById('progressStatus').textContent = '正在合并分片...';
        const completeRes = await API.completeMultipartUpload(r2Key, parts);

        if (!completeRes.success) {
            throw new Error(completeRes.error || '合并分片失败');
        }
    },

    /**
     * 带重试的分片上传
     */
    async uploadPartWithRetry(url, blob, partIndex, retryCount = 0) {
        try {
            return await API.uploadPartToR2(url, blob, (loaded, total) => {
                // 更新当前分片的进度
                const currentPartProgress = loaded;
                const totalUploaded = this.uploadedBytes - blob.size + currentPartProgress;
                this.updateProgress(totalUploaded, this.currentFile.size);
            });
        } catch (error) {
            if (retryCount < this.MAX_RETRIES) {
                console.warn(`分片 ${partIndex + 1} 上传失败，重试 ${retryCount + 1}/${this.MAX_RETRIES}`);
                await this.sleep(2000); // 等待2秒后重试
                return this.uploadPartWithRetry(url, blob, partIndex, retryCount + 1);
            } else {
                throw new Error(`分片 ${partIndex + 1} 上传失败: ${error.message}`);
            }
        }
    },

    /**
     * 休眠函数
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * 显示上传成功
     */
    showSuccess(file, ownerToken) {
        document.getElementById('uploadProgress').style.display = 'none';
        document.getElementById('fileInfo').style.display = 'none';
        document.getElementById('uploadSuccess').style.display = 'block';

        const shareLink = document.getElementById('shareLink');
        shareLink.value = file.url;

        Utils.generateQRCode(file.url, document.getElementById('shareQrcode'));
    },

    /**
     * 重置上传
     */
    resetUpload() {
        this.currentFile = null;
        this.isUploading = false;
        this.uploadStartTime = null;
        this.lastUploadedBytes = 0;
        this.lastUpdateTime = null;
        this.speedHistory = [];
        this.uploadedBytes = 0;

        document.getElementById('fileInput').value = '';
        document.getElementById('uploadArea').style.display = 'block';
        document.getElementById('fileInfo').style.display = 'none';
        document.getElementById('uploadBtn').style.display = 'none';
        document.getElementById('uploadProgress').style.display = 'none';
        document.getElementById('uploadSuccess').style.display = 'none';
        document.getElementById('progressFill').style.width = '0%';
        document.getElementById('progressPercent').textContent = '0%';
        document.getElementById('progressUploaded').textContent = '0 B / 0 B';
        document.getElementById('progressSpeed').textContent = '计算中...';
        document.getElementById('progressTime').textContent = '计算中...';

        document.getElementById('password').value = '';
        document.getElementById('expiryDays').value = '3';
        document.getElementById('maxDownloads').value = '';
    }
};
