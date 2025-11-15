-- Assign CFO role to test user
-- Run this script in your PostgreSQL database

-- Step 1: Ensure CFO role exists (create if doesn't exist)
INSERT INTO roles (id, code, name, description, level, is_system_role, is_active, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    'CFO',
    'Chief Financial Officer',
    'Full access to Finance and Accounting module',
    2,
    false,
    true,
    NOW(),
    NOW()
)
ON CONFLICT (code) DO NOTHING;

-- Step 2: Get user ID and role ID
DO $$
DECLARE
    v_user_id UUID;
    v_role_id UUID;
BEGIN
    -- Get user ID
    SELECT id INTO v_user_id
    FROM users
    WHERE email = 'cfo@igdgroup.com'
    LIMIT 1;

    -- Get CFO role ID
    SELECT id INTO v_role_id
    FROM roles
    WHERE code = 'CFO'
    LIMIT 1;

    -- Check if user exists
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User with email cfo@igdgroup.com not found. Please register the user first.';
    END IF;

    -- Check if role exists
    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'CFO role not found. Please ensure roles are seeded.';
    END IF;

    -- Assign role to user (if not already assigned)
    INSERT INTO user_roles (id, user_id, role_id, branch_id, is_primary, valid_from, created_at, updated_at)
    VALUES (
        gen_random_uuid(),
        v_user_id,
        v_role_id,
        NULL, -- All branches
        true, -- Primary role
        NOW(),
        NOW(),
        NOW()
    )
    ON CONFLICT (user_id, role_id, branch_id) DO NOTHING;

    RAISE NOTICE 'CFO role assigned successfully to user %', v_user_id;
END $$;

-- Verify assignment
SELECT 
    u.email,
    u.full_name,
    r.code as role_code,
    r.name as role_name,
    ur.is_primary,
    ur.valid_from
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE u.email = 'cfo@igdgroup.com'
AND r.code = 'CFO';

