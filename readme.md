# Event Creation API Test Suite

This test suite provides comprehensive testing for the Event Creation API with snapshot testing to ensure consistent API responses.

## 🚀 Quick Start

### Prerequisites
- Node.js and npm installed
- Ebtex backend running locally (default: http://localhost:8800)
- Admin credentials configured

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Create a `.env` file in the project root:
   ```env
   # API Configuration
   API_BASE_URL=http://localhost:8800
   
   # Admin Authentication
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=123456
   
   # Alternative: Use admin token directly if login endpoint is not available
   ADMIN_TOKEN=your-admin-jwt-token-here
   ```

3. **Run the tests:**
   ```bash
   # Run all tests
   npm test
   
   # Run only event creation tests
   npm test -- test/create-event.test.js
   
   # Update snapshots (when API responses change intentionally)
   npm test -- --updateSnapshot
   ```

## 📋 Test Coverage

### Event Creation Tests (`POST /admin/events`)

#### ✅ **Success Cases**
- **Valid event creation** - Complete event with all fields
- **Minimal event creation** - Only required fields
- **Full featured event** - All optional fields included
- **Different status values** - created, open, closed
- **Image URL variations** - Single URLs vs arrays
- **Unicode support** - International characters and emojis

#### ❌ **Validation Error Cases**
- **Authentication errors** - Missing/invalid tokens
- **Required field validation** - Missing ticker, name, description, ends_at
- **Format validation** - Invalid ticker format, date format, URL format
- **Business logic** - Duplicate ticker validation

#### 🔍 **Edge Cases**
- **Past start dates** - Events starting in the past
- **Long content** - Very long descriptions
- **Special characters** - Names with special characters
- **Null/empty values** - Optional fields with null or empty strings

## 🧪 Snapshot Testing

This test suite uses **snapshot testing** to ensure API responses remain consistent. Snapshots capture:

- **Response status codes**
- **Response body structure**
- **Error messages and validation details**
- **Dynamic fields are normalized** (timestamps, IDs, etc.)

### Key Features:

1. **Hardcoded Test Data:**
   ```javascript
   // Fixed, consistent data for every test run
   MAIN_EVENT: {
     ticker: "TESTAPI001",
     name: "Fixed Test Event for API Testing",
     ends_at: "2025-01-01T18:00:00.000Z"
   }
   ```

2. **Smart Cleanup System:**
   ```javascript
   // Checks if data exists and removes it before creating
   await checkAndCleanupEvent(eventData);
   // Then creates fresh event
   await createEventWithCleanup(eventData);
   ```

3. **Dynamic Field Normalization:**
   ```javascript
   // Dynamic fields are replaced with placeholders
   _id: "<DYNAMIC_EVENT_ID>"
   created_at: "<DYNAMIC_TIMESTAMP>"
   code: "<DYNAMIC_EVENT_CODE>"
   ```

4. **Admin Authentication:**
   ```javascript
   // Automatic admin authentication with fallback options
   const token = await authenticateAdmin();
   ```

## 🧪 How It Works

Each test follows this pattern:

1. **Setup:** Use predefined hardcoded test data
2. **Check & Cleanup:** Verify if event exists in database and remove it
3. **Create:** Make API call to create fresh event
4. **Verify:** Compare normalized response with snapshot

### Example Test Flow:
```javascript
// 1. Use hardcoded test data (same every time)
const eventData = HARDCODED_TEST_DATA.MAIN_EVENT;

// 2. Smart cleanup and creation
const response = await createEventWithCleanup(eventData);
// This function:
// - Checks if event exists: GET /admin/events/{ticker}
// - If exists, deletes it: DELETE /admin/events/{ticker}
// - Creates fresh event: POST /admin/events

// 3. Normalize dynamic fields and snapshot
expect(normalizeResponse(response)).toMatchSnapshot();
```

### Hardcoded Test Data Examples:
```javascript
MAIN_EVENT: {
  ticker: "TESTAPI001",
  name: "Fixed Test Event for API Testing",
  description: "This is a fixed test event...",
  ends_at: "2025-01-01T18:00:00.000Z"
}

MINIMAL_EVENT: {
  ticker: "TESTMIN001", 
  name: "Minimal Fixed Test Event",
  description: "Minimal test event...",
  ends_at: "2025-01-01T20:00:00.000Z"
}

DUPLICATE_EVENT: {
  ticker: "TESTDUP001",
  name: "Duplicate Test Event",
  description: "Event for testing duplicate ticker validation",
  ends_at: "2025-01-01T21:00:00.000Z"
}
```

## 📁 Test Structure

```
test/
├── create-event.test.js           # Main event creation tests
├── user.test.js                   # User authentication tests
└── __snapshots__/                 # Generated snapshot files
    ├── create-event.test.js.snap  # Event creation snapshots
    └── user.test.js.snap          # User login snapshots
```

## 🔧 Configuration Options

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `API_BASE_URL` | `http://localhost:8800` | Backend API endpoint |
| `ADMIN_USERNAME` | `admin` | Admin username for authentication |
| `ADMIN_PASSWORD` | `123456` | Admin password for authentication |
| `ADMIN_TOKEN` | - | Direct admin JWT token (fallback) |

### Timing Configuration Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RESOLVE_DELAY` | `30000` | Delay before resolving an event (milliseconds) |
| `PAUSE_DELAY` | `5000` | Delay after pausing an event (milliseconds) |
| `OPEN_DELAY` | `2000` | Delay after opening an event (milliseconds) |
| `CLOSE_DELAY` | `3000` | Delay after closing an event (milliseconds) |

#### Example Timing Configurations:

**Fast Testing (for development):**
```env
RESOLVE_DELAY=5000    # 5 seconds
PAUSE_DELAY=1000      # 1 second
OPEN_DELAY=500        # 0.5 seconds
CLOSE_DELAY=1000      # 1 second
```

**Production-like Testing:**
```env
RESOLVE_DELAY=120000  # 2 minutes
PAUSE_DELAY=10000     # 10 seconds
OPEN_DELAY=5000       # 5 seconds
CLOSE_DELAY=15000     # 15 seconds
```

**Custom Timing:**
```env
RESOLVE_DELAY=60000   # 1 minute
PAUSE_DELAY=3000      # 3 seconds
OPEN_DELAY=2000       # 2 seconds
CLOSE_DELAY=5000      # 5 seconds
```

### Authentication Methods

The test suite supports multiple authentication methods:

1. **Admin Login Endpoint** (Primary):
   ```javascript
   POST /admin/login
   { username: "admin", password: "123456" }
   ```

2. **Environment Token** (Fallback):
   ```bash
   ADMIN_TOKEN=your-jwt-token-here
   ```

## 📊 Test Examples

### Running Specific Test Groups

```bash
# Run only validation error tests
npm test -- --grep "Validation Errors"

# Run only success cases
npm test -- --grep "Event Creation"

# Run edge case tests
npm test -- --grep "Edge Cases"
```

### Updating Snapshots

When API responses change intentionally (e.g., new fields added):

```bash
# Update all snapshots
npm test -- --updateSnapshot

# Update specific test snapshots
npm test -- test/create-event.test.js --updateSnapshot
```

### Debugging Failed Tests

```bash
# Run tests with verbose output
npm test -- --verbose

# Run single test for debugging
npm test -- --grep "should create event successfully"
```

## 🚨 Troubleshooting

### Common Issues

#### 1. **Admin Authentication Failed**
```
Error: Admin authentication failed. Please set ADMIN_TOKEN environment variable
```
**Solution:** 
- Ensure backend is running
- Check admin credentials in `.env` file
- Set `ADMIN_TOKEN` directly if login endpoint is not available

#### 2. **Connection Refused**
```
Error: connect ECONNREFUSED 127.0.0.1:8800
```
**Solution:**
- Verify backend is running on correct port
- Check `API_BASE_URL` in `.env` file

#### 3. **Snapshot Mismatch**
```
Snapshot mismatch: received value does not match stored snapshot
```
**Solution:**
- Review the changes in the snapshot diff
- Update snapshots if changes are intentional: `npm test -- --updateSnapshot`
- Fix the API if changes are unintentional

#### 4. **Duplicate Ticker Errors**
```
409 Conflict: Ticker already exists
```
**Solution:**
- Tests generate unique tickers automatically
- If still occurring, ensure test cleanup is working
- Manually clean test data from database if needed

## 📈 Best Practices

### Writing New Tests

1. **Use descriptive test names:**
   ```javascript
   it("should reject event creation with invalid ticker format", async () => {
   ```

2. **Generate unique test data:**
   ```javascript
   const eventData = generateUniqueEventData();
   ```

3. **Normalize dynamic fields:**
   ```javascript
   expect(normalizeResponse(response)).toMatchSnapshot();
   ```

4. **Test both success and error cases:**
   ```javascript
   // Test success
   expect(response.status).toBe(201);
   
   // Test validation error
   expect(response.status).toBe(400);
   ```

### Maintaining Snapshots

1. **Review snapshot changes carefully**
2. **Update snapshots only when API changes are intentional**
3. **Keep snapshots in version control**
4. **Document significant API changes**

## 🎯 Expected Results

When tests pass successfully, you should see:

```
✅ Event Creation API Snapshot Testing
  ✅ POST /admin/events - Event Creation
    ✅ should create event successfully with valid data
    ✅ should create event with minimal required fields
    ✅ should create event with all optional fields
  ✅ POST /admin/events - Validation Errors
    ✅ should reject event creation without authentication
    ✅ should reject event creation with invalid ticker format
    ... (and more)

Test Suites: 1 passed
Tests: 25+ passed
Snapshots: 25+ passed
```

## 🔍 Monitoring and CI/CD

### Continuous Integration

Add to your CI pipeline:

```yaml
# Example GitHub Actions
- name: Run Event Creation Tests
  run: |
    npm install
    npm test test/create-event.test.js
  env:
    API_BASE_URL: http://localhost:8800
    ADMIN_TOKEN: ${{ secrets.ADMIN_TOKEN }}
```

### Test Reporting

Generate test reports:

```bash
# Generate coverage report
npm test -- --coverage

# Generate JSON report
npm test -- --json --outputFile=test-results.json
```

---

## 🎉 Success Criteria

Your event creation API tests are working correctly when:

1. ✅ All test cases pass consistently
2. ✅ Snapshots capture expected response formats
3. ✅ Authentication works automatically
4. ✅ Unique test data prevents conflicts
5. ✅ Error cases are properly validated
6. ✅ Edge cases are handled gracefully

**Happy Testing! 🚀**