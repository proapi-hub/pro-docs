# New API 核心 API 文档（面向自动化管理）

> 来源：Tavily 调研并压缩自 New API 官方文档（`https://doc.newapi.pro/api/`），面向用大模型 Agent 自动管理 New API 平台的高频场景。  
> 生成日期：2026-05-27。生产环境请使用 HTTPS。

## 目录树

```text
newapi-api-core-docs/
└── README.md
    ├── 00-快速约定
    ├── 01-鉴权体系
    ├── 02-平台自动化管理 API
    │   ├── 系统初始化与状态
    │   ├── 用户与账户
    │   ├── API Token
    │   ├── 渠道管理
    │   ├── 模型与倍率
    │   ├── 用量、日志与统计
    │   ├── 兑换码、分组、任务
    │   └── 配置与公开信息
    ├── 03-模型中继 API
    ├── 04-Agent 常用工作流
    ├── 05-官方来源
    └── 06-ProAPI 当前线上快照
```

## 00-快速约定

> 2026-05-27 更新：当前 ProAPI 线上文档站已同步真实分组与渠道快照。面向普通用户的最新说明请优先看站点内：
>
> - `/token/intro`：令牌与分组
> - `/token/channels`：当前渠道总览
> - `/api/overview`：API 调用总览
> - `/api/media`：音视频生成 API

基础地址：

```text
https://<your-newapi-domain>
```

通用请求头：

```http
Content-Type: application/json
Authorization: Bearer <token>
New-Api-User: <user_id>
```

两类 Token 要分清：

```text
用户 AccessToken：用于 /api 路由的平台管理接口，来自个人设置中的系统访问令牌。
API Key / sk：用于 /v1、/dashboard、/suno 等模型中继或兼容接口。
```

常见响应形态：

```json
{
  "success": true,
  "message": "",
  "data": {}
}
```

## 01-鉴权体系

官方文档将 `/api` 路由分为 4 级鉴权：

| 等级 | 用途 | 典型能力 |
| --- | --- | --- |
| 公开 | 不需要登录 | 注册、登录、系统状态、公告、OAuth 回调 |
| 用户 | 普通用户 AccessToken | 查看自己资料、创建 Token、查看自己的日志与任务 |
| 管理员 | 管理员 AccessToken | 用户管理、渠道管理、兑换码、全站日志与统计 |
| Root | Root AccessToken | 全局配置、模型倍率同步、敏感系统设置 |

安全建议：

- 自动化 Agent 使用最小权限 Token，不要把 Root Token 长期放在提示词或日志里。
- 对会修改状态的接口（`POST`、`PUT`、`DELETE`）先读后写，写入前生成计划。
- 批量删除、禁用渠道、重置倍率等动作应要求二次确认或在沙箱实例先执行。

## 02-平台自动化管理 API

### 系统初始化与状态

| 方法 | 路径 | 鉴权 | 用途 |
| --- | --- | --- | --- |
| `GET` | `/api/setup` | 公开 | 检查是否已完成初始化、数据库类型、Root 状态 |
| `POST` | `/api/setup` | 公开 | 首次安装向导，创建 Root 管理员 |
| `GET` | `/api/status` | 公开 | 获取运行状态、配置和功能开关摘要 |
| `GET` | `/api/uptime/status` | 公开 | Uptime-Kuma 兼容健康检查 |
| `GET` | `/api/status/test` | 管理员 | 测试后端与依赖组件健康度 |

### 用户与账户

公开接口：

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `POST` | `/api/user/register` | 注册新账号，支持邮箱验证和推荐码 |
| `POST` | `/api/user/login` | 用户登录，支持 2FA |
| `GET` | `/api/user/groups` | 列出所有分组 |
| `GET` | `/api/user/epay/notify` | Epay 支付回调 |

