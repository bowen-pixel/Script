# v0.2.0 测试报告

日期：2026-10-28；本机macOS，官方Discord 0.0.419，Node.js 24.18.1、Python 3.13。

## 实机主题矩阵

| 包／来源 | 原包外观与平台 | Discord好友页结果 |
| --- | --- | --- |
| 初音 · 星海舞台，Joker Pan，ver_45a4cc93e550f629612c | dark / macOS | 图片加载、暗色适配、侧栏与页头映射通过；已查看实际截图 |
| ChatGPT Miku V2，M66Y，ver_f69b980d2265c7447ab5 | light / Windows | 图片加载、浅色文字与面板修正通过；已查看实际截图 |
| miku sakura，chen ni，ver_db296b90176d2f7dfce7 | light / Windows | 图片加载、浅色适配通过；已查看实际截图 |
| 内置My Discord Theme模板 | dark / 简化三文件目录 | 导入、选择、全新启动、图片和原生布局检查通过 |

图库来源：https://dreamskin.cc/gallery 。网页包按原包元数据记录；Windows包是素材与Safe CSS的适配测试，不是官方Discord兼容声明。

最终代码对上述四套主题再次执行实时theme-use及verify：所有主题image=loaded，nativeAppVisible=true，singleton=true，horizontalOverflow=false。页头、侧栏和好友主区域均成功识别。默认native viewport为1280×720；设备像素截图为2560×1440。

## 额外实机验证

- 浅色主题最初出现部分深色壳层文字与透明面板可读性问题；修正嵌套主题token、页头选择器与可读性层后重新截图验收。
- Discord页面reload后，后台重新注入并确认图片加载。
- 在960×800和1440×800 CSS像素视口检查：无横向溢出、原生主界面可见、装饰不拦截点击、单一主题层；随后清除测试视口覆盖。
- 手工构造一套图片无法解码的本机测试主题，theme-use失败；脚本恢复上一套配置，并由renderer确认旧图片加载。测试条目随后删除。
- 完整主题ZIP导出后重新导入成功；导入不自动切换活动主题。
- restore确认样式移除；restore --restart确认主题进程退出、从官方入口重开。最终会话记录已移除，测试后台停止。

## 自动化检查

`python3 tests/test_theme_packs.py`：13项通过，含多组攻击输入。

覆盖普通三文件包、单层包装目录、正式manifest、哈希不符、缺失／空CSS、未知文件、路径穿越、反斜杠路径、嵌套目录／归档、重复条目、重复JSON键、符号链接、条目上限、异常压缩比、非法颜色、图片媒体类型不匹配、受限CSS拒绝、真实sips解码、重复导入与不自动应用、导出后重新读取、失败不覆盖活动配置。

JS语法检查通过。测试还发现Mac的/var与/private/var路径别名会使旧入口判断不执行；已改用realpath比较，并由临时目录中的完整CLI测试覆盖。

## 尚未验证

- 原生UI控制服务启动失败。本次通过工具本身的本机CDP诊断和真实renderer截图验收，未自动点击账号的私人聊天、输入内容或发送消息。
- 聊天消息、输入框、弹窗有部件适配，但其实际交互、键盘焦点、语音、直播、系统全屏及多显示器仍需单独验收。
- 未找到明确SnowMiku／雪初音命名的当前图库包，因此没有声称测过SnowMiku。
- 不保证所有DreamSkin包逐像素还原；Codex专有部件与部分变量会跳过。任意CSS／JS主题不在导入范围内。
- 没有安装DreamSkin客户端或改动Codex，没有提交、推送或发布GitHub Release。

私人实机截图及完整本机证据位于工作目录的.local-evidence，未包含在分发ZIP中。

## v0.3.0 启动器增量验证

- 安装位置为个人Applications下的Discord Themes.app；数据迁移到独立Application Support目录，未复制旧会话。
- Node测试 `node --test tests/launcher.test.mjs`：16项通过。涵盖稳定ID选择、取消无副作用、普通模式重启确认、拒绝其他调试会话、导入不自动应用、在线分页、更新保存不切换、失败报告、照片不改活动配置、在线来源比较、七种原生菜单／文件框脚本编译及安装升级保留数据。
- 原有13项包验证回归通过。
- 临时安装／升级后codesign --verify --deep --strict通过；测试确认拒绝覆盖其他Bundle ID的应用。本机编译使用ad-hoc签名，不代表Developer ID认证或公证。
- 已安装应用的实际后端成功下载三套Miku并记录在线来源；下载前后活动配置哈希一致。实际联网更新检查识别三套均为当前版本，本地模板没有在线来源。
- 已安装应用后端实际启动Discord，确认图片加载、单例主题层及原生界面可见；从暗色舞台切到浅色Miku V2成功，再完整恢复普通Discord。
- Finder启动应用成功；入口脚本已反编译核对。原生UI控制服务仍不可用，没有把控制器的预设输入测试当作全部原生点击验收。
