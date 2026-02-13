// =============================================================================
// Test Setup
// =============================================================================

import { beforeAll, afterAll, vi } from 'vitest';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-minimum-32-chars';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-testing-minimum-32-chars';
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/crm_api_test';
process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379';
process.env.LOG_LEVEL = 'error'; // Reduce noise in tests
process.env.LOG_FORMAT = 'json';

// Mock console methods in tests to reduce noise
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'info').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
