## Foundation
01-design-system.md 
02-home-page.md 
03-auth.md
Clerk setup、Sign In／Sign Up、authenticated navbar、avatar menu。先不碰資料庫。
04-prisma-foundation.md
Prisma、PostgreSQL、database client、migration workflow。先建立基礎，不一次設計完整 schema。

## Anonymous planning flow
05-planning-session-model.md
定義 PlanningSession、狀態、expiry、initial prompt、session identifier。
06-planning-session-api.md
建立及讀取 anonymous planning session；輸入 validation；browser 保存 session identifier。
07-itinerary-workspace-shell.md
建立 Itinerary Plan route，以及左 chat／中 workspace／右 map 的三區 shell。Map 仍隱藏。
08-home-prompt-flow.md
Home textarea submit → 建立 PlanningSession → 跳到 workspace。

這時會完成第一個真正的 end-to-end flow：

Home → submit prompt → planning session → workspace

## AI clarification and generation
09-ai-provider-foundation.md
Application-owned AI provider interface，以及首個 provider configuration。
10-trigger-setup.md
Trigger.dev 基礎、task structure、server-only boundaries。
11-clarification-chat.md
Chat messages、clarification state、使用者回答、loading/error states。
12-initial-itinerary-generation.md
Clarification 完成後產生 validated structured itinerary preview。

AI provider 必須保持可替換，而且長時間生成工作應交由 Trigger.dev，而不是普通 request handler。

## Itinerary workspace
13-itinerary-kanban.md
根據生成結果顯示固定 day columns 和 itinerary cards，先做 read-only。
14-google-maps-foundation.md
Map initialization、markers、基礎 itinerary-map synchronization。
15-location-detail.md
點擊 itinerary item 後顯示 Location Detail，並 focus map。
16-add-location.md
Search／suggestions UI，把地點加入指定 day。
17-itinerary-operation-layer.md
建立統一 validated operation model，供 manual changes、AI changes、revert 和 collaboration 共用。
18-drag-and-drop.md
使用 dnd-kit 移動與排序 itinerary items，並透過 operation layer 更新。

Operation layer 必須早於真正的 editing、AI refinement 和 collaboration，否則很容易產生三套不同的修改邏輯。

## Saving and reopening trips
19-save-and-claim-preview.md
登入後把 PlanningSession 轉為 durable Trip。
20-saved-trip-persistence.md
Trip、days、items、preferences、operations 的持久化與 optimistic reconciliation。
21-my-trips.md
My Trips grid、讀取及重新開啟 saved trip。
Collaboration and refinement
22-liveblocks-setup.md
Room authorization、providers、membership checks。
23-realtime-collaboration.md
Shared edits、presence、avatars/cursors；PostgreSQL 仍是 durable source of truth。
24-ai-itinerary-refinement.md
使用者透過 chat 要求修改 itinerary，AI 回傳 validated operations，而不是另一份 itinerary state。


## Sharing and production controls
25-shareable-trip.md
Read-only share page、access rules。
26-pdf-export.md
Export modal、print layout、Trigger.dev、Vercel Blob。
27-usage-limits.md
AI、Places、export 等 cost-sensitive operations 的 logging 和 limits。
28-resilience-and-polish.md
Error recovery、empty states、responsive refinement、accessibility、performance。