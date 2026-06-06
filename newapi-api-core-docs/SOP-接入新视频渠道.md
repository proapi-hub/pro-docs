# SOP — NewAPI 接入新视频/异步任务渠道

> 适用范围：**OpenAI 兼容**类视频渠道（`/v1/videos` 异步任务），如 sora-v3、seedance 系列、kling、grok-imagine-video 等。
> 写作背景：2026-06-05 接入 `seedance-4图-概率卡人脸渠`（上游 `https://niuma.me`，型号 `sora-v3-fast`/`sora-v3-pro` → 本站 `seedance2.0-fast`/`seedance2.0`）的全过程沉淀。
> 维护：每次接入新视频渠道，按本 SOP 操作；如发现新坑，回头补充本文。

---

## 0. 关键事实（先看这个）

| 事实 | 后果 | 应对 |
| --- | --- | --- |
| `channels` 表用 INSERT 写入**不会**自动同步 `abilities` 表 | 路由能用（内存 cache），但 `/api/pricing`、`/v1/models` 和前端模型广场都看不到新模型 | **必须手动 INSERT abilities**（每个 model × 每个 group 一行） |
| 写完 `options/models/abilities` 后 NewAPI 不自动刷新 | 前端、pricing 不变化 | **必须 `docker restart newapi-prime`** |
| `mysql` CLI 必须显式 `--default-character-set=utf8mb4` | 中文（如渠道名 `seedance-4图-概率卡人脸渠`）会被替换成 `?` | 所有命令带 `--default-character-set=utf8mb4` |
| `/v1/videos` 响应体的 `model` 字段会**透传上游真名**（如 `sora-v3-fast`） | 上游伪装失效；用户可见 `sora-v3-fast` | NewAPI 当前版本的视频通道没做反向 model rewrite，这是 **已知 leak**，靠"对外只暴露我们的模型名"+"上游域名走伪装子域"两层缓解 |
| `channels` 表里 `models` 字段是 CSV，**写的是我们对外的模型名**；`model_mapping` 是 JSON `{"我们的":"上游的"}` | model_mapping 错配会直接 404 或乱串模型 | 写之前 `curl <上游>/v1/models` 确认上游真实模型 id |
| 失败任务自动退款 | logs 表会同时出现 `type=2`（预扣）和 `type=6`（退款），quota 相等 | 失败请求不会真正扣到用户钱 |

---

## 1. 前置准备（务必先做完）

1. **拿到上游 3 件套**
   - `base_url`：不带末尾 `/`，不带 `/v1`（NewAPI 自己拼）
   - `api_key`：bearer token
   - 渠道在后台显示用的名字（建议带"备注后缀"，如 `seedance-4图-概率卡人脸渠`，便于以后排查特性）

2. **确认上游真实模型 id**（防止把上游"对外模型名"误以为是 OpenAI 标准名）
   ```bash
   curl -sS https://<上游域>/v1/models \
     -H "Authorization: Bearer <上游 key>" | jq '.data[] | {id, supported_endpoint_types}'
   ```
   - 视频模型 `supported_endpoint_types` 通常含 `openai-video`

3. **无副作用探活**（确认 key 有效）
   ```bash
   curl -sS -o /dev/null -w "%{http_code}\n" \
     https://<上游域>/v1/videos/probe-by-claude-do-not-exist \
     -H "Authorization: Bearer <上游 key>"
   ```
   - 期望 `400`（task 不存在），不是 `401/403`（key 鉴权失败）

4. **本站确认模型已注册**
   ```bash
   docker exec newapi-prime-mysql mysql --default-character-set=utf8mb4 \
     -unewapi -p<DB密码> newapi -e "
   SELECT id, model_name, status, deleted_at, vendor_id, endpoints
   FROM models WHERE model_name IN ('<我们的名1>','<我们的名2>') AND deleted_at IS NULL;
   "
   ```
   - 必须有匹配行且 `status=1`
   - 若没有，先去 admin 后台 / 模型表新增模型

