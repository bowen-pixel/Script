# Discord Mac：照片 + DreamSkin主题包

v0.3.0 · 2026-10-28 · 实验版

把自己的照片设为背景，或导入 [DreamSkin主题库](https://dreamskin.cc/gallery) 的主题ZIP。程序将背景、颜色、焦点与Safe CSS适配到Discord的原生界面；不修改官方安装包，不安装BetterDiscord，也不修改Codex。

## 推荐：双击启动器，不用每天开终端

首次解压后双击 **Install Discord Themes.command**。安装器会在你的个人Applications文件夹创建 **Discord Themes.app**。需要已安装Node.js 22+及Python 3.9+；安装后会记住它们的位置，不依赖GUI启动时的shell配置。

以后双击Discord Themes.app：

1. 选“选择主题并启动 Discord”。
2. 选一套已保存主题，或“继续上次主题”。
3. 如果普通Discord仍在运行，启动器会说明重开会中断语音等操作；确认后才重开。

同一菜单还能导入ZIP、用照片创建主题、搜索和下载在线主题、检查在线主题更新、导出当前主题、恢复普通Discord及打开主题文件夹。可以把应用拖到Dock，作为日常入口。

**在线更新**检查通过启动器在线下载的主题；ZIP／个人照片主题没有在线来源，更新时重新导入即可。更新先保存到库，不会自动替换当前画面。此功能更新主题内容，不是自动更新启动器代码。

启动器的库保存在 `~/Library/Application Support/Discord Theme Launcher`。首次安装会复制旧脚本库中尚未存在的主题与当前设置，不复制运行中的会话。重装启动器保留这个库。旧命令行脚本的隐藏库与启动器库之后独立使用，日常请在启动器里管理主题。

把工具发给朋友时发送完整ZIP，让朋友在自己的Mac运行安装器；不要直接复制本机编译、记住本机路径的.app。详细说明见 [LAUNCHER.md](LAUNCHER.md)。下面的命令行方式仍可使用。

## 第一次使用：按这个顺序

### 1. 解压并进入文件夹

终端输入 `cd `（末尾有空格），把解压后的 `Discord-Photo-Mac` 文件夹拖进终端，按回车。之后所有命令都在这个目录执行。

检查：

```bash
node -v
python3 --version
```

需要Node.js 22+。导入／导出主题包另需Python 3.9+；仅导入照片不需要Python。没有Node时从 [Node.js官网](https://nodejs.org/en/download)安装；没有Python时从 [Python官网](https://www.python.org/downloads/macos/)安装。无需npm install。

官方Discord应位于 `/Applications/Discord.app`。

### 2. 选择照片或导入主题，二选一

**自己的照片：**

```bash
node DiscordPhoto.mjs import
```

弹出Mac选图框。照片仅保存到本机，不上传图床。也可以在命令后直接给出带引号的图片路径。支持PNG/JPG/HEIC及系统可解码的WebP静态图；不支持动画GIF。原图最多12MiB、8192像素边长、2400万像素；长边超过2560像素会缩小，小图不会放大。

**主题ZIP：**

```bash
node DiscordPhoto.mjs theme-import
node DiscordPhoto.mjs themes
```

第一条弹出ZIP选择框；也可直接指定完整ZIP或可信三文件目录的路径：

```bash
node DiscordPhoto.mjs theme-import "/Users/你的名字/Downloads/主题.zip"
```

导入只保存，不自动换肤。根据themes输出的ID，选择要用的主题：

```bash
node DiscordPhoto.mjs theme-use hatsune-miku-cyan-stage
```

这里的ID是例子；必须先导入对应主题。

### 3. 完整退出Discord，再启动

先结束需要保留的语音、直播和未发送输入，在Discord按 **Command+Q**。只关闭窗口不算退出。

```bash
node DiscordPhoto.mjs start
node DiscordPhoto.mjs verify
```

等待主界面加载。正常检查包含image为loaded、nativeAppVisible为true、singleton为true、horizontalOverflow为false。再亲眼检查文字、背景、导航和弹窗。检查通过不等于全部页面已验收。

关闭终端后主题后台仍会运行。下次用照片主题时，从本文件夹执行start；完整退出后，从官方图标打开是普通模式。

## 直接下载本次测试的三套Miku主题

命令只从DreamSkin固定官方API下载，验证公开包大小和SHA-256后再检查ZIP、manifest和Safe CSS。下载成功仍不会自动应用。

```bash
# 深色：初音 · 星海舞台（Joker Pan）
node DiscordPhoto.mjs theme-fetch ver_45a4cc93e550f629612c

# 浅色：ChatGPT Miku V2（M66Y）
node DiscordPhoto.mjs theme-fetch ver_f69b980d2265c7447ab5

# 浅色：miku sakura（chen ni）
node DiscordPhoto.mjs theme-fetch ver_db296b90176d2f7dfce7
```

然后选择：

```bash
node DiscordPhoto.mjs theme-use hatsune-miku-cyan-stage
# 或
node DiscordPhoto.mjs theme-use chatgpt-miku-v2
# 或
node DiscordPhoto.mjs theme-use miku-sakura
```

后两套原包标注Windows，本工具只将其素材和受限样式适配到Mac Discord，**不代表原作者宣称支持Discord或macOS**。

网站地址也可传给theme-fetch，格式为 `https://dreamskin.cc/themes/ver_...`。其他网址、跳转下载和任意命令都不接受。网页按钮调用的dreamskin://协议仍属于原工具，本脚本不会接管它。

未在当前图库检索到明确名为SnowMiku／雪初音的包；没有把普通冬景或其他初音主题冒充SnowMiku。以后拿到符合格式的包，可直接theme-import。

## 调整、换照片、导出自己的主题

```bash
node DiscordPhoto.mjs set darkness 0.35
node DiscordPhoto.mjs set blur 6
node DiscordPhoto.mjs set position top
node DiscordPhoto.mjs set accent '#39e5e0'
```

- darkness：0–0.9，越大越暗。
- blur：0–30像素。
- position：center/top/bottom/left/right；设置后覆盖原主题焦点。
- 精细焦点：`set focusX 0.75`、`set focusY 0.45`，范围0–1。
- `set readability off`：关闭Discord可读性修正，尽量保留原包透明度。默认on，推荐保留。

再次import照片会替换当前背景，同时保留已经选择的主题风格。`info`查看当前照片与设置。活动会话里的theme-use会等待解码和布局检查；失败时尝试恢复上一套，并明确报告恢复是否确认。

导出自己的完整包：

```bash
node DiscordPhoto.mjs theme-export "./My-Discord-Theme.zip"
```

导出包含图片、theme.json、Safe CSS，以及当前遮罩／模糊／焦点等Discord设置。已存在的同名ZIP不会覆盖。可用theme-import重新导入，或将有权分享的主题包交给别人。

导出**不会上传或发布到网站**。包含其他作者素材时，遵循其许可证及角色／图片相关权利。

### 从模板制作自己的ZIP

`theme-template`内是一套可直接导入的中性渐变示例。将自己的PNG命名为background.png替换进去，修改theme.json里的id、name、颜色；需要时调整theme.css。把这三个文件放在ZIP根目录，或放在唯一一层主题文件夹中。也可不压缩，直接theme-import这个文件夹。

CSS使用 `[data-ds-part="sidebar"]` 等公开部件，只接受上游Safe CSS白名单。任意网页CSS、BetterDiscord CSS或JS插件不能直接当成这种主题包导入。

## 恢复与卸载

**只移除样式：**

```bash
node DiscordPhoto.mjs restore
```

然后Command+Q完整退出Discord，再点击官方图标打开，以关闭调试端口。

**一条命令完整退出主题实例并重开普通Discord：**

```bash
node DiscordPhoto.mjs restore --restart
```

这会中断当前语音等操作，先保存需要保留的内容。程序只操作经过身份核验的进程，不强制结束无法退出的实例。照片及主题库保留。

如果连接失败，Command+Q退出并从官方图标打开，也会清除临时注入。卸载时先完整恢复，再删除整个脚本文件夹。

## 支持范围与检查

- 适配背景、palette、appearance明暗、art.focusX/Y及可对应到Discord的Safe CSS部件。appearance:auto目前使用默认深色适配，不会修改账号的原生外观设置。
- Codex专有标题、推广链接、项目选择器及home-hero没有在Discord中伪造；找不到的部件会跳过。art.safeArea/taskMode及部分Codex专属变量没有逐项复刻。
- 原生好友页／首页已在实机截图验收；未自动点击私人聊天、发送消息或测试语音。消息、输入框和弹窗有适配代码，但本次没有完成这些页面的实机交互验收。
- Discord更新可能改变类名和样式。背景加载成功但仍被遮住，或控制不可用时，先restore并反馈版本、verify输出及截图。
- 不要同时启用其他Discord主题注入器。此方案非官方，受到[Discord服务条款](https://discord.com/terms)对客户端修改的限制。

ZIP限32MiB／32个条目／64MiB展开总量，背景最多10MiB。拒绝缺件、路径穿越、链接、重复路径、歧义根目录、未知文件、嵌套归档及异常压缩比例。正式manifest检查文件集合、媒体类型、字节数和SHA-256；manifest.sig不作为签名验证。支持截至DreamSkin 1.5.21的包合同。Safe CSS每次导入和应用时重新校验，不执行包内代码。

所有本机数据保存在 `.discord-photo-runtime`。程序不读取聊天正文或账号令牌；调试端口仅监听127.0.0.1，但本机其他进程仍可能连接它。完整退出调试实例才关闭端口。

可选截图命令：`node DiscordPhoto.mjs capture "./preview.png"`。截图可能包含好友、消息等私人内容，不要未经检查对外分享。

发给别人时发送干净ZIP；不要发送自己的隐藏运行目录、截图或日志。测试报告见TEST-REPORT.md，上游代码来源见NOTICE.md。

开发检查：

```bash
python3 tests/test_theme_packs.py
node --check DiscordPhoto.mjs
```
