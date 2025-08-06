-- Fix admin password hash in production database
-- This updates the admin user with the correct password hash for 'admin123'

USE `markaba-messenger`;

-- Update the admin user password hash
UPDATE `users` 
SET `password_hash` = '$2b$12$/fV5e/wSzDa2RHRSc3U09.iSmUVIC/z3jUtF4QVrCN9SDUnGjrPiW'
WHERE `username` = 'admin';

-- Verify the update
SELECT id, username, email, password_hash, full_name, role, is_active 
FROM `users` 
WHERE `username` = 'admin';

-- Show confirmation
SELECT 'Admin password hash updated successfully' as status;