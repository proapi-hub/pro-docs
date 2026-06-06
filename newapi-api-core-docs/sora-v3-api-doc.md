# NewAPI 中转调用 Sora V3 Fast / Sora V3 Pro API 文档

> 调用入口：`https://<你的-newapi-域名>`
> 鉴权方式：`Authorization: Bearer <NewAPI 用户令牌>`
> 中转接口：NewAPI 渠道转发到本项目 `/v1/videos`
> 适用模型：`sora-v3-fast`、`sora-v3-pro`

## 1. 接口说明

Sora V3 Fast / Pro 当前只走 `/v1/videos` 异步视频任务接口，不走 `/v1/chat/completions`。

`/v1/videos` 当前只接受 `application/json` 请求体，不支持 `multipart/form-data`。不要使用 `-F` 传参。

视频秒数推荐使用顶层 `duration` 参数传入。代码会把 `duration` 映射到内部 `video_config.video_length`；如果同时传了 `duration` 和 `seconds`，以 `duration` 为准。

仍兼容以下写法：

- 顶层 `seconds`
- `video_config.video_length`

音频参考推荐使用顶层 `audio_url` 参数传入。当前 `/v1/videos` 的 JSON 解析逻辑实际读取的是 `audio_url` / `audioUrl`，不要把音频参考只放在 `reference_audios` 中。

## 2. 模型映射

| NewAPI 对外模型 | 本项目内部模型 | 上游模型 | 说明 |
| --- | --- | --- | --- |
| `sora-v3-fast` | `sora-v3-fast` | `seedance-2.0-fast` | 快速版 |
| `sora-v3-pro` | `sora-v3-pro` | `seedance-2.0` | 高质量版 |

可用别名：

| 推荐模型名 | 可用别名 |
| --- | --- |
| `sora-v3-fast` | `seedance-2.0-fast`、`Seedance 2.0 Fast` |
| `sora-v3-pro` | `seedance-2.0`、`Seedance 2.0` |

建议在 NewAPI 模型列表里只暴露 `sora-v3-fast` 和 `sora-v3-pro`。

## 3. 能力与限制

| 参数 | 支持范围 |
| --- | --- |
| 分辨率 | `480p`、`720p` |
| 画幅 | `16:9`、`9:16`、`1:1`、`4:3`、`3:4`、`21:9` |
| 视频时长 | `5-15` 秒整数 |
| 参考图 | 最多 4 张 |
| 参考视频 | 最多 3 个 |
| 参考视频时长 | 单个 `3-10` 秒；多个总时长最多 `15` 秒 |
| 音频参考 | 最多 1 个，使用时必须同时提供至少 1 张参考图 |
| 音频参考时长 | 单个 `2-15` 秒；总时长最多 `15` 秒 |
| 默认时长 | `5` 秒 |
| 默认分辨率 | `720p` |
| 默认视频音频 | 开启 |

`reference_mode` 支持：

| 模式 | 说明 |
| --- | --- |
| `auto` | 默认模式；由系统自动选择参考素材处理方式 |
| `start_frame` | 首帧模式，必须且只能传 1 张 `reference_images`，不能同时传参考视频 |
| `start_end` | 首尾帧模式，必须且只能传 2 张 `reference_images`，不能同时传参考视频 |
| `image_reference` | 图片参考模式，可与参考视频混合使用 |

## 4. 文生视频

**请求：**

```bash
curl -X POST https://<你的-newapi-域名>/v1/videos \
  -H "Authorization: Bearer <NewAPI用户令牌>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sora-v3-fast",
    "prompt": "A cinematic tracking shot through a neon-lit rainy street at night",
    "duration": 5,
    "video_config": {
      "aspect_ratio": "16:9",
      "resolution_name": "720p"
    }
  }'
```

**响应：**

```json
{
  "id": "task-abc123",
  "task_id": "task-abc123",
  "object": "video",
  "model": "sora-v3-fast",
  "status": "queued",
  "progress": 0,
  "created_at": 1713168000,
  "completed_at": null,
  "expires_at": null,
  "size": "1280x720",
  "seconds": "5",
  "quality": "standard",
  "remixed_from_video_id": null,
  "error": null,
  "video_url": null,
  "url": null,
  "result_url": null
}
```

