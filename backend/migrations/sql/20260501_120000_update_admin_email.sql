-- +goose Up
UPDATE users SET mail = 'admin@admin.com' WHERE mail = 'admin@pentagi.com';

-- +goose Down
UPDATE users SET mail = 'admin@pentagi.com' WHERE mail = 'admin@admin.com';