用户接口：

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/user/logout` | 退出登录 |
| `GET` | `/api/user/self` | 获取当前用户资料、配额、权限、设置 |
| `PUT` | `/api/user/self` | 修改个人资料或侧边栏设置 |
| `DELETE` | `/api/user/self` | 注销当前账号，Root 不可删除 |
| `GET` | `/api/user/self/groups` | 获取当前用户可用分组 |
| `GET` | `/api/user/models` | 获取当前用户可访问模型 |
| `GET` | `/api/user/token` | 生成用户级别 AccessToken |
| `GET` | `/api/user/aff` | 获取或生成推广码 |
| `POST` | `/api/user/topup` | 使用兑换码充值 |
| `POST` | `/api/user/pay` | 创建在线支付订单 |
| `POST` | `/api/user/amount` | 计算充值金额 |
| `POST` | `/api/user/aff_transfer` | 推广额度转可用配额 |
| `PUT` | `/api/user/setting` | 更新用户设置 JSON |

管理员用户管理：

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/user/` | 分页获取全部用户 |
| `GET` | `/api/user/search` | 按关键词、分组搜索用户 |
| `GET` | `/api/user/:id` | 获取单个用户详情 |
| `POST` | `/api/user/` | 创建用户 |
| `POST` | `/api/user/manage` | 启用、禁用、删除、提升、降级等管理操作 |
| `PUT` | `/api/user/` | 更新用户信息、配额等 |
| `DELETE` | `/api/user/:id` | 删除用户 |

用户对象常用字段：`id`、`username`、`display_name`、`role`（`1` 普通用户，`10` 管理员，`100` Root）、`status`、`email`、`group`、`quota`、`used_quota`、`request_count`、`permissions`。

### API Token

这些接口管理用户用于模型调用的 API Token。

| 方法 | 路径 | 鉴权 | 用途 |
| --- | --- | --- | --- |
| `GET` | `/api/token/` | 用户 | 分页获取当前用户全部 Token |
| `GET` | `/api/token/search` | 用户 | 搜索 Token |
| `GET` | `/api/token/:id` | 用户 | 获取单个 Token |
| `POST` | `/api/token/` | 用户 | 创建 Token，支持批量创建 |
| `PUT` | `/api/token/` | 用户 | 更新 Token，支持状态切换 |
| `DELETE` | `/api/token/:id` | 用户 | 删除指定 Token |
| `POST` | `/api/token/batch` | 用户 | 批量删除 Token |

创建/更新 Token 的关键字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `name` | string | Token 名称，最大长度 30 |
| `expired_time` | number | 过期时间戳，`-1` 表示永不过期 |
| `remain_quota` | number | 剩余配额 |
| `unlimited_quota` | boolean | 是否无限配额 |
| `model_limits_enabled` | boolean | 是否启用模型限制 |
| `model_limits` | string[] | 允许模型列表 |
| `allow_ips` | string | 允许 IP，逗号分隔 |
| `group` | string | 所属分组 |

示例：

```bash
curl -X POST "$BASE_URL/api/token/" \
  -H "Authorization: Bearer $USER_ACCESS_TOKEN" \
  -H "New-Api-User: $USER_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "agent-managed",
    "expired_time": -1,
    "remain_quota": 1000000,
    "unlimited_quota": false,
    "model_limits_enabled": true,
    "model_limits": ["gpt-4o-mini"],
    "allow_ips": "",
    "group": "default"
  }'
```

### 渠道管理