## 5. 图生视频

```bash
curl -X POST https://<你的-newapi-域名>/v1/videos \
  -H "Authorization: Bearer <NewAPI用户令牌>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sora-v3-pro",
    "prompt": "Turn these stills into a polished fashion film with subtle camera motion",
    "duration": 8,
    "reference_images": [
      "https://example.com/look-1.jpg",
      "https://example.com/look-2.jpg"
    ],
    "video_config": {
      "aspect_ratio": "16:9",
      "resolution_name": "720p",
      "reference_mode": "image_reference"
    }
  }'
```

`reference_images` 支持公网图片 URL，也支持 `data:image/...;base64,...`。通过 NewAPI 中转时更推荐传公网 URL，避免请求体过大。

## 6. 首尾帧视频

首尾帧不要使用 `metadata.first_frame_url` 和 `metadata.last_frame_url`，当前代码没有读取这两个字段。

正确写法是：把首帧、尾帧按顺序放进 `reference_images`，并设置 `video_config.reference_mode` 为 `start_end`。

```bash
curl -X POST https://<你的-newapi-域名>/v1/videos \
  -H "Authorization: Bearer <NewAPI用户令牌>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sora-v3-pro",
    "prompt": "Smooth transition from day to night",
    "duration": 6,
    "reference_images": [
      "https://example.com/day.jpg",
      "https://example.com/night.jpg"
    ],
    "video_config": {
      "aspect_ratio": "16:9",
      "resolution_name": "720p",
      "reference_mode": "start_end"
    }
  }'
```

注意：`start_end` 模式必须且只能传 2 张参考图，且不能同时传 `reference_video` 或 `reference_videos`。

## 7. 视频参考

```bash
curl -X POST https://<你的-newapi-域名>/v1/videos \
  -H "Authorization: Bearer <NewAPI用户令牌>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sora-v3-fast",
    "prompt": "Continue this shot with a smooth orbiting camera move",
    "duration": 8,
    "reference_video": "https://example.com/source.mp4",
    "video_config": {
      "aspect_ratio": "16:9",
      "resolution_name": "720p"
    }
  }'
```

也可以传多参考视频：

```json
{
  "model": "sora-v3-fast",
  "prompt": "Create a new cinematic continuation based on these clips",
  "duration": 8,
  "reference_videos": [
    "https://example.com/source-1.mp4",
    "https://example.com/source-2.mp4"
  ],
  "video_config": {
    "aspect_ratio": "16:9",
    "resolution_name": "720p"
  }
}
```

## 8. 图片 + 视频混合参考

```bash
curl -X POST https://<你的-newapi-域名>/v1/videos \
  -H "Authorization: Bearer <NewAPI用户令牌>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sora-v3-pro",
    "prompt": "Extend this video while matching the styling and lighting of the reference images",
    "duration": 8,
    "reference_video": "https://example.com/source.mp4",
    "reference_images": [
      "https://example.com/style-ref-1.jpg",
      "https://example.com/style-ref-2.jpg"
    ],
    "video_config": {
      "aspect_ratio": "16:9",
      "resolution_name": "720p",
      "reference_mode": "image_reference"
    }
  }'
```

当前实现会把图片作为图片参考，把视频作为视频参考一起提交。

## 9. 图片 + 音频参考

音频参考必须满足以下规则：

- 使用顶层 `audio_url`，或兼容写法 `audioUrl`
- 最多传 1 个音频 URL
- 音频时长必须在 `2-15` 秒之间
- 使用音频参考时必须同时传至少 1 张 `reference_images`
- 当前 Sora V3 Fast / Pro 不支持 `audio_mode=keep_original`，如需传 `audio_mode` 只能传空值或 `auto`
- 当前 `/v1/videos` 的 JSON 解析逻辑不建议使用 `reference_audios` 或 `audio_urls` 作为音频参考入口

推荐写法：

