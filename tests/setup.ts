import '@testing-library/jest-dom/vitest';

// Values the security helpers require. Test-only; never used outside vitest.
process.env.IP_HASH_SALT ??= 'test-salt-0123456789abcdef0123456789abcdef';
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key';
