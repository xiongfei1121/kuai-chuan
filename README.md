# 老熊文件快递柜（快传）

基于 storage.to API 的网页版文件快传应用，支持最大 25GB 文件上传、密码保护、过期时间设置、阅后即焚等功能。

## 功能特性

- **文件上传**：拖拽/点击上传，支持最大 25GB 文件
- **文件下载**：输入分享码快速下载
- **上传历史**：本地存储上传记录
- **高级设置**：
  - 过期时间：1-7天
  - 密码保护：4-100字符
  - 阅后即焚：下载N次后自动删除

## 技术栈

- 纯前端：HTML + CSS + JavaScript
- API：storage.to REST API
- 部署：Cloudflare Pages

## 本地运行

1. 克隆仓库
```bash
git clone https://github.com/your-username/kuai-chuan.git
cd kuai-chuan
```

2. 启动本地服务器
```bash
# 使用 Python
python -m http.server 8080

# 或使用 Node.js
npx serve
```

3. 打开浏览器访问 `http://localhost:8080`

## 部署到 Cloudflare Pages

1. Fork 本仓库

2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)

3. 进入 Pages → Create a project → Connect to Git

4. 选择你 Fork 的仓库

5. 配置构建设置：
   - Project name: `kuai-chuan`
   - Production branch: `main`
   - Build command: (留空)
   - Build output directory: `/`

6. 点击 "Save and Deploy"

7. 绑定自定义域名（可选）：
   - 在项目设置中添加自定义域名
   - 例如：`file.081213.xyz`

## 项目结构

```
kuai-chuan/
├── index.html          # 主页面
├── css/
│   └── style.css       # 样式文件
├── js/
│   ├── app.js          # 主应用逻辑
│   ├── api.js          # storage.to API 封装
│   ├── upload.js       # 上传模块
│   ├── download.js     # 下载模块
│   ├── history.js      # 历史记录模块
│   └── utils.js        # 工具函数
├── assets/
│   └── favicon.ico     # 网站图标
└── README.md           # 项目说明
```

## API 文档

本项目使用 [storage.to REST API](https://storage.to/zh/docs/api)

### 主要接口

| 接口 | 说明 |
|------|------|
| POST /api/upload/init | 初始化上传 |
| POST /api/upload/confirm | 确认上传 |
| POST /api/file/{id}/password | 设置密码 |
| POST /api/file/{id}/expiry | 设置过期时间 |
| POST /api/file/{id}/max-downloads | 设置下载次数限制 |
| DELETE /api/file/{id} | 删除文件 |

## 限制说明

### storage.to 限制
- 单文件最大：25 GB
- 默认过期：3 天
- 匿名配额：每访客 100GB/天，每 IP 500GB/天

### 浏览器要求
- 支持现代浏览器（Chrome、Firefox、Safari、Edge）
- 需要支持 fetch API
- 需要支持 localStorage

## 开发计划

- [ ] 支持多文件上传
- [ ] 支持文件夹上传
- [ ] 支持集合（多个文件打包分享）
- [ ] 支持二维码扫描下载
- [ ] 支持暗黑模式
- [ ] 支持国际化

## 许可证

MIT License

## 致谢

- [storage.to](https://storage.to) - 提供免费的文件分享 API
- [Cloudflare Pages](https://pages.cloudflare.com/) - 提供免费的静态网站托管

---

**Powered by [storage.to](https://storage.to)**