```bash
curl -X POST https://<你的-newapi-域名>/v1/videos \
  -H "Authorization: Bearer <NewAPI用户令牌>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sora-v3-pro",
    "prompt": "Make the character dance naturally to the rhythm of the reference audio",
    "duration": 8,
    "reference_images": [
      "https://example.com/character.png"
    ],
    "audio_url": "https://example.com/music.mp3",
    "video_config": {
      "aspect_ratio": "16:9",
      "resolution_name": "720p",
      "reference_mode": "image_reference",
      "motion_has_audio": true
    }
  }'
```

驼峰兼容写法：

```json
{
  "model": "sora-v3-fast",
  "prompt": "Generate a stylish product video following the beat of the audio",
  "duration": 6,
  "referenceImages": [
    "https://example.com/product.jpg"
  ],
  "audioUrl": "https://example.com/beat.wav",
  "videoConfig": {
    "aspect_ratio": "16:9",
    "resolution_name": "720p",
    "reference_mode": "image_reference",
    "motion_has_audio": true
  }
}
```

错误写法示例：

```json
{
  "model": "sora-v3-pro",
  "prompt": "Dance to the music",
  "duration": 8,
  "audio_url": "https://example.com/music.mp3"
}
```

上面请求会失败，因为使用音频参考时没有提供参考图。接口会返回类似：

```json
{
  "error": {
    "message": "使用音频参考时，必须同时提供至少一张参考图",
    "type": "invalid_request_error",
    "param": "reference_images",
    "code": "audio_requires_image"
  }
}
```

## 10. 图片 + 视频 + 音频全能参考

全能参考适用于同时控制画面主体、动作延续和声音节奏的场景。请求中同时传：

- `reference_images`：控制人物、产品、风格或关键视觉元素
- `reference_video` / `reference_videos`：控制动作、镜头运动或画面连续性
- `audio_url`：控制节奏、音乐或声音参考

注意：使用 `audio_url` 时必须同时提供至少 1 张 `reference_images`。如果同时使用参考视频，建议把 `video_config.reference_mode` 设置为 `image_reference`。

```bash
curl -X POST https://<你的-newapi-域名>/v1/videos \
  -H "Authorization: Bearer <NewAPI用户令牌>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sora-v3-pro",
    "prompt": "Create a cinematic music video. Keep the character and outfit from the reference images, continue the camera motion from the reference video, and make the movement follow the rhythm of the reference audio.",
    "duration": 8,
    "reference_images": [
      "https://example.com/character-front.jpg",
      "https://example.com/style-reference.jpg"
    ],
    "reference_video": "https://example.com/motion-reference.mp4",
    "audio_url": "https://example.com/music-reference.mp3",
    "video_config": {
      "aspect_ratio": "16:9",
      "resolution_name": "720p",
      "reference_mode": "image_reference",
      "motion_has_audio": true
    }
  }'
```

多参考视频写法：

```json
{
  "model": "sora-v3-fast",
  "prompt": "Generate a fast-paced product video using the product images, camera movement clips, and the beat of the reference audio.",
  "duration": 10,
  "reference_images": [
    "https://example.com/product-1.jpg",
    "https://example.com/product-2.jpg"
  ],
  "reference_videos": [
    "https://example.com/camera-move-1.mp4",
    "https://example.com/camera-move-2.mp4"
  ],
  "audio_url": "https://example.com/beat.wav",
  "video_config": {
    "aspect_ratio": "9:16",
    "resolution_name": "720p",
    "reference_mode": "image_reference",
    "motion_has_audio": true
  }
}
```

全能参考限制汇总：

| 素材 | 限制 |
| --- | --- |
| `reference_images` | 最多 4 张 |
| `reference_video` / `reference_videos` | 最多 3 个 |
| 参考视频时长 | 单个 `3-10` 秒；多个总时长最多 `15` 秒 |
| `audio_url` | 最多 1 个 |
| 音频时长 | `2-15` 秒 |
| `duration` | `5-15` 秒整数 |

## 11. 查询任务状态

```bash
curl -X GET https://<你的-newapi-域名>/v1/videos/<task_id> \
  -H "Authorization: Bearer <NewAPI用户令牌>"
```

成功响应：