渠道是 AI 服务提供商配置，管理员接口覆盖增删改查、测试、余额、标签、模型同步。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/channel/` | 分页获取渠道，支持类型、状态、标签过滤 |
| `GET` | `/api/channel/search` | 按关键词、分组、模型搜索渠道 |
| `GET` | `/api/channel/models` | 获取所有渠道支持模型 |
| `GET` | `/api/channel/models_enabled` | 获取启用渠道支持模型 |
| `GET` | `/api/channel/:id` | 获取单个渠道详情，不含敏感密钥 |
| `GET` | `/api/channel/test` | 批量测试渠道连通性 |
| `GET` | `/api/channel/test/:id` | 测试单个渠道，可指定测试模型 |
| `GET` | `/api/channel/update_balance` | 批量刷新余额 |
| `GET` | `/api/channel/update_balance/:id` | 刷新单个渠道余额 |
| `POST` | `/api/channel/` | 新增渠道，支持单个、批量、多密钥模式 |
| `PUT` | `/api/channel/` | 更新渠道 |
| `DELETE` | `/api/channel/disabled` | 删除所有已禁用渠道 |
| `POST` | `/api/channel/tag/disabled` | 按标签批量禁用渠道 |
| `POST` | `/api/channel/tag/enabled` | 按标签批量启用渠道 |
| `PUT` | `/api/channel/tag` | 批量编辑标签渠道属性 |
| `DELETE` | `/api/channel/:id` | 硬删除指定渠道 |
| `POST` | `/api/channel/batch` | 批量删除渠道 |
| `POST` | `/api/channel/fix` | 修复渠道能力表 |
| `GET` | `/api/channel/fetch_models/:id` | 从单渠道上游拉取模型 |
| `POST` | `/api/channel/fetch_models` | 预览上游模型列表 |
| `POST` | `/api/channel/batch/tag` | 批量设置渠道标签 |
| `GET` | `/api/channel/tag/models` | 获取标签下模型数量最多的模型列表 |
| `POST` | `/api/channel/copy/:id` | 复制渠道 |

Agent 管理建议：

- 修改渠道前先 `GET /api/channel/:id` 保存旧配置摘要。
- 对新渠道先 `GET /api/channel/test/:id`，再启用给生产分组。
- 定期执行 `GET /api/channel/update_balance` 和 `GET /api/channel/models_enabled` 做健康巡检。

### 模型与倍率

| 方法 | 路径 | 鉴权 | 用途 |
| --- | --- | --- | --- |
| `GET` | `/api/models` | 用户 | 获取当前用户可访问模型，返回渠道 ID 到模型列表的映射 |
| `GET` | `/api/user/models` | 用户 | 获取模型可见性 |
| `GET` | `/api/ratio_config` | 公开 | 获取公开模型倍率配置 |
| `GET` | `/api/ratio_sync/channels` | Root | 获取可同步倍率的渠道列表 |
| `POST` | `/api/ratio_sync/fetch` | Root | 从上游渠道或自定义 URL 拉取倍率并对比 |
| `POST` | `/api/option/rest_model_ratio` | Root | 重置所有模型倍率到默认值 |

`GET /api/models` 成功时形如：

```json
{
  "success": true,
  "data": {
    "1": ["gpt-3.5-turbo", "gpt-4"],
    "2": ["claude-3-sonnet", "claude-3-haiku"]
  }
}
```

### 用量、日志与统计

Token 用量查询：

| 方法 | 路径 | 鉴权 | 用途 |
| --- | --- | --- | --- |
| `GET` | `/api/usage/token` | API Key | 查询当前 Bearer Token 的授予、已用、剩余、模型限制和到期时间 |

返回 `data` 常用字段：`object=token_usage`、`name`、`total_granted`、`total_used`、`total_available`、`unlimited_quota`、`model_limits`、`model_limits_enabled`、`expires_at`。

日志接口：

| 方法 | 路径 | 鉴权 | 用途 |
| --- | --- | --- | --- |
| `GET` | `/api/log/token` | 公开 | 通过 Token 密钥查询日志 |
| `GET` | `/api/log/self/stat` | 用户 | 当前用户日志统计，含配额、RPM、TPM |
| `GET` | `/api/log/self` | 用户 | 当前用户日志列表 |
| `GET` | `/api/log/self/search` | 用户 | 搜索当前用户日志 |
| `GET` | `/api/log/` | 管理员 | 全站日志列表 |
| `DELETE` | `/api/log/` | 管理员 | 删除指定时间戳前的历史日志 |
| `GET` | `/api/log/stat` | 管理员 | 全站日志统计 |
| `GET` | `/api/log/search` | 管理员 | 搜索全站日志 |

统计接口：

| 方法 | 路径 | 鉴权 | 用途 |
| --- | --- | --- | --- |
| `GET` | `/api/data/self` | 用户 | 当前用户用量按日期统计 |
| `GET` | `/api/data/` | 管理员 | 全站用量按日期统计，可按用户名过滤 |

OpenAI 兼容计费接口：

| 方法 | 路径 | 鉴权 | 用途 |
| --- | --- | --- | --- |
| `GET` | `/dashboard/billing/subscription` | 用户 Token | 订阅额度、总额度、硬限制、有效期 |
| `GET` | `/v1/dashboard/billing/subscription` | 用户 Token | OpenAI SDK 兼容路径 |
| `GET` | `/dashboard/billing/usage` | 用户 Token | 使用量信息 |
| `GET` | `/v1/dashboard/billing/usage` | 用户 Token | OpenAI SDK 兼容路径 |

### 兑换码、分组、任务

兑换码管理（管理员）：

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/redemption/` | 分页获取兑换码 |
| `GET` | `/api/redemption/search` | 搜索兑换码 |
| `GET` | `/api/redemption/:id` | 获取单个兑换码 |
| `POST` | `/api/redemption/` | 批量创建兑换码 |
| `PUT` | `/api/redemption/` | 更新兑换码，支持仅状态更新 |
| `DELETE` | `/api/redemption/invalid` | 删除已使用、禁用或过期兑换码 |
| `DELETE` | `/api/redemption/:id` | 删除指定兑换码 |

