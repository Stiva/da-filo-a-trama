-- Add cluster field to service_roles table
ALTER TABLE service_roles
ADD COLUMN cluster TEXT DEFAULT NULL;