5. **本站确认定价存在**
   ```bash
   docker exec newapi-prime-mysql mysql --default-character-set=utf8mb4 \
     -unewapi -p<DB密码> newapi -N --raw -e \
     "SELECT value FROM options WHERE \`key\`='ModelPrice'" \
     | jq '. | to_entries[] | select(.key == "<我们的名>")'
   ```
   - 应有 `{"key":"...","value":0.x}` 格式
   - 没有就在 admin 后台「运营设置 → 模型固定价格」加

---

## 2. 备份（不可跳过）

```bash
TS=$(date +%Y%m%d-%H%M)
docker exec newapi-prime-mysql sh -c \
  "mysqldump --default-character-set=utf8mb4 -unewapi -p<DB密码> \
   --single-transaction --no-tablespaces newapi channels abilities" \
  > /root/backup-channels-abilities-${TS}.sql
ls -lh /root/backup-channels-abilities-${TS}.sql
```

**回滚命令模板**（万一接坏了）：
```sql
-- 假设新增的 channel id = 79
DELETE FROM abilities WHERE channel_id=79;
DELETE FROM channels WHERE id=79;
```
（删 abilities 后必须 `docker restart newapi-prime`）

---

## 3. 写入 `channels` 行（事务包裹）

把下面模板保存到 `/tmp/insert-channel.sql`，参数替换后执行。

```sql
START TRANSACTION;

SELECT COUNT(*) AS before_count FROM channels;
SELECT MAX(id) AS before_max_id FROM channels;

INSERT INTO channels (
  type, `key`, status, name, weight, created_time, base_url,
  models, `group`, model_mapping, priority, auto_ban,
  test_model, channel_info, settings, setting,
  open_ai_organization, tag, status_code_mapping,
  param_override, header_override, remark, other, other_info
) VALUES (
  1,                                                      -- type=1 OpenAI 兼容
  '<上游 api_key>',
  1,                                                      -- status=1 启用
  '<渠道显示名>',
  0,                                                      -- weight
  UNIX_TIMESTAMP(),
  '<上游 base_url，不带 / 和 /v1>',
  '<本站对外模型名1>,<本站对外模型名2>',                  -- CSV
  '音视频模型,default',                                   -- 视频渠道惯例
  '{"<本站名1>":"<上游真名1>","<本站名2>":"<上游真名2>"}',
  0,                                                      -- priority
  1,                                                      -- auto_ban
  '<本站对外模型名1>',                                    -- test_model 用最便宜那档
  '{"is_multi_key": false, "multi_key_mode": "", "multi_key_size": 0, "multi_key_status_list": null, "multi_key_polling_index": 0}',
  '{"upstream_model_update_check_enabled":false,"upstream_model_update_auto_sync_enabled":false,"upstream_model_update_ignored_models":[],"upstream_model_update_last_detected_models":[],"upstream_model_update_last_check_time":0,"allow_service_tier":false,"disable_store":false,"allow_safety_identifier":false,"allow_include_obfuscation":false,"allow_inference_geo":false}',
  '{"force_format":false,"thinking_to_content":false,"proxy":"","pass_through_body_enabled":false,"system_prompt":"","system_prompt_override":false}',
  '', '', '', '', '', '', '', NULL
);

SELECT ROW_COUNT() AS inserted_rows;
SET @new_id := LAST_INSERT_ID();
SELECT @new_id AS new_channel_id;

SELECT id, name, base_url, models, model_mapping, `group`
FROM channels WHERE id = @new_id\G

COMMIT;
SELECT 'channels 写入完毕' AS msg;
```

执行：
```bash
docker cp /tmp/insert-channel.sql newapi-prime-mysql:/tmp/insert-channel.sql
docker exec -i newapi-prime-mysql mysql --default-character-set=utf8mb4 \
  -unewapi -p<DB密码> newapi < /tmp/insert-channel.sql
```

