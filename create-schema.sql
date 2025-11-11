-- Create custom schema for chat application
CREATE SCHEMA IF NOT EXISTS "chat-flutter";

-- Grant permissions (adjust based on your user)
GRANT ALL ON SCHEMA "chat-flutter" TO postgres;
GRANT ALL ON SCHEMA "chat-flutter" TO authenticated;
GRANT ALL ON SCHEMA "chat-flutter" TO service_role;