分组：

| 方法 | 路径 | 鉴权 | 用途 |
| --- | --- | --- | --- |
| `GET` | `/api/group/` | 管理员 | 获取全部分组名称 |
| `GET` | `/api/user/groups` | 公开 | 获取公开分组信息 |
| `GET` | `/api/user/self/groups` | 用户 | 获取当前用户可用分组及倍率描述 |

任务：

| 方法 | 路径 | 鉴权 | 用途 |
| --- | --- | --- | --- |
| `GET` | `/api/task/self` | 用户 | 获取当前用户任务列表 |
| `GET` | `/api/task/` | 管理员 | 获取全站任务列表 |
| `GET` | `/api/mj/self` | 用户 | 获取自己的 Midjourney 任务 |
| `GET` | `/api/mj/` | 管理员 | 获取全站 Midjourney 任务 |

### 配置、公开信息、邮箱与 OAuth

Root 配置：

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/option/` | 获取全局配置，过滤敏感 Token、Secret、Key |
| `PUT` | `/api/option/` | 更新单个全局配置项 |
| `POST` | `/api/option/rest_model_ratio` | 重置模型倍率 |
| `POST` | `/api/option/migrate_console_setting` | 迁移旧版控制台配置 |

公开信息：

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/notice` | 获取公告，支持 Markdown |
| `GET` | `/api/about` | 获取关于页面内容 |
| `GET` | `/api/home_page_content` | 获取首页自定义内容或 iframe URL |
| `GET` | `/api/pricing` | 获取模型定价、分组倍率、可用分组 |

邮箱：

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/verification` | 发送邮箱验证码，公开但限流 |
| `GET` | `/api/reset_password` | 发送重置密码邮件，公开但限流 |
| `POST` | `/api/user/reset` | 提交重置密码请求 |

OAuth：

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/oauth/github` | GitHub OAuth |
| `GET` | `/api/oauth/oidc` | 通用 OIDC |
| `GET` | `/api/oauth/linuxdo` | LinuxDo OAuth |
| `GET` | `/api/oauth/wechat` | 微信扫码登录 |
| `GET` | `/api/oauth/wechat/bind` | 绑定微信 |
| `GET` | `/api/oauth/email/bind` | 绑定邮箱 |
| `GET` | `/api/oauth/telegram/login` | Telegram 登录 |
| `GET` | `/api/oauth/telegram/bind` | 绑定 Telegram |
| `GET` | `/api/oauth/state` | 获取 OAuth CSRF state |

## 03-模型中继 API

这些接口通常使用 API Key：`Authorization: Bearer $NEWAPI_API_KEY`。

### OpenAI 兼容

| 能力 | 方法 | 路径 | 关键字段 |
| --- | --- | --- | --- |
| Chat Completions | `POST` | `/v1/chat/completions` | `model`、`messages`、`stream`、`tools` |
| Responses | `POST` | `/v1/responses` | `model`、`input`、`instructions`、`tools`、`stream` |
| Embeddings | `POST` | `/v1/embeddings` | `model`、`input`、`encoding_format`、`dimensions` |
| Image Generate | `POST` | `/v1/images/generations` | `model`、`prompt`、`n`、`size`、`quality` |
| Image Edit | `POST` | `/v1/images/edits` | multipart：`image`、`mask`、`prompt`、`model` |
| Image Variation | `POST` | `/v1/images/variations` | multipart：`image`、`n`、`size` |
| TTS | `POST` | `/v1/audio/speech` | `model`、`input`、`voice`、`response_format` |
| Transcription | `POST` | `/v1/audio/transcriptions` | multipart：`file`、`model`、`language` |
| Translation | `POST` | `/v1/audio/translations` | multipart：`file`、`model` |
| Realtime WS | WS | `/v1/realtime?model=...` | `OpenAI-Beta: realtime=v1` |

OpenAI Chat 最小示例：

```bash
curl "$BASE_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $NEWAPI_API_KEY" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "hello"}]
  }'
```

### Anthropic 兼容

| 方法 | 路径 | 鉴权 | 关键字段 |
| --- | --- | --- | --- |
| `POST` | `/v1/messages` | `x-api-key: $NEWAPI_API_KEY` | `model`、`max_tokens`、`messages`、`tools` |

