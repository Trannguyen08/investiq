-- Migration 0018: Seed thesis for logged in user trannguyen08py@gmail.com
INSERT INTO users (id, email, display_name, role, status, email_verified_at)
VALUES ('838fc348-aa4e-4cc2-be39-cd12dca71145', 'trannguyen08py@gmail.com', 'Nguyễn Trần', 'user', 'active', now())
ON CONFLICT (email) DO UPDATE
SET display_name = EXCLUDED.display_name;

INSERT INTO investment_theses (
    id, user_id, author_name, symbol, stance, entry_price, target_price, stop_loss_price,
    horizon_months, title, thesis_body, catalysts, status, outcome_roi, closed_at, closed_price, upvotes, created_at
)
SELECT
    'e1111111-1111-4111-e111-111111111111',
    id,
    'Nguyễn Trần (Tôi)',
    'FPT',
    'bullish',
    128000.0000,
    155000.0000,
    118000.0000,
    6,
    'FPT - Tăng tốc chiến lược AI Factory và hợp tác chiến lược công nghệ bán dẫn',
    'FPT tiếp tục khẳng định vị thế dẫn đầu công nghệ số và trí tuệ nhân tạo. Ký kết hợp tác mở rộng nhà máy AI tại Nhật Bản và phát triển hệ sinh thái chip bán dẫn là động lực định giá lại cổ phiếu trong trung và dài hạn.',
    ARRAY['Doanh thu ký mới chuyển đổi số tăng 28%', 'Hợp tác phát triển hạ tầng AI', 'Biên lợi nhuận ròng ổn định trên 18%'],
    'active',
    NULL,
    NULL,
    NULL,
    35,
    now() - interval '1 hour'
FROM users WHERE email = 'trannguyen08py@gmail.com'
ON CONFLICT (id) DO NOTHING;
