# Order Creation and Trading Flow Test Suite

## Overview

This comprehensive test suite (`order-creation.test.js`) validates the complete end-to-end trading workflow of the EveryX platform, from event creation to resolution and payout distribution. The tests simulate real-world trading scenarios with multiple users placing bets on different outcomes.

## What This Test Suite Covers

The test suite validates the following core functionality:

1. **Event Management**: Creates test events with multiple outcomes
2. **User Authentication**: Generates authentication tokens for test users
3. **Wallet Operations**: Retrieves user wallet information
4. **Quote Generation**: Tests real-time quote calculation for wagers
5. **Wager Creation**: Places bets across different outcomes and users
6. **Position Tracking**: Monitors user positions before and after resolution
7. **Event Lifecycle**: Tests event closure and resolution processes
8. **Payout Resolution**: Validates win/loss calculations post-event

## Test Structure

### Prerequisites
- Node.js environment with Jest testing framework
- Valid `ADMIN_TOKEN` in environment variables
- API endpoint accessible via `API_BASE_URL` (defaults to `http://localhost:8800`)
- Test user accounts with email addresses defined in `TEST_USERS` array

### Test Users
The suite uses three predefined test user accounts:
- `dny9136833946@gmail.com` (User 1)
- `1032220499@tcetmumbai.in` (User 2)  
- `yadavdeepak5112001@gmail.com` (User 3)

### Test Flow

#### 1. Event Setup (beforeAll)
- Creates a randomly-named test event with 30-day expiry
- Adds two outcomes: "Team A Wins" and "Team B Wins" (labeled A and B)
- Opens the event for trading
- Retrieves event details and minimum pledge requirements

#### 2. User Authentication Tests
- Generates JWT tokens for all three test users
- Stores tokens for subsequent test operations
- Uses snapshot testing for response validation

#### 3. Wallet Information Tests
- Retrieves wallet details for each authenticated user
- Stores wallet IDs for wager creation
- Validates wallet structure (topup, profit, bonus)

#### 4. Quote Generation Tests
- Creates individual quote requests for each user-outcome combination
- Tests both outcome A (Team A Wins) and outcome B (Team B Wins)
- Validates quote calculations and indicative payouts

#### 5. Wager Creation Tests
- Places actual bets using the generated quotes
- Each user creates wagers on both outcomes
- Uses minimum pledge amounts with 1.0 leverage
- Tracks indicative payouts for maximum payout validation

#### 6. Pre-Resolution Verification
- Checks user positions after all wagers are placed
- Verifies event remains open for trading
- Confirms all positions are marked as 'open'

#### 7. Event Closure Tests
- Adds a 12-second delay before closure (simulating real-world timing)
- Closes the event for resolution
- Verifies event status changes to 'closed'

#### 8. Event Resolution Tests
- Resolves the event with Outcome A as the winner
- Sets resolution timestamp 2 minutes in the future
- Verifies event status changes to 'resolved'

#### 9. Post-Resolution Analysis
- Checks final user positions after resolution
- Validates win/loss calculations:
  - Users betting on Outcome A should have 'WIN' status
  - Users betting on Outcome B should have 'LOSS' status
- All positions change from 'open' to 'closed' type

## Key Features

### Dynamic Event Creation
- Uses random suffixes to avoid test conflicts
- Creates realistic event data with Japanese translations
- Sets appropriate timezones (Asia/Calcutta)

### Multi-User Scenarios
- Tests concurrent trading by multiple users
- Validates isolation between user accounts
- Ensures consistent behavior across different user types

### State Management
- Tracks created events, outcomes, and user data globally
- Maintains authentication state across test suites
- Preserves wallet and position information throughout the flow

### Snapshot Testing
- Uses `sanitizeResponse()` utility to ensure consistent snapshots
- Removes dynamic values (IDs, timestamps, tokens)
- Enables reliable regression testing

### Error Handling
- Validates all API responses return expected status codes
- Checks for proper error conditions
- Ensures graceful failure handling

## Running the Tests

### Prerequisites
1. Ensure API server is running and accessible
2. Set `ADMIN_TOKEN` environment variable
3. Verify test user accounts exist in the system
4. Install dependencies: `npm install`

### Command
```bash
npm test order-creation.test.js
```

### Environment Variables
Required environment variables:
- `ADMIN_TOKEN`: Valid admin authentication token
- `API_BASE_URL`: API endpoint (optional, defaults to localhost:8800)

## Expected Behavior

### Successful Test Run
- All tests should pass with exit code 0
- Snapshots should match existing snapshots or be updated
- Console output should show progression through test stages
- No authentication or API errors should occur

### Test Data Cleanup
- Test events created during execution should be cleaned up automatically
- User tokens expire naturally after test completion
- No persistent test data should remain in production systems

## API Endpoints Tested

### Admin Endpoints
- `POST /admin/events` - Event creation
- `POST /admin/events/{code}/outcomes` - Add outcomes
- `POST /admin/events/{code}/open` - Open event for trading
- `POST /admin/events/{id}/close` - Close event
- `POST /admin/events/{id}/resolve` - Resolve event
- `POST /admin/dev-scripts/generate-user-token` - Generate auth tokens

### User Endpoints
- `GET /wallets` - Retrieve wallet information
- `POST /quotes` - Generate trading quotes
- `POST /wagers` - Place wagers
- `GET /wagers/events/{code}` - Get positions
- `GET /events/{code}` - Get event details

## Troubleshooting

### Common Issues
1. **Authentication Failures**: Verify `ADMIN_TOKEN` is valid
2. **API Timeouts**: Check API server connectivity and health
3. **User Not Found**: Ensure test user emails exist in the system
4. **Quote Generation Failures**: Verify event is properly opened and has outcomes

### Debug Information
- Test output includes detailed console logging
- Response structures are logged for debugging
- Snapshot mismatches indicate potential changes in API responses

## Maintenance Notes

### Updating Snapshots
When API responses change intentionally:
```bash
npm test -- --updateSnapshots
```

### Adding New Test Scenarios
Add new tests within existing describe blocks to maintain test organization

### Updating Test Users
Modify the `TEST_USERS` array if test user accounts change

### Timeout Adjustments
The Jest timeout is set to 5 minutes (300000ms) in package.json for complex operations

This test suite serves as a critical component of the EveryX platform's quality assurance, ensuring reliability and consistency across the entire trading lifecycle.
