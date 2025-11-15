-- Create a test CFO user for Finance module testing
-- Password: Admin123! (hashed with bcrypt)

INSERT INTO users (id, email, username, password_hash, full_name, phone, is_active, is_verified, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    'cfo@igdgroup.com',
    'cfo',
    '$2b$10$rOzJqJqJqJqJqJqJqJqJqOqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJq', -- This is a placeholder, needs actual bcrypt hash
    'CFO Test User',
    '081234567890',
    true,
    true,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Note: You'll need to generate the actual bcrypt hash for 'Admin123!'
-- Or use the register endpoint to create the user properly

