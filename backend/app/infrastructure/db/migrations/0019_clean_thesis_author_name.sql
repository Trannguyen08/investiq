-- Migration 0019: Remove hardcoded (Tôi) in investment_theses author_name
UPDATE investment_theses
SET author_name = TRIM(REPLACE(author_name, '(Tôi)', ''))
WHERE author_name LIKE '%(Tôi)%';