```json
{
  "id": "task-abc123",
  "task_id": "task-abc123",
  "object": "video",
  "model": "sora-v3-fast",
  "status": "succeeded",
  "progress": 100,
  "created_at": 1713168000,
  "completed_at": 1713168120,
  "expires_at": null,
  "size": "1280x720",
  "seconds": "5",
  "quality": "standard",
  "remixed_from_video_id": null,
  "error": null,
  "video_url": "https://example.com/result.mp4",
  "url": "https://example.com/result.mp4",
  "result_url": "https://example.com/result.mp4"
}
```

任务状态：

| 状态 | 说明 |
| --- | --- |
| `queued` | 已入队 |
| `processing` | 生成中 |
| `succeeded` | 生成成功 |
| `failed` | 生成失败 |

## 12. 下载视频内容

```bash
curl -L -X GET https://<你的-newapi-域名>/v1/videos/<task_id>/content \
  -H "Authorization: Bearer <NewAPI用户令牌>" \
  --output result.mp4
```

任务未完成时会返回 `409`，错误码为 `video_not_ready`。

## 13. 兼容字段

除推荐写法外，接口还兼容部分 NoteVideo 风格字段：

| 字段 | 行为 |
| --- | --- |
| `duration` | 推荐。正整数或数字字符串，映射为内部 `video_config.video_length` |
| `seconds` | 兼容字段。仅在未传 `duration` 时生效 |
| `size` | 兼容字段，例如 `1280x720`，会映射为 `aspect_ratio=16:9` 和 `resolution_name=720p` |
| `aspect_ratio` | 顶层兼容字段，会覆盖 `video_config.aspect_ratio` |
| `resolution` | 顶层兼容字段，会覆盖 `video_config.resolution_name` |
| `reference_mode` | 顶层兼容字段，会写入 `video_config.reference_mode` |
| `image_url`、`reference_image_urls` | 会合并进 `reference_images` |
| `video_url`、`reference_video_url`、`reference_video_urls` | 会合并进 `reference_videos` |
| `audio_url` | 推荐的音频参考字段，会作为音频参考提交 |
| `audioUrl` | `audio_url` 的驼峰兼容字段 |
| `audio_mode`、`audioMode` | 会写入 `video_config.audio_mode`；Sora V3 Fast / Pro 仅接受空值或 `auto` |

如果同时传 `duration` 和 `video_config.video_length`，最终以顶层 `duration` 写入后的值为准。

如果同时传 `duration` 和 `seconds`，最终以 `duration` 为准。

## 14. 常见错误

| HTTP 状态码 | 错误码 | 说明 |
| --- | --- | --- |
| `400` | `invalid_json` | JSON 格式错误 |
| `400` | `model_not_supported` | 模型不存在或不是视频模型 |
| `400` | `invalid_reference_inputs` | 参考图、参考视频或参考音频参数错误 |
| `400` | `invalid_reference_mode` | `reference_mode` 不支持 |
| `400` | `invalid_resolution_name` | 分辨率不支持 |
| `400` | `invalid_video_length` | 视频时长不支持 |
| `400` | `unsupported_audio_url` | 当前模型不支持音频参考 |
| `400` | `audio_requires_image` | 传了 `audio_url` 但没有传参考图 |
| `400` | `invalid_audio_mode` | 音频模式不支持 |
| `404` | `task_not_found` | 任务不存在 |
| `409` | `video_not_ready` | 视频尚未生成完成 |
| `429` | `upstream_rate_limited` | 请求过于频繁 |
| `451` | `upstream_safety_rejected` | 内容或参考素材触发安全策略 |
| `503` | `token_unavailable` | 当前无可用账号或额度 |
| `504` | `upstream_timeout` | 生成服务超时 |

错误响应格式：

```json
{
  "error": {
    "message": "错误描述",
    "type": "invalid_request_error",
    "param": "参数名",
    "code": "错误码"
  }
}
```

## 15. 推荐 NewAPI 配置要点

- 模型列表只暴露 `sora-v3-fast` 和 `sora-v3-pro`
- 请求路径使用 `/v1/videos`
- 请求体类型使用 `application/json`
- 不要配置为 `/v1/chat/completions`
- 不要使用 `multipart/form-data`
- 音频参考统一引导用户使用 `audio_url`
- 图生视频、音频参考、首尾帧都建议使用公网 URL，减少请求体大小