**记下返回的 `new_channel_id`**，下一步要用。

---

## 4. 补 `abilities` 行（**这一步最容易漏，路由能用但 UI 看不到全因此**）

`abilities` 主键是 `(group, model, channel_id)` 三元组。**每个模型 × 每个 group** 都要一行。

```sql
START TRANSACTION;

SELECT COUNT(*) AS before_count FROM abilities WHERE channel_id=<new_channel_id>;

INSERT INTO abilities (`group`, model, channel_id, enabled, priority, weight, tag) VALUES
  ('default',     '<本站名1>', <new_channel_id>, 1, 0, 0, NULL),
  ('default',     '<本站名2>', <new_channel_id>, 1, 0, 0, NULL),
  ('音视频模型', '<本站名1>', <new_channel_id>, 1, 0, 0, NULL),
  ('音视频模型', '<本站名2>', <new_channel_id>, 1, 0, 0, NULL);

SELECT ROW_COUNT() AS inserted;
SELECT * FROM abilities WHERE channel_id=<new_channel_id>;

COMMIT;
```

执行方式同上。

> **为什么 abilities 必须手动写？**
> NewAPI 的 admin API（PUT /api/channel）在写 channels 时会同步重建 abilities。我们直接 INSERT 数据库绕过了这层钩子，所以 abilities 是空的。
> `abilities` 才是 `/api/pricing`、`/v1/models`、前端模型广场的数据源。**没有 abilities = 模型对用户不可见。**

---

## 5. 重启 NewAPI（必须）

```bash
docker restart newapi-prime
for i in 1 2 3 4 5 6 7 8 9 10; do
  st=$(docker inspect -f '{{.State.Health.Status}}' newapi-prime)
  echo "[$i] health=$st"
  [ "$st" = "healthy" ] && break
  sleep 2
done
```

> 写 `options` 表、`models` 表（含 vendor）、`abilities` 表后**都**要 restart，因为 NewAPI 启动时把这些数据 build 到内存 cache，不会运行时主动 reload。

---

## 6. 端到端验证（三步必做）

### 6.1 pricing & /v1/models 看到了

```bash
curl -sS "https://newapi.prorisehub.com/api/pricing?_t=$(date +%s)" \
  | jq '.data[] | select(.model_name | test("<新模型名关键字>")) | {model_name, enable_groups, model_price}'

curl -sS https://newapi.prorisehub.com/v1/models \
  -H "Authorization: Bearer sk-<任一可用 token key>" \
  | jq '.data | map(.id) | map(select(test("<新模型名关键字>")))'
```

期望：能看到新模型、`model_price` 等于 ModelPrice 表里的值、`enable_groups` 包含 `default` 和 `音视频模型`。

### 6.2 提交一次最小代价文生视频任务

```bash
curl -sS -X POST https://newapi.prorisehub.com/v1/videos \
  -H "Authorization: Bearer sk-<测试 token，建议无限额度>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "<本站最便宜那档模型名>",
    "prompt": "A small calico kitten chasing a red laser dot",
    "duration": 5,
    "video_config": {"aspect_ratio":"16:9","resolution_name":"720p"}
  }' | jq .
```

期望：HTTP 200，返回里有 `task_id` 和 `status: "queued"`。

> ⚠️ 响应里 `model` 字段会显示上游真名（如 `sora-v3-fast`），这是已知 leak，不是配置错误。

### 6.3 轮询任务状态

```bash
TID="<上一步拿到的 task_id>"
for i in {1..20}; do
  R=$(curl -sS https://newapi.prorisehub.com/v1/videos/$TID \
       -H "Authorization: Bearer sk-<同上>")
  echo "[$i] $(date +%T) status=$(echo "$R" | jq -r .status) progress=$(echo "$R" | jq -r .progress)"
  S=$(echo "$R" | jq -r .status)
  [ "$S" = "succeeded" ] || [ "$S" = "failed" ] && { echo "$R" | jq .; break; }
  sleep 15
done
```

