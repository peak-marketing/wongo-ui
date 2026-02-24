-- Clear all order-related data
TRUNCATE TABLE assets CASCADE;
TRUNCATE TABLE billing_transactions CASCADE;
TRUNCATE TABLE orders CASCADE;
-- Keep users, wallets, migrations, order_templates, topup_requests
SELECT 'Orders cleared' AS result;
SELECT count(*) AS remaining_orders FROM orders;