需要携带 `anthropic-version: 2023-06-01`。

### Gemini 兼容

| 方法 | 路径 | 鉴权 | 关键字段 |
| --- | --- | --- | --- |
| `POST` | `/v1beta/models/{model}:generateContent?key=$NEWAPI_API_KEY` | query key | `contents`、`parts`、`tools`、`generationConfig`、`safetySettings` |

支持文本、图片、音频、视频、PDF、函数调用、JSON 模式、流式响应、代码执行等，具体取决于上游模型和渠道能力。

### Rerank

| 格式 | 方法 | 路径 | 关键字段 |
| --- | --- | --- | --- |
| Jina AI | `POST` | `/v1/rerank` | `model`、`query`、`documents`、`top_n` |
| Cohere | `POST` | `/v1/rerank` | `model`、`query`、`documents`、`top_n` |

### 视频、音乐

| 能力 | 方法 | 路径 | 说明 |
| --- | --- | --- | --- |
| Kling / Jimeng 视频生成 | `POST` | `/v1/video/generations` | JSON 请求，返回异步任务 |
| 查询视频任务 | `GET` | `/v1/video/generations/{task_id}` | 轮询 `status` |
| OpenAI/Sora 风格视频 | `POST` | `/v1/videos` | multipart，`prompt`、`model`、`seconds`、`size` |
| 查询视频 | `GET` | `/v1/videos/{video_id}` | 查询元数据 |
| 下载视频内容 | `GET` | `/v1/videos/{video_id}/content` | 输出二进制视频 |
| Suno 生成音乐 | `POST` | `/suno/submit/music` | `prompt`、`tags`、`mv`、`title` |
| Suno 生成歌词 | `POST` | `/suno/submit/lyrics` | `prompt` |
| Suno 查询任务 | `POST` | `/suno/fetch` | `ids`、`action` |
| Suno 查询单任务 | `GET` | `/suno/fetch/{task_id}` | 查询单个任务 |

## 04-Agent 常用工作流

### 巡检渠道健康

```text
1. GET /api/channel/                         # 拉取渠道列表
2. GET /api/channel/models_enabled           # 查看启用模型能力
3. GET /api/channel/test 或 /api/channel/test/:id
4. GET /api/channel/update_balance           # 刷新余额
5. GET /api/log/stat                         # 观察错误与消耗
6. 输出建议，不自动删除或禁用，除非策略允许
```

### 为用户创建受限 API Token

```text
1. GET /api/user/search 或 GET /api/user/:id
2. GET /api/user/models 或 GET /api/models
3. POST /api/token/，设置 remain_quota、expired_time、model_limits、allow_ips
4. GET /api/token/search 验证创建结果
5. GET /api/usage/token 使用新 API Key 验证额度
```

### 排查某个 Token 费用异常

```text
1. GET /api/usage/token
2. GET /api/log/token?key=<token_key> 或 GET /api/log/self/search
3. GET /api/log/self/stat 或 GET /api/log/stat
4. 如果需要限制：PUT /api/token/ 更新 remain_quota、model_limits_enabled、allow_ips 或 status
```

### 上线新模型或新渠道

```text
1. POST /api/channel/ 新增渠道
2. GET /api/channel/fetch_models/:id 拉取模型
3. GET /api/channel/test/:id 测试连通性
4. GET /api/channel/update_balance/:id 刷新余额
5. GET /api/channel/models_enabled 验证可见模型
6. 如需定价：POST /api/ratio_sync/fetch 或 PUT /api/option/
```

### 清理运营数据

```text
1. GET /api/redemption/ 检查兑换码状态
2. DELETE /api/redemption/invalid 清理无效兑换码
3. GET /api/log/ 评估日志规模
4. DELETE /api/log/?target_timestamp=<ts> 删除历史日志
```

## 05-官方来源

核心来源：

