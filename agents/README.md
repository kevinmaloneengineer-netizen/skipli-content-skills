# Agents

Mỗi file `*.json` là body cho `POST /v1/agents` (field của `store.AgentData` trong GoClaw).

| Agent | Skills | Dùng cho | Tool cần |
|---|---|---|---|
| `content-scout` | `fb-reel-reader`, `threads-viral-finder` | Quét Reels đối thủ, tìm bài viral Threads | `exec`, `browser`, `read_video`/`read_audio`/`read_image` |
| `content-writer` | `content-writer` | Viết content AI | không cần tool nào |

Cả hai đều đặt `prompt_mode: "task"` để system prompt ngắn hơn, vì mỗi lượt gửi lại khoảng 18K token (HANDOFF mục 7).
Agent writer được tách riêng để không phải mang prompt và tool của phần quét.

`provider`/`model` hiện trỏ tới ChatGPT subscription (tài khoản Free chỉ dùng được `gpt-5.6-terra`). Chỉ dùng để dev.
Production phải đổi sang provider API trả phí (HANDOFF mục 8). Agent writer không cần tool, nên đổi sang
`gemini` cũng được để giảm tải cho ChatGPT.

## Tạo agent và gán skill

```bash
source deploy/.env
H=(-H "Authorization: Bearer $GOCLAW_GATEWAY_TOKEN" -H "X-GoClaw-User-Id: $GOCLAW_USER_ID")

# 1. tạo agent, response có "id" (UUID)
curl -sS "${H[@]}" -H 'Content-Type: application/json' -d @agents/content-scout.json  "$GOCLAW_URL/v1/agents"
curl -sS "${H[@]}" -H 'Content-Type: application/json' -d @agents/content-writer.json "$GOCLAW_URL/v1/agents"

# 2. upload skill và grant đúng agent
GOCLAW_AGENT_IDS=<uuid scout>  scripts/push-skills.sh fb-reel-reader threads-viral-finder
GOCLAW_AGENT_IDS=<uuid writer> scripts/push-skills.sh content-writer
```

`summon: false` để GoClaw không chạy LLM sinh lại context files của agent sau khi tạo.
