# docs/ 素材说明

README 里引用的截图与 GIF 放在这里。

## 规范

- **命名**：按页面/功能，如 `overview.png`、`daily-split.png`、`files.png`、`chat-diff.png`、`palette-search.png`。
- **尺寸**：宽度 **1600px** 就够（GitHub 正文最大约 880px，2x 屏也清晰）；只截应用窗口，别带桌面背景。
- **体积**：单张 PNG ≤ **500KB**；GIF ≤ **5MB**（再大 README 打开会明显卡）。
- **GIF 参数**：fps **10**、宽 **900**、时长 **8–12 秒**，用调色板两步法压缩：

  ```bash
  ffmpeg -i demo.mp4 -vf "fps=10,scale=900:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" demo.gif
  ```

- **不想让仓库变重**：把 GIF 拖到任意 issue / PR 的评论框上传，复制生成的
  `https://user-images.githubusercontent.com/...` 链接直接贴进 README——仓库不会增加体积，
  代价是素材挂在 GitHub 的 CDN 上（链接别删）。

## 引用写法

```markdown
![概览](docs/overview.png)                              <!-- 单张 -->

<img src="docs/overview.png" width="470" alt="概览">     <!-- 控宽 -->

| 概览 | 每日总结 |                                       <!-- 并排 -->
| --- | --- |
| <img src="docs/overview.png" width="470"> | <img src="docs/daily-split.png" width="470"> |
```

## 与应用图标无关

应用 / 安装程序的图标由 `packages/desktop/scripts/make-icons.mjs` 生成到
`packages/desktop/build/`（512 PNG + 多尺寸 ICO + NSIS 侧栏/头部 BMP），改品牌色后重跑即可。
