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
    uploadedBytes: 0,

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

        uploadArea.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files[0]));

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

        uploadBtn.addEventListener('click', () => this.uploadFile());
        cancelFile.addEventListener('click', () => this.resetUpload());

        settingsToggle.addEventListener('click', () => {
            const content = document.getElementById('settingsContent');
            const isHidden = content.style.display === 'none';
            content.style.display = isHidden ? 'block' : 'none';
            settingsToggle.classList.toggle('active', isHidden);
        });

        copyLink.addEventListener('click', () => {
            const link = document.getElementById('shareLink').value;
            Utils.copyToClipboard(link);
        });

        uploadAnother.addEventListener('click', () => this.resetUpload());
    },

    checkUrlParams() {
        const fileId = Utils.getUrlParam('id');
        if (fileId) {
            document.getElementById('downloadCode').value = fileId;
            Download.loadFileInfo(fileId);
        }
    },

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
     * 上传文件
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
            // 1. 初始化上传
            console.log('初始化上传:', file.name, file.size);
            const initRes = await API.initUpload(
                file.name,
                Utils.getMimeType(file),
                file.size
            );

            if (!initRes.success) {
                throw new Error(initRes.error || '初始化失败');
            }

            console.log('初始化响应:', initRes);

            const r2Key = initRes.r2_key;
            let uploadId = null;
            let parts = [];

            // 2. 根据返回的 type 判断上传方式
            if (initRes.type === 'multipart') {
                // 分片上传
                uploadId = initRes.upload_id;
                parts = await this.uploadMultipart(file, initRes);
            } else {
                // 单次上传
                await this.uploadSingle(file, initRes.upload_url);
            }

            // 3. 确认上传
            document.getElementById('progressStatus').textContent = '正在确认上传...';
            document.getElementById('progressSpeed').textContent = '--';
            document.getElementById('progressTime').textContent = '--';
            
            console.log('确认上传...');
            const confirmRes = await API.confirmUpload(
                file.name,
                file.size,
                Utils.getMimeType(file),
                r2Key
            );

            if (!confirmRes.success) {
                throw new Error(confirmRes.error || '确认失败');
            }

            console.log('上传成功:', confirmRes);

            // 4. 应用高级设置
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
            
            // 友好的错误提示
            if (errorMsg.includes('Too many uploads')) {
                errorMsg = '上传请求过多，请等待 1 分钟后重试';
            } else if (errorMsg.includes('Failed to fetch') || errorMsg.includes('网络')) {
                errorMsg = '网络连接失败，请检查网络后重试';
            }
            
            Utils.showToast('上传失败: ' + errorMsg, 'error');
            document.getElementById('uploadBtn').style.display = 'block';
            document.getElementById('uploadProgress').style.display = 'none';
        } finally {
            this.isUploading = false;
        }
    },

    /**
     * 单次上传（小文件）
     */
    async uploadSingle(file, uploadUrl) {
        document.getElementById('progressStatus').textContent = '正在上传文件...';
        
        await API.uploadToR2(uploadUrl, file, (loaded, total) => {
            this.updateProgress(loaded, total);
        });
    },

    /**
     * 分片上传（大文件）
     */
    async uploadMultipart(file, initRes) {
        const uploadId = initRes.upload_id;
        const totalParts = initRes.total_parts;
        const initialUrls = initRes.initial_urls;
        const parts = [];

        document.getElementById('progressStatus').textContent = `正在上传文件 (0/${totalParts} 分片)...`;

        // 上传初始分片
        const initialPartNumbers = Object.keys(initialUrls).map(n => parseInt(n)).sort((a, b) => a - b);
        
        for (const partNum of initialPartNumbers) {
            const start = (partNum - 1) * initRes.part_size;
            const end = Math.min(start + initRes.part_size, file.size);
            const partBlob = file.slice(start, end);
            const partUrl = initialUrls[partNum];

            document.getElementById('progressStatus').textContent = 
                `正在上传文件 (${partNum}/${totalParts} 分片)...`;
            
            const chunkProgress = document.getElementById('progressChunk');
            chunkProgress.style.display = 'block';
            chunkProgress.textContent = `当前分片: ${Utils.formatSize(partBlob.size)}`;

            console.log(`上传分片 ${partNum}/${totalParts}, 大小: ${Utils.formatSize(partBlob.size)}`);
            
            const result = await API.uploadToR2(partUrl, partBlob, (loaded, total) => {
                const currentPartProgress = loaded;
                const totalUploaded = this.uploadedBytes + currentPartProgress;
                this.updateProgress(totalUploaded, file.size);
            });
            
            parts.push({ partNumber: partNum, etag: result.etag });
            this.uploadedBytes = end;
            console.log(`分片 ${partNum} 上传完成`);
        }

        // 如果需要更多分片 URL
        if (initialPartNumbers.length < totalParts) {
            const remainingPartNumbers = [];
            for (let i = 1; i <= totalParts; i++) {
                if (!initialUrls[i]) {
                    remainingPartNumbers.push(i);
                }
            }

            if (remainingPartNumbers.length > 0) {
                console.log('获取剩余分片 URL:', remainingPartNumbers);
                const partsRes = await API.getUploadParts(uploadId, remainingPartNumbers);
                
                if (!partsRes.success) {
                    throw new Error(partsRes.error || '获取分片URL失败');
                }

                // 上传剩余分片
                for (const partUrlObj of partsRes.part_urls) {
                    const partNum = partUrlObj.partNumber;
                    const start = (partNum - 1) * initRes.part_size;
                    const end = Math.min(start + initRes.part_size, file.size);
                    const partBlob = file.slice(start, end);

                    document.getElementById('progressStatus').textContent = 
                        `正在上传文件 (${partNum}/${totalParts} 分片)...`;
                    
                    const chunkProgress = document.getElementById('progressChunk');
                    chunkProgress.textContent = `当前分片: ${Utils.formatSize(partBlob.size)}`;

                    console.log(`上传分片 ${partNum}/${totalParts}`);
                    
                    const result = await API.uploadToR2(partUrlObj.url, partBlob, (loaded, total) => {
                        const currentPartProgress = loaded;
                        const totalUploaded = this.uploadedBytes + currentPartProgress;
                        this.updateProgress(totalUploaded, file.size);
                    });
                    
                    parts.push({ partNumber: partNum, etag: result.etag });
                    this.uploadedBytes = end;
                    console.log(`分片 ${partNum} 上传完成`);
                }
            }
        }

        // 完成分片上传
        document.getElementById('progressStatus').textContent = '正在合并分片...';
        document.getElementById('progressChunk').style.display = 'none';
        
        console.log('完成分片上传，合并分片...');
        const completeRes = await API.completeMultipartUpload(uploadId, parts);

        if (!completeRes.success) {
            throw new Error(completeRes.error || '合并分片失败');
        }
        
        console.log('分片合并完成');
        return parts;
    },

    showSuccess(file, ownerToken) {
        document.getElementById('uploadProgress').style.display = 'none';
        document.getElementById('fileInfo').style.display = 'none';
        document.getElementById('uploadSuccess').style.display = 'block';

        const shareLink = document.getElementById('shareLink');
        shareLink.value = file.url;

        Utils.generateQRCode(file.url, document.getElementById('shareQrcode'));
    },

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
        document.getElementById('progressChunk').style.display = 'none';

        document.getElementById('password').value = '';
        document.getElementById('expiryDays').value = '3';
        document.getElementById('maxDownloads').value = '';
    }
};
