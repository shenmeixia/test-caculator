# 整数在线计算器

支持任意大整数（`BigInt`）的加、减、乘、除运算，包含「商与余数 / 小数结果」切换、键盘快捷键、深浅色主题和本地计算历史记录。

## 文件结构

- `index.html`：页面结构与布局（使用 Tailwind CSS）
- `style.css`：自定义样式（按钮按压动画、滚动条、等宽数字）
- `app.js`：计算器核心逻辑、键盘事件与历史记录管理

## 发布到 GitHub Pages 步骤

1. 登录 GitHub，点击右上角 `+` -> **New repository**，新建一个 **Public** 仓库（例如 `integer-calculator`）。
2. 进入仓库后点击 **Add file** -> **Upload files**，将本目录下的 `index.html`、`style.css`、`app.js` 和 `README.md` 一起拖入上传，点击 **Commit changes**。
3. 进入仓库的 **Settings** -> **Pages**：
   - **Source** 选择 `Deploy from a branch`
   - **Branch** 选择 `main`，目录选择 `/ (root)`，点击 **Save**。
4. 等待 1–2 分钟后刷新 Pages 设置页，即可获得公开访问链接：`https://<你的用户名>.github.io/<仓库名>/`。

## 后期维护与加功能

- **修改界面布局**：编辑 `index.html`
- **调整外观样式**：编辑 `style.css`
- **新增计算功能**：编辑 `app.js`
- 每次修改并提交（Commit / Push）到 `main` 分支后，GitHub Pages 会自动重新部署更新。
