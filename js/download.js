/**
 * 下载模块
 */

const Download = {
    currentFileId: null,
    needsPassword: false,

    /**
     * 初始化下载模块
     */
    init() {
        this.bindEvents();
    },

    /**
     * 绑定事件
     */
    bindEvents() {
        const downloadBtn = document.getElementById('downloadBtn');
        const verifyPassword = document.getElementById('verifyPassword');
        const startDownload = document.getElementById('startDownload');

        // 下载按钮
        downloadBtn.addEventListener('click', () => {
            const code = document.getElementById('downloadCode').value.trim();
            if (code) {
                this.loadFileInfo(code);
            } else {
                Utils.showToast('请输入分享码', 'error');
            }
        });

        // 验证密码
        verifyPassword.addEventListener('click', () => {
            const password = document.getElementById('downloadPassword').value;
            if (password) {
                this.verifyPassword(password);
            } else {
                Utils.showToast('请输入密码', 'error');
            }
        });

        // 开始下载
        startDownload.addEventListener('click', () => {
            this.startDownload();
        });

        // 回车键触发
        document.getElementById('downloadCode').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                downloadBtn.click();
            }
        });

        document.getElementById('downloadPassword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                verifyPassword.click();
            }
        });
    },

    /**
     * 加载文件信息
     * @param {string} fileId - 文件 ID
     */
    async loadFileInfo(fileId) {
        this.currentFileId = fileId;

        try {
            Utils.showToast('正在获取文件信息...', 'info');

            // 尝试访问文件页面获取信息
            // storage.to 没有直接的文件信息 API，我们需要通过下载页面获取
            // 这里我们直接跳转到 storage.to 的下载页面

            const downloadUrl = `https://storage.to/${fileId}`;

            // 在新窗口打开
            window.open(downloadUrl, '_blank');

            Utils.showToast('已打开下载页面', 'success');

        } catch (error) {
            console.error('获取文件信息失败:', error);
            Utils.showToast('获取文件信息失败: ' + error.message, 'error');
        }
    },

    /**
     * 验证密码
     * @param {string} password - 密码
     */
    async verifyPassword(password) {
        if (!this.currentFileId) return;

        try {
            Utils.showToast('正在验证密码...', 'info');

            const result = await API.verifyFilePassword(this.currentFileId, password);

            if (result.success) {
                this.needsPassword = false;
                document.getElementById('passwordInput').style.display = 'none';
                document.getElementById('startDownload').style.display = 'block';
                Utils.showToast('密码验证成功', 'success');
            }
        } catch (error) {
            console.error('密码验证失败:', error);
            Utils.showToast('密码错误', 'error');
        }
    },

    /**
     * 开始下载
     */
    startDownload() {
        if (!this.currentFileId) return;

        const downloadUrl = `https://storage.to/${this.currentFileId}`;
        window.open(downloadUrl, '_blank');
    },

    /**
     * 重置下载
     */
    reset() {
        this.currentFileId = null;
        this.needsPassword = false;

        document.getElementById('downloadCode').value = '';
        document.getElementById('filePreview').style.display = 'none';
        document.getElementById('downloadPassword').value = '';
    }
};
