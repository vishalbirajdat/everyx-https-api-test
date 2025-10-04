# EverX HTTPS API Test Suite

A comprehensive test suite for testing the EverX event management API endpoints. This test suite covers the complete event lifecycle from creation to resolution, including all status transitions and error handling scenarios.

## 📋 Table of Contents

- [Overview](#overview)
- [Test Structure](#test-structure)
- [Setup and Configuration](#setup-and-configuration)
- [Test Files](#test-files)
- [Event Status Lifecycle](#event-status-lifecycle)
- [Running Tests](#running-tests)
- [Environment Variables](#environment-variables)
- [API Endpoints Tested](#api-endpoints-tested)
- [Test Scenarios](#test-scenarios)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

This test suite validates the EverX event management system, focusing on:
- Event creation and validation
- Event outcome management
- Complete event status lifecycle testing
- Authorization and error handling
- API response validation with snapshots

## 🏗️ Test Structure

```
test/
├── create-event.test.js      # Event creation, outcomes, open/close operations
├── pause-event.test.js       # Event pause functionality
├── resolve-event.test.js     # Event resolution with dry-run support
├── status-transition-flow.test.js  # Complete status flow testing
└── __snapshots__/           # Jest snapshots for response validation
```

## ⚙️ Setup and Configuration

### Prerequisites

- Node.js (v14 or higher)
- Jest testing framework
- Access to EverX API environment
- Valid admin authentication token

### Installation

```bash
npm install
# or
pnpm install
```

### Environment Setup

Create a `.env` file in the root directory:

```env
# API Configuration
API_BASE_URL=http://localhost:8800
ADMIN_TOKEN=your_admin_token_here

# Timing Configuration (optional)
RESOLVE_DELAY=120000    # 2 minutes in milliseconds
PAUSE_DELAY=1000        # 1 second
OPEN_DELAY=120000       # 2 minutes
CLOSE_DELAY=120000      # 2 minutes
```

## 📁 Test Files

### 1. `create-event.test.js`
**Primary Event Management Tests**

- ✅ Event creation with valid payload
- ✅ Duplicate event name/ticker validation
- ✅ Invalid ticker format handling
- ✅ Authorization validation
- ✅ Required field validation
- ✅ Date format validation
- ✅ Timezone validation
- ✅ Outcome creation (Yes/No outcomes)
- ✅ Duplicate outcome validation
- ✅ Event opening functionality
- ✅ Event closing functionality

### 2. `pause-event.test.js`
**Event Pause Operations**

- ✅ Successfully pause an open event
- ✅ Error handling for pausing already paused event
- ✅ Unauthorized access validation
- ✅ Non-existent event handling
- ✅ Reopening paused events

### 3. `resolve-event.test.js`
**Event Resolution Testing**

- ✅ Dry-run validation (returns validation results)
- ✅ Successful event resolution
- ✅ Already resolved event error handling
- ✅ Missing required fields validation
- ✅ Authorization validation
- ✅ Non-existent event handling

### 4. `status-transition-flow.test.js`
**Complete Lifecycle Testing**

- ✅ Full status flow: `created` → `open` → `paused` → `open` → `closed` → `resolved`
- ✅ Configurable timing delays between transitions
- ✅ Real-world scenario simulation

## 🔄 Event Status Lifecycle

The test suite validates the complete event status lifecycle:

```
created → open → paused → open → closed → resolved
    ↓       ↓       ↓       ↓       ↓        ↓
   ✅      ✅      ✅      ✅      ✅       ✅
```

### Valid Status Transitions

| From Status | To Status | Endpoint | Test Coverage |
|-------------|-----------|----------|---------------|
| `created` | `open` | `POST /admin/events/:id/open` | ✅ |
| `open` | `paused` | `POST /admin/events/:id/pause` | ✅ |
| `paused` | `open` | `POST /admin/events/:id/open` | ✅ |
| `open` | `closed` | `POST /admin/events/:id/close` | ✅ |
| `paused` | `closed` | `POST /admin/events/:id/close` | ✅ |
| `closed` | `resolved` | `POST /admin/events/:id/resolve` | ✅ |

## 🚀 Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test Files
```bash
# Event creation and basic operations
npm test create-event.test.js

# Pause functionality
npm test pause-event.test.js

# Resolution functionality
npm test resolve-event.test.js

# Complete status flow
npm test status-transition-flow.test.js
```

### Run Tests with Verbose Output
```bash
npm test -- --verbose
```

### Update Snapshots
```bash
npm test -- --updateSnapshot
```

## 🌍 Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `API_BASE_URL` | Base URL for the API | `http://localhost:8800` | ✅ |
| `ADMIN_TOKEN` | Admin authentication token | - | ✅ |
| `RESOLVE_DELAY` | Delay before resolution (ms) | `120000` | ❌ |
| `PAUSE_DELAY` | Delay after pause (ms) | `1000` | ❌ |
| `OPEN_DELAY` | Delay after open (ms) | `120000` | ❌ |
| `CLOSE_DELAY` | Delay after close (ms) | `120000` | ❌ |

## 🔗 API Endpoints Tested

### Event Management
- `POST /admin/events` - Create new event
- `POST /admin/events/:id/outcomes` - Create event outcomes
- `POST /admin/events/:id/open` - Open event for trading
- `POST /admin/events/:id/pause` - Pause event trading
- `POST /admin/events/:id/close` - Close event trading
- `POST /admin/events/:id/resolve` - Resolve event with outcome

## 📊 Test Scenarios

### Success Scenarios ✅
- Complete event lifecycle execution
- Valid payload processing
- Proper status transitions
- Successful authentication
- Dry-run validation

### Error Scenarios ❌
- Duplicate event names/tickers
- Invalid payload formats
- Unauthorized access attempts
- Invalid status transitions
- Non-existent resource access
- Missing required fields

### Edge Cases 🔍
- Timezone validation
- Date format validation
- Ticker format validation
- Multiple outcome creation
- Already processed operations

## 🛠️ Troubleshooting

### Common Issues

**1. Authentication Errors (401)**
```bash
# Ensure your admin token is valid and properly set
export ADMIN_TOKEN=your_valid_token
```

**2. Test Timeouts**
```bash
# Increase Jest timeout in package.json
"jest": {
  "testTimeout": 300000
}
```

**3. API Connection Issues**
```bash
# Verify API base URL is correct
export API_BASE_URL=http://your-api-server:port
```

**4. Snapshot Mismatches**
```bash
# Update snapshots if API responses have changed
npm test -- --updateSnapshot
```

### Debug Mode

Enable verbose logging by adding console.log statements or running:
```bash
DEBUG=* npm test
```

## 📈 Test Coverage

The test suite provides comprehensive coverage of:
- **API Endpoints**: 100% of event management endpoints
- **Status Transitions**: All valid state changes
- **Error Handling**: Authentication, validation, and business logic errors
- **Edge Cases**: Invalid inputs, duplicate operations, and boundary conditions

## 🤝 Contributing

When adding new tests:
1. Follow the existing naming conventions
2. Include both success and error scenarios
3. Add appropriate snapshots for response validation
4. Update this README with new test descriptions
5. Ensure proper cleanup of test data

## 📝 Notes

- Tests use dynamic event names with random suffixes to avoid conflicts
- Each test suite creates its own events to ensure isolation
- Timing delays in status-transition-flow.test.js can be configured via environment variables
- All responses are sanitized before snapshot comparison to remove dynamic fields
- Tests are designed to run against both development and staging environments

## 📋 Test Data Structure

### Event Payload Example
```json
{
  "ticker": "BTCTESTEVENT123456",
  "name": "Bitcoin Test Event 123456",
  "name_jp": "ビットコインテストイベント123456",
  "description": "A comprehensive test event for Bitcoin trading #123456",
  "description_jp": "ビットコイン取引のための包括的なテストイベント #123456",
  "rules": "Standard trading rules apply",
  "ends_at": "2024-11-01T12:00:00.000Z",
  "timezone": "Asia/Calcutta",
  "event_images_url": ["https://example.com/image.jpg"],
  "recommended_images_url": [],
  "top_event_images_url": [],
  "is_top_events": false,
  "is_featured_events": false,
  "og_image_url": "",
  "stream_url": ""
}
```

### Outcome Payload Example
```json
{
  "name": "Yes",
  "name_jp": "はい"
}
```

### Resolve Payload Example
```json
{
  "event_outcome_id": "outcome_id_here",
  "ends_at": "2024-10-02T12:00:00.000Z",
  "dry_run": false
}
```

## 🔍 Response Validation

The test suite uses Jest snapshots to validate API responses. Key features:
- **Sanitized Responses**: Dynamic fields (IDs, timestamps) are sanitized before comparison
- **Consistent Testing**: Ensures API responses maintain expected structure
- **Change Detection**: Automatically detects when API response formats change

### Snapshot Management
```bash
# View current snapshots
ls test/__snapshots__/

# Update all snapshots
npm test -- --updateSnapshot

# Update specific test snapshots
npm test create-event.test.js -- --updateSnapshot
```

---

**Last Updated**: October 2024  
**Test Framework**: Jest v30.2.0  
**API Version**: EverX v1.0  
**Maintainer**: Development Team