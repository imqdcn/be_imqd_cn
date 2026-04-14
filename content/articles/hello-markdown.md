---
title: Markdown 导入示例
slug: markdown-import-demo
description: 使用 Markdown + Frontmatter 导入 Strapi Article 的示例
excerpt: 这是一篇用于验证导入能力的示例文章。
contentType: long
author: 2
category: 1
tags: [1]
featured: true
pinned: false
isProtected: false
unlockTtlSeconds: 1800
publish: true
seo:
  metaTitle: Markdown 导入示例
  metaDescription: 通过脚本把 Markdown 一键导入 Strapi
---

# Markdown 导入演示

这篇文章用于演示如何通过脚本导入到 Strapi。

- Frontmatter 字段会映射到 Article schema
- 正文会写入 blocks 的 shared.rich-text
- 通过 slug 自动判断创建或更新
