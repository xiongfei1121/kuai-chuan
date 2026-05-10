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
     * 更新进度显示
     * @param {number} loaded - 已上传字节数
     * @param {number} total - 总字节数
     */
    updateProgress(loaded, total) {
        const now = Date.now();
        const percent = Math.round((loaded / total) * 100);

        // 更新进度条
        document.getElementById('progressFill').style.width = percent + '%';
        document.getElementById('progressPercent').textContent = percent + '%';
        document.getElementById('progressUploaded').textContent = 
            `${Utils.formatSize(loaded)} / ${Utils.formatSize(total)}`;

        // 计算上传速度（使用最近3秒的平均速度）
        if (this.lastUpdateTime && this.lastUploadedBytes) {
            const timeDiff = (now - this.lastUpdateTime) / 1000; // 秒
            const bytesDiff = loaded - this.lastUploadedBytes;
            const currentSpeed = bytesDiff / timeDiff;

            // 保存速度历史（最近10个采样点）
            this.speedHistory.push({ time: now, speed: currentSpeed });
            if (this.speedHistory.length > 10) {
                this.speedHistory.shift();
            }

            // 计算平均速度
            const avgSpeed = this.speedHistory.reduce((sum, item) => sum + item.speed, 0) / this.speedHistory.length;
            
            // 显示速度
            document.getElementById('progressSpeed').textContent = Utils.formatSize(avgSpeed) + '/s';

            // 计算剩余时间
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
     * @param {number} seconds - 秒数
     * @returns {string} 格式化的时间
     */
    formatTime(seconds) {
        if (seconds < 60) {
            return Math.round(seconds) + ' 秒';
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            const secs = Math.round(seconds % 60);
            return `${minutes} 分 ${secs} 秒`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            return `${hours} 小时 ${minutes} 分`;
        }
    },

    /**
     * 上传文件
     */
    async uploadFile() {
        if (!this.currentFile || this.isUploading) return;

        this.isUploading = true;
        const file = this.currentFile;

        // 重置进度跟踪
        this.uploadStartTime = Date.now();
        this.lastUploadedBytes = 0;
        this.lastUpdateTime = null;
        this.speedHistory = [];

        // 显示进度
        document.getElementById('uploadBtn').style.display = 'none';
        document.getElementById('uploadProgress').style.display = 'block';
        document.getElementById('progressStatus').textContent = '正在初始化上传...';

        try {
            // 1. 初始化上传
            const initRes = await API.initUpload(
                file.name,
                Utils.getMimeType(file),
                file.size
            );

            if (!initRes.success) {
                throw new Error(initRes.error || '初始化失败');
            }

            // 2. 上传文件到 R2
            document.getElementById('progressStatus').textContent = '正在上传文件...';
            await API.uploadToR2(initRes.upload_url, file, (percent, loaded, total) => {
                this.updateProgress(loaded || (percent / 100 * file.size), total || file.size);
            });

            // 3. 确认上传
            document.getElementById('progressStatus').textContent = '正在确认上传...';
            document.getElementById('progressSpeed').textContent = '--';
            document.getElementById('progressTime').textContent = '--';
            
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
                document.getElementById('progressStatus').textContent = '正在设置密码...';
                await API.setFilePassword(fileId, password, ownerToken);
            }

            // 设置过期时间（如果不是默认的 3 天）
            if (
