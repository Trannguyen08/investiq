# Current Task

## AI Assistant Security Guardrails, Knowledge RAG, Cache, Citations & Observability - 2026-11-04 (in progress)
- **User Request**:
  1. Chuyển nhánh `fix/AI`.
  2. Không cho AI trả lời các yêu cầu về data mật trong hệ thống (tokens, secrets, credentials, db connection strings, passwords, private user emails/balances).
  3. Không nhận các yêu cầu sửa đổi hệ thống (drop table, delete from, restart server, sửa code, cấp quyền admin) hay prompt injection.
  4. Áp dụng cache cho AI để phản hồi nhanh cho những câu đã có user khác hỏi (shared question cache).
  5. Ưu tiên học thuộc dữ liệu nội bộ không mật của hệ thống để response tốt hơn (RAG: published learning topics và stock glossary).
  6. Nếu crawl bên ngoài thì BẮT BUỘC ghi nguồn trong response (kèm link URL).
  7. Thêm giám sát và eval cho từng bước AI làm (per-step tracing, online rule-based evaluation, metrics endpoint).
- **Branch**: `fix/AI`
- **Changes**:
  - `backend/app/application/interfaces/i_ai_response_cache.py`: Interface protocol cho shared response cache.
  - `backend/app/application/interfaces/i_knowledge_source.py`: Interface protocol cho public knowledge retrieval.
  - `backend/app/application/use_cases/ai_chat/guardrails.py`: Input guardrails phân loại 4 nhóm vi phạm (`secret_exfiltration`, `system_modification`, `private_user_data`, `prompt_injection`) và regex `redact_sensitive_output` cho output.
  - `backend/app/application/use_cases/ai_chat/knowledge_base.py`: In-memory `InternalKnowledgeBase` index published topics & glossary với Vietnamese keyword/alias matching.
  - `backend/app/application/use_cases/ai_chat/ai_observability.py`: `AiTrace` trace 11 bước, `evaluate_response` online evaluation, `AiMetricsRegistry` telemetry.
  - `backend/app/infrastructure/cache/ai_chat_cache.py`: Redis-backed cache kết hợp local in-memory fallback.
  - `backend/app/application/use_cases/ai_chat/ai_financial_service.py`: Tích hợp 11 bước: guardrails, cache lookup, intent detection, internal data retrieval, knowledge retrieval, external search fallback, response generation, citation check, output redaction, evaluation, cache store.
  - `backend/app/schemas/ai_chat.py`: Bổ sung `AiSource`, `AiEvaluationResponse`, `AiMetricsResponse`.
  - `backend/app/api/v1/ai_chat.py`: Kết nối shared knowledge base, cache, metrics, bổ sung endpoint `GET /api/v1/ai/metrics`.
  - `backend/tests/unit/ai_chat/test_ai_chat.py`: 16 unit tests kiểm tra toàn diện guardrails, redaction, cache hit, knowledge priority, external citations, eval rules.
  - `backend/tests/integration/api/test_ai_chat_api.py`: 4 integration tests kiểm tra guest chat, guardrail block, general prompt, metrics endpoint.
  - `frontend/src/types/ai-chat.ts`: Bổ sung `AiSource`, `AiEvaluation`, `is_cached`.
  - `frontend/src/components/ai-chat/ai-chat-bubble.tsx`: Hiển thị badge cache (`⚡ Phản hồi từ cache`), badge Eval, và interactive citation links `[InvestIQ]` / `[Web ↗]`.
- **Verification**:
  - Quality Gate `./scripts/check-pr.ps1`: 6/6 passed (ESLint, TSC Typecheck, Vitest 152/152 passed, Ruff, Mypy, Pytest 153/153 passed).
  - Integration tests `test_ai_chat_api.py` 4/4 passed.

## Readiness Theme Consistency, Stock Detail Header Wrap Prevention, Order Error Resolution & Portfolio Block Removals - 2026-11-03 (completed)
- **Branch**: `fix/readiness-theme-portfolio-order-and-cleanups` (merged to `dev` and `main`, commit `9c9e8d6`).

## Auth Cold Start Resilience, UI Error Display & Keep-Alive Ping - 2026-11-03 (completed)
- **Branch**: `fix/auth-cold-start-retry-and-keepalive` (merged to `dev` and `main`).

## Portfolio UX Discipline, Automatic Order Fill, Header Layout & Stock Detail Speed - 2026-11-03 (completed)
- **Branch**: `fix/portfolio-ux-discipline-and-stock-detail-speed` (merged to `dev` and `main`, commit `9e131b1`).

## Stock Detail Performance Optimization, Sector Taxonomy & Fundamentals Fallback - 2026-11-03 (completed)
- **Branch**: `fix/stock-detail-performance-sectors-and-pe-pb` (merged to `dev` and `main`).

## Live Production Deployment & E2E System Verification - 2026-11-03 (completed)
- Status: 15/15 E2E endpoints passed 100%, Backend and Frontend Live.