- `https://doc.newapi.pro/api/`
- `https://doc.newapi.pro/api/auth-system-description/`
- `https://doc.newapi.pro/api/get-available-models-list/`
- `https://doc.newapi.pro/api/token-usage/`
- `https://doc.newapi.pro/api/fei-user/`
- `https://doc.newapi.pro/api/fei-token-management/`
- `https://doc.newapi.pro/api/fei-channel-management/`
- `https://doc.newapi.pro/api/fei-redemption-code-management/`
- `https://doc.newapi.pro/api/fei-log/`
- `https://doc.newapi.pro/api/fei-data-statistics/`
- `https://doc.newapi.pro/api/fei-site-configuration/`
- `https://doc.newapi.pro/api/fei-system-initialization/`
- `https://doc.newapi.pro/api/fei-model-rate-sync/`
- `https://doc.newapi.pro/api/fei-account-billing-panel/`
- `https://doc.newapi.pro/api/openai-chat/`
- `https://doc.newapi.pro/api/openai-responses/`
- `https://doc.newapi.pro/api/openai-embedding/`
- `https://doc.newapi.pro/api/openai-image/`
- `https://doc.newapi.pro/api/openai-audio/`
- `https://doc.newapi.pro/api/openai-realtime/`
- `https://doc.newapi.pro/api/anthropic-chat/`
- `https://doc.newapi.pro/api/google-gemini-chat/`
- `https://doc.newapi.pro/api/jinaai-rerank/`
- `https://doc.newapi.pro/api/cohere-rerank/`
- `https://doc.newapi.pro/api/generate-video/`
- `https://doc.newapi.pro/api/query-video/`
- `https://doc.newapi.pro/api/openai-video/`
- `https://doc.newapi.pro/api/suno-music/`

仓库线索：

- 旧版文档仓库：`https://github.com/QuantumNous/new-api-docs`
- 旧版 README 指向新版文档仓库：`https://github.com/QuantumNous/new-api-docs-v1`

## 06-ProAPI 当前线上快照

快照时间：2026-06-06。数据来自 `GET /api/pricing` 与 `GET /api/channel/`,共 146 个模型、27 条渠道(19 启用 / 8 禁用)。

### 当前 10 个分组(按倍率从低到高)

| 分组 | 默认倍率 | 模型数 | 稳定性 | 用途 |
| --- | --- | --- | --- | --- |
| `Grok` | `x0.1` | 12 | ⭐⭐⭐ | Grok 系列(对话、推理、搜索) |
| `Codex-Plus-Pro 混池` | `x0.08` | 6 | ⭐⭐⭐⭐⭐ | GPT-5 / Codex Pro+Plus 混池,日常编程性价比首选(2026-06-07 由 x0.12 降至 x0.08) |
| `Embedding & Reranker` | `x0.2` | 49 | ⭐⭐⭐⭐ | 嵌入与重排聚合(OpenAI / Voyage / Jina / Cohere / Qwen / BGE / Gemini / NVIDIA / ZeroEntropy) |
| `Kiro-Claude-高缓存` | `x0.2` | 7 | ⭐⭐⭐⭐ | Claude 高缓存性价比渠道 |
| `Codex-Pro` | `x0.3` | 8 | ⭐⭐⭐⭐⭐ | GPT-5 / Codex 纯 Pro 渠道 |
| `Ant-Gemini` | `x0.5` | 11 | ⭐⭐⭐ | Gemini 反重力官方中转 |
| `claude-awsq-满血` | `x0.6` | 6 | ⭐⭐⭐⭐⭐ | aws-awsq 官方渠道,95% 高缓存 |
| `default` | `x1` | 144 | 取决于具体模型 | 通用兜底,可见全站模型 ⚠️ 计费贵 |
| `音视频模型` | `x1` | 52 | ⭐⭐⭐ | 图片与视频模型聚合 |
| `claude-max-满血` | `x1.6` | 13 | ⭐⭐⭐⭐⭐ | Claude 官方满血 20x,**仅 Claude Code,不可外接** |

### 全部分组三档倍率汇总(基础 / VIP / Premium)

ProAPI 站内对**用户等级**实施统一三档折扣:

- **基础倍率**:普通用户实际计费倍率,来自 `GET /api/pricing` 的分组默认值。
- **VIP 倍率**:通用规则 `= 基础 × 0.7`。
- **Premium 倍率**:通用规则 `= 基础 × 0.5`。

**例外说明**(来自 `content/docs/token/codex.mdx` Callout):

- `Codex-Plus-Pro 混池` 的 VIP / Premium 折扣**小于**通用规则,因为基础倍率已经做了较大折让。该分组实际 VIP ≈ 基础 × 0.875、Premium ≈ 基础 × 0.75。

