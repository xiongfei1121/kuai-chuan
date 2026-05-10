/**
 * 上传模块
 */

const Upload = {
    currentFile: null,
    isUploading: false,

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
        // 可以从 URL 参数读取文件 ID 进行下载
        const fileId = Utils.getUrlParam('id');
        if (fileId) {
            document.getElementById('downloadCode').value = fileId;
            Download.loadFileInfo(fileId);
        }
    },

    /**
     * 处理文件选择
     * @param {File} file - 文件对象
     */
    handleFileSelect(file) {
        if (!file) return;

        // 检查文件大小
        if (!Utils.isFileSizeValid(file.size)) {
            Utils.showToast('文件大小超过 25GB 限制', 'error');
            return;
        }

        this.currentFile = file;

        // 显示文件信息
        document.getElementById('fileName').textContent = file.name;
        document.getElementById('fileSize').textContent = Utils.formatSize(file.size);
        document.getElementById('fileInfo').style.display = 'flex';
        document.getElementById('uploadBtn').style.display = 'block';
        document.getElementById('uploadArea').style.display = 'none';
    },

    /**
     * 上传文件
     */
    async uploadFile() {
        if (!this.currentFile || this.isUploading) return;

        this.isUploading = true;
        const file = this.currentFile;

        // 显示进度
        document.getElementById('uploadBtn').style.display = 'none';
        document.getElementById('uploadProgress').style.display = 'block';

        try {
            // 1. 初始化上传
            Utils.showToast('正在初始化上传...', 'info');
            const initRes = await API.initUpload(
                file.name,
                Utils.getMimeType(file),
                file.size
            );

            if (!initRes.success) {
                throw new Error(initRes.error || '初始化失败');
            }

            // 2. 上传文件到 R2
            Utils.showToast('正在上传文件...', 'info');
            await API.uploadToR2(initRes.upload_url, file, (percent) => {
                document.getElementById('progressFill').style.width = percent + '%';
                document.getElementById('progressText').textContent = `上传中... ${percent}%`;
            });

            // 3. 确认上传
            Utils.showToast('正在确认上传...', 'info');
            const confirmRes = await API.confirmUpload(
                file.name,
                file.size,
                Utils.getMimeType(file),
                initRes.r2_key
            );

            if (!confirmRes.success) {
                throw new Error(confirmRes.error || '确认失败');
            }

            // 4. 应用高级设置
            const fileId = confirmRes.file.id;
            const ownerToken = confirmRes.owner_token;
            const password = document.getElementById('password').value;
            const expiryDays = parseInt(document.getElementById('expiryDays').value);
            const maxDownloads = document.getElementById('maxDownloads').value;

            // 设置密码
            if (password) {
                await API.setFilePassword(fileId, password, ownerToken);
            }

            // 设置过期时间（如果不是默认的 3 天）
            if (expiryDays !== 3) {
                await API.setFileExpiry(fileId, expiryDays, ownerToken);
            }

            // 设置最大下载次数
            if (maxDownloads) {
                await API.setFileMaxDownloads(fileId, parseInt(maxDownloads), ownerToken);
            }

            // 5. 显示成功信息
            this.showSuccess(confirmRes.file, ownerToken);

            // 6. 保存到历史记录
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
            Utils.showToast('上传失败: ' + error.message, 'error');
            document.getElementById('uploadBtn').style.display = 'block';
            document.getElementById('uploadProgress').style.display = 'none';
        } finally {
            this.isUploading = false;
        }
    },

    /**
     * 显示上传成功
     * @param {Object} file - 文件信息
     * @param {string} ownerToken - 所有者令牌
     */
    showSuccess(file, ownerToken) {
        document.getElementById('uploadProgress').style.display = 'none';
        document.getElementById('fileInfo').style.display = 'none';
        document.getElementById('uploadSuccess').style.display = 'block';

        const shareLink = document.getElementById('shareLink');
        shareLink.value = file.url;

        // 生成二维码
        Utils.generateQRCode(file.url, document.getElementById('shareQrcode'));
    },

    /**
     * 重置上传
     */
    resetUpload() {
        this.currentFile = null;
        this.isUploading = false;

        document.getElementById('fileInput').value = '';
        document.getElementById('uploadArea').style.display = 'block';
        document.getElementById('fileInfo').style.display = 'none';
        document.getElementById('uploadBtn').style.display = 'none';
        document.getElementById('uploadProgress').style.display = 'none';
        document.getElementById('uploadSuccess').style.display = 'none';
        document.getElementById('progressFill').style.width = '0%';
        document.getElementById('progressText').textContent = '上传中... 0%';

        // 重置高级设置
        document.getElementById('password').value = '';
        document.getElementById('expiryDays').value = '3';
        document.getElementById('maxDownloads').value = '';
    }
};