- `succeeded` → 渠道完美工作
- `failed` 且 `error.code` 形如 `upstream_*` → **是上游问题，不是我们配置问题**；继续测一次确认稳定性，多次失败考虑下线/降权这条渠道

### 6.4 验证扣费/退款记录

```bash
docker exec newapi-prime-mysql mysql --default-character-set=utf8mb4 \
  -unewapi -p<DB密码> newapi -e "
SELECT id, user_id, token_id, channel_id, model_name, quota, type, created_at
FROM logs WHERE channel_id=<new_channel_id>
ORDER BY id DESC LIMIT 10\G"
```

- `type=2`：预扣
- `type=6`：失败退款（应与对应预扣 quota 相等）
- `type=1`：充值
- `type=3`：管理员调整

---

## 7. 收尾

1. **清掉 `/tmp` 临时 SQL 文件**
   ```bash
   rm -f /tmp/insert-channel.sql /tmp/insert-abilities-*.sql
   docker exec newapi-prime-mysql rm -f /tmp/insert-channel.sql /tmp/insert-abilities-*.sql
   ```
2. **保留 `/root/backup-channels-abilities-<TS>.sql`** —— 这是回滚保险，别删
3. **更新本地 `newapi-api-core-docs/models-metadata.json`** —— 重新跑导出，让本地副本同步线上
4. **如有必要更新模型表 description / tags**（比如新模型上线后想把"暂不可用"等说明去掉）
5. **任务 list 标 completed**

---

## 8. 已知坑（更新维护）

| 现象 | 根因 | 处理 |
| --- | --- | --- |
| pricing/v1 models 不显示新模型 | 没补 abilities | 见 §4 |
| 中文渠道名变 `?` | mysql 没指定 utf8mb4 | 所有命令带 `--default-character-set=utf8mb4` |
| restart 后前端还是旧数据 | CDN / 浏览器缓存 | URL 加 `?_t=$(date +%s)` 或硬刷新 |
| `/v1/videos` 响应 model 字段是上游真名 | NewAPI 视频通道未做响应反向 model rewrite | 已知 leak；只能等上游修或 fork 改源码 |
| 渠道路由能用但 pricing 没出现 | abilities 没补 | 见 §4 |
| 上游超时但用户没扣到钱 | 失败自动退款（logs.type=6） | 正常；多次失败考虑降权 priority=-1 |

---

## 9. 附：本次（2026-06-05 niuma.me）落地参数实录

| 字段 | 值 |
| --- | --- |
| channel_id | 79 |
| name | `seedance-4图-概率卡人脸渠` |
| base_url | `https://niuma.me` |
| group | `音视频模型,default` |
| models | `seedance2.0-fast,seedance2.0` |
| model_mapping | `{"seedance2.0-fast":"sora-v3-fast","seedance2.0":"sora-v3-pro"}` |
| test_model | `seedance2.0-fast` |
| 备份文件 | `/root/backup-channels-20260605-1755.sql`（仅 channels；abilities 是新增的不需要备份） |
| 端到端测试 | 任务 `task_rfxEU08L...` 通到上游 → upstream_timeout 失败 → 自动退款 |

---

## 10. 何时**不能**用本 SOP

- **聊天/对话**渠道（`/v1/chat/completions`）：用通用 OpenAI 接入流程，不要走视频专属配置
- **OpenAI 官方 Sora 1/Sora 2**：那是 OpenAI 自己的渠道类型（如 type=1 子分支），不是这种"OpenAI 兼容 + 视频任务"，配法略有不同
- **接入需要 admin Cookie 才能操作的渠道**：建议走 NewAPI 后台 UI 而非直接 INSERT DB；本 SOP 主要面向"无后台访问、只能 SSH + DB"的场景
