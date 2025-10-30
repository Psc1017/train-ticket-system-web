# 高铁票价查询系统 - 部署指南

## Vercel 部署步骤

### 1. 注册 Vercel（无需GitHub）
- 访问 [vercel.com](https://vercel.com)
- 点击 "Sign Up"
- 使用邮箱注册账号（无需GitHub）

### 2. 创建新项目
- 点击 "New Project"
- 选择 "Import Git Repository" 或 "Upload Files"

### 3. 上传文件
- 将 `dist` 文件夹中的所有文件上传
- 确保 `index.html` 在根目录

### 4. 配置项目
- Project Name: `train-ticket-system`
- Framework Preset: `Other`
- Build Command: 留空（已构建）
- Output Directory: `dist`

### 5. 部署
- 点击 "Deploy"
- 等待部署完成（约1-2分钟）

### 6. 获得网址
- 部署成功后获得网址，如：`https://train-ticket-system.vercel.app`
- 可以自定义域名

## 生成二维码

### 在线工具
1. 访问 [qr-code-generator.com](https://www.qr-code-generator.com)
2. 选择 "URL" 类型
3. 输入你的 Vercel 网址
4. 生成并下载二维码

### 二维码内容示例
```
https://your-project-name.vercel.app
```

## 使用说明

### 实验参与者
1. 扫描二维码或访问网址
2. 在页面顶部输入参与者编号（如：张三、001）
3. 点击"保存"
4. 进行票价查询和购票
5. 查看购票记录

### 管理员
1. 访问"数据管理"页面
2. 可以导入数据、清空记录
3. 查看所有参与者的购票记录
4. 导出数据进行分析

## 技术特性

- **响应式设计**：支持手机、平板、电脑
- **离线存储**：使用 IndexedDB，数据保存在本地
- **实时更新**：购票记录实时同步
- **多用户支持**：每个参与者独立编号

## 注意事项

- 数据存储在用户浏览器中，清除浏览器数据会丢失记录
- 建议定期导出数据备份
- 支持千万级数据查询，性能优异