| 分组 | 基础(普通) | VIP | Premium | 稳定性 | 数据来源 |
| --- | --- | --- | --- | --- | --- |
| `Codex-Plus-Pro 混池` | `x0.08` | `x0.07` | `x0.06` | ⭐⭐⭐⭐⭐ | ✅ 文档明确(特殊折扣) |
| `Grok` | `x0.1` | `x0.07` | `x0.05` | ⭐⭐⭐ | 通用规则推算 |
| `Embedding & Reranker` | `x0.2` | `x0.14` | `x0.10` | ⭐⭐⭐⭐ | 通用规则推算 |
| `Kiro-Claude-高缓存` | `x0.2` | `x0.14` | `x0.10` | ⭐⭐⭐⭐ | 通用规则推算 |
| `Codex-Pro` | `x0.3` | `x0.21` | `x0.15` | ⭐⭐⭐⭐⭐ | ✅ 文档明确 |
| `Ant-Gemini` | `x0.5` | `x0.35` | `x0.25` | ⭐⭐⭐ | 通用规则推算 |
| `claude-awsq-满血` | `x0.6` | `x0.42` | `x0.30` | ⭐⭐⭐⭐⭐ | 通用规则推算 |
| `default` | `x1` | `x0.7` | `x0.5` | 取决于模型 | 通用规则推算 ⚠️ 计费贵 |
| `音视频模型` | `x1` | `x0.7` | `x0.5` | ⭐⭐⭐ | 通用规则推算(图按次、视频按秒) |
| `claude-max-满血` | `x1.6` | `x1.12` | `x0.8` | ⭐⭐⭐⭐⭐ | 通用规则推算,**仅 Claude Code,不可外接** |

> 表格按基础倍率从低到高排序。"✅ 文档明确"表示该档倍率在 `content/docs/token/` 中有原文出处;"通用规则推算"表示按站内 VIP × 0.7 / Premium × 0.5 通用规则计算,实际生效请以控制台用户面板为准。

**2026-06-07 降价记录(`Codex-Plus-Pro 混池`):**

| 档位 | 调整前 | 调整后 |
| --- | --- | --- |
| 基础 | `x0.12` | `x0.08` |
| VIP | `x0.09` | `x0.07` |
| Premium | `x0.08` | `x0.06` |

### 当前启用渠道(19 条)

`Ant-Gemini 渠道`、`Kiro(高缓存)渠道`、`adobe 聚合渠`、`Codex-Pro`、`Ant-Gemini-Fallback`、`ChatGPT 生图渠`、`Ant-nano-banana-pro (cpa)`、`ArtImage 聚合`、`claude-max-满血渠`、`seed2 逆向`、`grok 逆向渠`、`Gpt-Team-Pro`、`Tumuer-Embedding-Reranker`、`awsq-claude`、`gpt-pro`、`Ant-Gemini-Agent (Text)`、`Ant-Gemini-Agent (Image)`、`Grok 官方-音视频`、`seedance-4 图-概率卡人脸渠`。

### 当前禁用渠道(8 条)

`codex-plus-prorise`、`Ant-Cluade 渠道`、`hy-gpt-team`、`hy-gpt-plus`、`hy-cluade-anti`、`hy-gemini`、`Flow 谷歌池`、`windsurf-gemini-Fallback`。

### 相对上一次快照(2026-05-27)的变化

- **新增分组**:`claude-awsq-满血`(x0.6)、`Embedding & Reranker`(x0.2)。
- **移除分组**:`Ant-Claude`(x0.4)、`Windsurf`(x0.25)、`claude-reverse-高缓存`(x0.1)。
- **倍率变化**:`claude-max-满血` 由 x1.2 上调至 **x1.6**。
- **渠道**:净增 1 启用 + 2 禁用,新增 `awsq-claude`、`Gpt-Team-Pro`、`Tumuer-Embedding-Reranker`、`Ant-Gemini-Agent`、`Grok 官方-音视频` 等。

### 当前重点 API

| 能力 | 路径 |
| --- | --- |
| 当前价格与分组 | `GET /api/pricing` |
| OpenAI 兼容聊天 | `POST /v1/chat/completions` |
| Anthropic 原生消息 | `POST /v1/messages` |
| Gemini 原生生成 | `POST /v1beta/models/{model}:generateContent` |
| 图片生成 | `POST /v1/images/generations` |
| 视频任务创建 | `POST /v1/videos` |
| 视频任务查询 | `GET /v1/videos/{video_id}` |
| 视频文件下载 | `GET /v1/videos/{video_id}/content` |
