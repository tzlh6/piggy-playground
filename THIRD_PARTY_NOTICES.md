# 第三方来源与许可

扫猪机制改编自 [kubowania/minesweeper](https://github.com/kubowania/minesweeper)，作者 Ania Kubow，MIT；完整许可位于 `desktop/app/assets/LICENSE-MIT.txt`。

猪猪造型参考 PigHub 的比例与气质重新绘制，未使用站内图片或表情包。统一可编辑来源是 `desktop/app/pig-art.js`。

四段录音猪叫剪辑自用户指定的 [原视频](https://www.bilibili.com/video/BV1gG4y1J7KP/)，原始版权归各自权利人，不属于本项目的 MIT 许可范围。相关文件保存在 `desktop/app/assets/`，构建时会内嵌到单文件网页。MIT 许可不代表已经取得这些录音的再利用授权。合成音效与合成猪叫由本项目代码在本地生成。

下文保留原源码说明中的固定提交、参考文件和改写用途。所列许可位于 `desktop/app/assets/licenses/`，桌面与单文件网页构建会随成品保留。

### 本轮 GitHub 参考与改写

以下均为 MIT 仓库，固定到实际阅读的提交；许可证副本保存在 `app/assets/licenses/` 并随桌面程序打包，单文件网页版的“关于与操作说明 → 来源与许可证”也内嵌五份完整许可。主要借鉴规则结构与处理方法，没有导入完整游戏、第三方角色图或音乐。

| 来源与固定版本 | 阅读的代码 | 在本项目中的应用 |
|---|---|---|
| [flashhawk/spp.js](https://github.com/flashhawk/spp.js/tree/2b4cc09a4d08a4a5cd8dd60229b27a8bffecc2ee/examples/fruitNinja) | `Collide.js`、`Module_blade.js`、`Module_collide.js` | 借鉴连续刀光轨迹与运动物体的相交判定；改为线段到圆心的最近距离，快速划过也能切中，并避免同一猪重复计分 |
| [egnaro9/match3-engine](https://github.com/egnaro9/match3-engine/tree/81404f3aed9e39b30941731731ac68df7a930c43) | `BoardEngine.java`、`BoardEngineExampleTest.java` | 改写双轴匹配扫描、交叉匹配合并、特殊猪几何与组合的处理思路；以独立编号保留猪的身份，使交换和重力轨迹可连续播放 |
| [ShaistaShabbir-prog/candy-crush-match3](https://github.com/ShaistaShabbir-prog/candy-crush-match3/tree/0ba0fcd4af6c041669ba67dd7f7bb6d9d268e4ec) | `index.html`、`js/special-candies.js` | 参考交换 → 清除 → 重力 → 再匹配的流程和特殊棋子提示；本项目按阶段保存画面快照，用真实位置差驱动动画，并接入统一暂停 |
| [alpiex1336-code/Rhythm-Game-v2](https://github.com/alpiex1336-code/Rhythm-Game-v2/tree/9de103a362058f400541aa3c8d4d13cca202fed0) | `script.js` 中的时钟、按下 / 松开和长按处理 | 借鉴音频时间锚点、长按首尾判定、暂停与偏移处理；使用本地合成旋律和原创三档谱面 |
| [selenebun/bullethell](https://github.com/selenebun/bullethell/tree/75173f8c37868ac7f30b886da6d28560e8e4418b) | `scripts/class/player.js`、`boss.js` | 借鉴斜向移动归一化、小判定点、慢移、受击无敌与首领弹幕阶段；加入猪猪角色、清弹护盾、补给和三关目标 |
