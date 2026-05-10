/**
 * 主应用模块
 */

const App = {
    /**
     * 初始化应用
     */
    init() {
        console.log('老熊文件快递柜 - 初始化中...');

        // 初始化各模块
        Upload.init();
        Download.init();
        History.init();

        // 检查 API 健康状态
        this.checkAPIHealth();

        // 检查带宽状态
        this.checkBandwidth();

        console.log('老熊文件快递柜 - 初始化完成');
    },

    /**
     * 检查 API 健康状态
     */
    async checkAPIHealth() {
        try {
            const result = await API.healthCheck();
            if (result.status === 'healthy') {
                console.log('API 状态: 正常');
            } else {
                console.warn('API 状态:', result);
            }
        } catch (error) {
            console.error('API 健康检查失败:', error);
        }
    },

    /**
     * 检查带宽状态
     */
    async checkBandwidth() {
        try {
            const result = await API.getBandwidthStatus();
            if (result.success && !result.authenticated) {
                console.log(`上传配额: ${Utils.formatSize(result.remaining_bytes)} / ${Utils.formatSize(result.limit_bytes)}`);
            }
        } catch (error) {
            console.error('获取带宽状态失败:', error);
        }
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
