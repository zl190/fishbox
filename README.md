# 摸鱼盒 · FishBox

上班摸鱼随手玩的小游戏盒子。装到桌面,离线可玩,数据只存在本机。

效用工具去 [pwa-toolbox](../pwa-toolbox)(出门花钱四件套);这里是玩具。两个盒子互不合并。

## 结构

单 shell + 自包含游戏,镜像 `pwa-toolbox` 的模式,多加一层**家族(family)**分组:

```
fishbox/
  index.html        # shell:读 games.json,按 family 分区渲染九宫格
  games.json        # 注册表:families[] + games[](game 带 family 字段)
  sw.js             # 盒子 launcher 的 SW(只缓存 shell)
  manifest.json     # 盒子 PWA manifest
  shared/
    grid-core.js    # 共享引擎:Grid + 可重放 RNG + 重力/补块
  games/
    match3/         # 消消乐·三连(交换凑三连,参考实现)
    lianliankan/    # 连连看(点两颗相同 + ≤2 拐弯通路)
  template/         # new-game.sh 的脚手架源
  new-game.sh       # 一键起新游戏
```

## 家族 = razor

盒子宽(摸鱼,啥休闲游戏都能进),但每个**货架**紧:

- **方块盒 · GridBox** — 一张网格 + 方块 + 消除/合并/配对。消消乐·三连 / 连连看(已上线)、
  2048 / 俄罗斯方块 / 合合乐(计划中),**共享 `grid-core.js` 一个引擎**(Grid + RNG +
  重力/补块;连连看另含通路寻路)。这一层有 razor + 复用内核,不会变杂物抽屉。
- 以后想加别的家族(反应类、蛇形类……),在 `games.json` 的 `families[]` 加一项,各自一个引擎。

## 加一个游戏

```sh
./new-game.sh g2048 "2048" "方向滑动,同数合并翻倍。"
# 把打印出的片段贴进 games.json 的 games[]
# 在 games/g2048/index.html 里基于 grid-core 写逻辑(参考 games/match3/)
```

## 部署

纯静态,GitHub Pages 从根目录发布即可(`.nojekyll` 已就位)。
本地预览:`python3 -m http.server 8123 --directory .`
