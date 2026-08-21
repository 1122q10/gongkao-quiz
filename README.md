# 公考刷题本

一个本地优先、可部署到 GitHub Pages 的公考资料整理和刷题工具。

## 已实现

- 分别导入题目文档、答案解析文档并按题号配对
- 支持 PDF、TXT、Markdown、JSON
- 单选、多选、判断、填空、简答题
- 导入预览与人工校对
- 作答后显示正确答案和解析
- 错题本、独立收藏夹、重刷
- 可从提纲生成并持续编辑的多级考点树
- 按考点统计正确率、专项练习和同类题练习
- 错题来源、错误次数、错因和个人笔记
- 浏览器本地存储，无服务器、无账号系统
- 手机和电脑自适应

## 使用

直接打开 `index.html`，或用任意静态文件服务器运行。PDF 读取使用 PDF.js CDN，因此首次读取 PDF 时需要联网。

也可以导入仓库中的 `sample-bank.json` 体验完整流程。

## 文档识别说明

普通文本 PDF 会在浏览器本地提取文字。程序按照“数字题号 + 选项字母”拆题，并从答案文档中按照题号配对答案和解析。由于不同资料排版差异很大，保存前会显示校对页面。

扫描图片型 PDF 暂不内置 OCR，需要先使用 OCR 软件生成带文本层的 PDF。后续版本计划加入扫描件识别、材料题图片保留和更强的版面分析。

## JSON 题库格式

```json
{
  "questions": [
    {
      "number": 1,
      "type": "single",
      "stem": "题干",
      "options": ["选项A", "选项B"],
      "answer": "A",
      "explanation": "解析"
    }
  ]
}
```

题型可用值：`single`、`multiple`、`judge`、`blank`、`short`。

## 致谢与设计参考

项目在产品设计层面参考了以下开源项目的公开功能说明：

- MYT6666/shuati-bao（MIT）
- 6wa1t/408-ai-tutor（MIT）
- tianyoudoge/quizpane（PolyForm Noncommercial）
- TJCookie/Examapp（未标注许可证，仅作功能调研）

本仓库代码为独立实现，没有复制未获许可项目的源代码。

## License

MIT
