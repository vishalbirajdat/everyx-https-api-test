const request = require("supertest");
require('dotenv').config();

// ============================================================================
// CONFIGURATION & SETUP
// ============================================================================

const api = request(process.env.API_BASE_URL || "http://localhost:8800");

// Test configuration
const TEST_CONFIG = {
  authToken: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiNjhkY2MzNjNhNTY3OGFkNzZlNDk3MmI0IiwiZW1haWwiOiJyYWh1bHB1cm9oaXRycDc4OXJwQGdtYWlsLmNvbSIsImlhdCI6MTc1OTM5NTgxMH0.L-nf4JAqw5ZsPkDBgwELzYhDd43GzeY1FSoS0S1GSFw',
  networks: {
    BSC: 'BSC',
    POLY: 'POLY'
  },
  amounts: {
    small: '0.01',
    medium: '250.75',
    large: '1000.00'
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const normalizeResponse = (response) => {
  const normalizedBody = { ...response.body };
  
  // Only normalize fields that actually exist in the response
  if (normalizedBody.timestamp) normalizedBody.timestamp = "<DYNAMIC>";
  if (normalizedBody.transaction_hash) normalizedBody.transaction_hash = "<DYNAMIC_TXN_HASH>";
  if (normalizedBody.wallet_id) normalizedBody.wallet_id = "<DYNAMIC_WALLET_ID>";
  if (normalizedBody.id) normalizedBody.id = "<DYNAMIC_ID>";
  if (normalizedBody.created_at) normalizedBody.created_at = "<DYNAMIC_DATE>";
  if (normalizedBody.updated_at) normalizedBody.updated_at = "<DYNAMIC_DATE>";
  if (normalizedBody.datetime) normalizedBody.datetime = "<DYNAMIC_DATE>";
  if (normalizedBody.trader_id) normalizedBody.trader_id = "<DYNAMIC_TRADER_ID>";
  if (normalizedBody.user_id) normalizedBody.user_id = "<DYNAMIC_USER_ID>";
  // if (normalizedBody.address) normalizedBody.address = "<DYNAMIC_ADDRESS>"; // Commented out to show real address
  if (normalizedBody.balance) normalizedBody.balance = "<DYNAMIC_BALANCE>";
  if (normalizedBody.amount) normalizedBody.amount = "<DYNAMIC_AMOUNT>";
  if (normalizedBody.sessionId) normalizedBody.sessionId = "<DYNAMIC_SESSION_ID>";
  
  return {
    status: response.status,
    body: normalizedBody
  };
};

const generateUniqueTransactionHash = () => {
  const randomHex = Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `0x${randomHex}`;
};

const logResponse = (testName, response) => {
  console.log(`${testName} Status:`, response.status);
  console.log(`${testName} Response:`, JSON.stringify(response.body, null, 2));
};

// ============================================================================
// API REQUEST HELPERS
// ============================================================================

const makeAuthenticatedRequest = (method, endpoint, data = null) => {
  let request = api[method.toLowerCase()](endpoint)
    .set('authorization', TEST_CONFIG.authToken)
    .set('accept', 'application/json');
  
  if (data) {
    if (method === 'POST' && endpoint.includes('/transaction')) {
      request = request.type('form');
    }
    request = request.send(data);
  }
  
  return request;
};

const createTransactionRequest = (txnHash, amount, network) => {
  return makeAuthenticatedRequest('POST', '/deposit/create/transaction', {
    txnHash,
    amount,
    network
  });
};

// ============================================================================
// TEST SUITE
// ============================================================================

describe("Deposit User Flow - Complete Test Suite", () => {

  // ============================================================================
  // 1. WALLET CREATION TESTS
  // ============================================================================
  
  describe("1. Wallet Creation", () => {
    it("GET /deposit/create/wallet - create deposit wallet", async () => {
      const response = await makeAuthenticatedRequest('GET', '/deposit/create/wallet');
      
      logResponse("Wallet Creation", response);
      expect(normalizeResponse(response)).toMatchSnapshot();
    });
  });

  // ============================================================================
  // 2. TRANSACTION CREATION TESTS
  // ============================================================================
  
  describe("2. Deposit Transaction Creation", () => {
    describe("Successful Transaction Creation", () => {
      it("POST /deposit/create/transaction - BSC network", async () => {
        const uniqueTxnHash = generateUniqueTransactionHash();
        const response = await createTransactionRequest(uniqueTxnHash, TEST_CONFIG.amounts.small, TEST_CONFIG.networks.BSC);
        
        logResponse("BSC Transaction", response);
        expect(response.status).toBe(201);
        expect(response.body.message).toContain("Deposit transaction submitted successfully");
        expect(response.body.network).toBe(TEST_CONFIG.networks.BSC);
      });

      it("POST /deposit/create/transaction - POLY network", async () => {
        const uniqueTxnHash = generateUniqueTransactionHash();
        const response = await createTransactionRequest(uniqueTxnHash, TEST_CONFIG.amounts.medium, TEST_CONFIG.networks.POLY);
        
        logResponse("POLY Transaction", response);
        expect(response.status).toBe(201);
        expect(response.body.message).toContain("Deposit transaction submitted successfully");
        expect(response.body.network).toBe(TEST_CONFIG.networks.POLY);
      });
    });

    describe("Validation Error Tests", () => {
      it("POST /deposit/create/transaction - duplicate transaction hash", async () => {
        const duplicateHash = "0xduplicate1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
        
        // First, create a transaction
        await createTransactionRequest(duplicateHash, "50.00", TEST_CONFIG.networks.BSC);

        // Try to create the same transaction again
        const response = await createTransactionRequest(duplicateHash, "50.00", TEST_CONFIG.networks.BSC);
        
        logResponse("Duplicate Transaction", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });

      it("POST /deposit/create/transaction - invalid transaction hash length", async () => {
        const response = await createTransactionRequest("0xshort", "100.50", TEST_CONFIG.networks.BSC);
        
        logResponse("Invalid Hash Length", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });

      it("POST /deposit/create/transaction - missing amount", async () => {
        const response = await api
          .post("/deposit/create/transaction")
          .set('authorization', TEST_CONFIG.authToken)
          .send({
            txnHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            network: TEST_CONFIG.networks.BSC
          });
        
        logResponse("Missing Amount", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });

      it("POST /deposit/create/transaction - invalid network", async () => {
        const response = await createTransactionRequest(
          "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
          "100.50",
          "INVALID"
        );
        
        logResponse("Invalid Network", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });

      it("POST /deposit/create/transaction - without authorization", async () => {
        const response = await api
          .post("/deposit/create/transaction")
          .send({
            txnHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            amount: "100.50",
            network: TEST_CONFIG.networks.BSC
          });
        
        logResponse("No Auth", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });
    });
  });

  // ============================================================================
  // 3. WALLET OPERATIONS TESTS
  // ============================================================================
  
  describe("3. Wallet Operations", () => {
    describe("Wallet Information", () => {
      it("GET /wallets - list user wallets", async () => {
        const response = await makeAuthenticatedRequest('GET', '/wallets');
        
        logResponse("Wallets List", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });

      it("GET /wallets/withdrawable-balance - get withdrawable balance", async () => {
        const response = await makeAuthenticatedRequest('GET', '/wallets/withdrawable-balance');
        
        logResponse("Withdrawable Balance", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });
    });

    describe("Individual Wallet Details", () => {
      it("GET /wallets/topup/details - get topup wallet details", async () => {
        const response = await makeAuthenticatedRequest('GET', '/wallets/topup/details');
        
        logResponse("Topup Details", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });

      it("GET /wallets/profit/details - get profit wallet details", async () => {
        const response = await makeAuthenticatedRequest('GET', '/wallets/profit/details');
        
        logResponse("Profit Details", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });

      it("GET /wallets/bonus/details - get bonus wallet details", async () => {
        const response = await makeAuthenticatedRequest('GET', '/wallets/bonus/details');
        
        logResponse("Bonus Details", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });
    });
  });

  // ============================================================================
  // 4. WALLET TRANSACTIONS TESTS
  // ============================================================================
  
  describe("4. Wallet Transactions", () => {
    describe("All Transactions", () => {
      it("GET /wallets/all/transactions - get all wallet transactions", async () => {
        const response = await makeAuthenticatedRequest('GET', '/wallets/all/transactions');
        
        logResponse("All Transactions", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });
    });

    describe("Individual Wallet Transactions", () => {
      it("GET /wallets/topup/transactions - get topup wallet transactions", async () => {
        const response = await makeAuthenticatedRequest('GET', '/wallets/topup/transactions');
        
        logResponse("Topup Transactions", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });

      it("GET /wallets/profit/transactions - get profit wallet transactions", async () => {
        const response = await makeAuthenticatedRequest('GET', '/wallets/profit/transactions');
        
        logResponse("Profit Transactions", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });

      it("GET /wallets/bonus/transactions - get bonus wallet transactions", async () => {
        const response = await makeAuthenticatedRequest('GET', '/wallets/bonus/transactions');
        
        logResponse("Bonus Transactions", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });
    });

    describe("Transaction Filters", () => {
      it("GET /wallets/topup/transactions - with date range", async () => {
        const response = await api
          .get("/wallets/topup/transactions")
          .query({
            start_date: "2024-01-01",
            end_date: "2024-12-31"
          })
          .set('authorization', TEST_CONFIG.authToken);
        
        logResponse("Date Range Transactions", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });
    });
  });

  // ============================================================================
  // 5. EDGE CASE TESTS
  // ============================================================================
  
  describe("5. Edge Case Tests", () => {
    describe("Amount Edge Cases", () => {
      it("POST /deposit/create/transaction - zero amount", async () => {
        const response = await createTransactionRequest(
          generateUniqueTransactionHash(),
          "0",
          TEST_CONFIG.networks.BSC
        );
        
        logResponse("Zero Amount", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });

      it("POST /deposit/create/transaction - negative amount", async () => {
        const response = await createTransactionRequest(
          generateUniqueTransactionHash(),
          "-10.50",
          TEST_CONFIG.networks.BSC
        );
        
        logResponse("Negative Amount", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });

      it("POST /deposit/create/transaction - very large amount", async () => {
        const response = await createTransactionRequest(
          generateUniqueTransactionHash(),
          "999999999.99",
          TEST_CONFIG.networks.BSC
        );
        
        logResponse("Very Large Amount", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });

      it("POST /deposit/create/transaction - high precision amount", async () => {
        const response = await createTransactionRequest(
          generateUniqueTransactionHash(),
          "0.001",
          TEST_CONFIG.networks.BSC
        );
        
        logResponse("High Precision Amount", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });

      it("POST /deposit/create/transaction - non-numeric amount", async () => {
        const response = await createTransactionRequest(
          generateUniqueTransactionHash(),
          "abc",
          TEST_CONFIG.networks.BSC
        );
        
        logResponse("Non-Numeric Amount", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });

      it("POST /deposit/create/transaction - empty amount", async () => {
        const response = await api
          .post("/deposit/create/transaction")
          .set('authorization', TEST_CONFIG.authToken)
          .send({
            txnHash: generateUniqueTransactionHash(),
            amount: "",
            network: TEST_CONFIG.networks.BSC
          });
        
        logResponse("Empty Amount", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });
    });

    describe("Transaction Hash Edge Cases", () => {
      it("POST /deposit/create/transaction - too short hash", async () => {
        const response = await createTransactionRequest(
          "0x123",
          "100.50",
          TEST_CONFIG.networks.BSC
        );
        
        logResponse("Short Hash", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });

      it("POST /deposit/create/transaction - too long hash", async () => {
        const longHash = "0x" + "a".repeat(100);
        const response = await createTransactionRequest(
          longHash,
          "100.50",
          TEST_CONFIG.networks.BSC
        );
        
        logResponse("Long Hash", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });

      it("POST /deposit/create/transaction - invalid characters in hash", async () => {
        const response = await createTransactionRequest(
          "0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
          "100.50",
          TEST_CONFIG.networks.BSC
        );
        
        logResponse("Invalid Hash Characters", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });

      it("POST /deposit/create/transaction - hash without 0x prefix", async () => {
        const response = await createTransactionRequest(
          "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
          "100.50",
          TEST_CONFIG.networks.BSC
        );
        
        logResponse("Hash Without Prefix", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });

      it("POST /deposit/create/transaction - empty hash", async () => {
        const response = await createTransactionRequest(
          "",
          "100.50",
          TEST_CONFIG.networks.BSC
        );
        
        logResponse("Empty Hash", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });
    });

    describe("Network Edge Cases", () => {
      it("POST /deposit/create/transaction - case sensitive network", async () => {
        const response = await createTransactionRequest(
          generateUniqueTransactionHash(),
          "100.50",
          "bsc"
        );
        
        logResponse("Case Sensitive Network", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });

      it("POST /deposit/create/transaction - empty network", async () => {
        const response = await createTransactionRequest(
          generateUniqueTransactionHash(),
          "100.50",
          ""
        );
        
        logResponse("Empty Network", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });

      it("POST /deposit/create/transaction - unsupported network", async () => {
        const response = await createTransactionRequest(
          generateUniqueTransactionHash(),
          "100.50",
          "ETH"
        );
        
        logResponse("Unsupported Network", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });

      it("POST /deposit/create/transaction - special characters in network", async () => {
        const response = await createTransactionRequest(
          generateUniqueTransactionHash(),
          "100.50",
          "BSC@#$"
        );
        
        logResponse("Special Characters Network", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });
    });

    describe("Date Filter Edge Cases", () => {
      it("GET /wallets/topup/transactions - invalid date format", async () => {
        const response = await api
          .get("/wallets/topup/transactions")
          .query({
            start_date: "2024-13-45",
            end_date: "2024-12-31"
          })
          .set('authorization', TEST_CONFIG.authToken);
        
        logResponse("Invalid Date Format", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });

      it("GET /wallets/topup/transactions - future dates", async () => {
        const response = await api
          .get("/wallets/topup/transactions")
          .query({
            start_date: "2030-01-01",
            end_date: "2030-12-31"
          })
          .set('authorization', TEST_CONFIG.authToken);
        
        logResponse("Future Dates", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });

      it("GET /wallets/topup/transactions - malformed date", async () => {
        const response = await api
          .get("/wallets/topup/transactions")
          .query({
            start_date: "not-a-date",
            end_date: "2024-12-31"
          })
          .set('authorization', TEST_CONFIG.authToken);
        
        logResponse("Malformed Date", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });

      it("GET /wallets/topup/transactions - inverted date range", async () => {
        const response = await api
          .get("/wallets/topup/transactions")
          .query({
            start_date: "2024-12-31",
            end_date: "2024-01-01"
          })
          .set('authorization', TEST_CONFIG.authToken);
        
        logResponse("Inverted Date Range", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });
    });

    describe("Wallet Type Edge Cases", () => {
      it("GET /wallets/invalid_wallet_type/details - invalid wallet type", async () => {
        const response = await makeAuthenticatedRequest('GET', '/wallets/invalid_wallet_type/details');
        
        logResponse("Invalid Wallet Type", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });

      it("GET /wallets/TOPUP/details - case sensitive wallet type", async () => {
        const response = await makeAuthenticatedRequest('GET', '/wallets/TOPUP/details');
        
        logResponse("Case Sensitive Wallet Type", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });

      it("GET /wallets//details - empty wallet type", async () => {
        const response = await makeAuthenticatedRequest('GET', '/wallets//details');
        
        logResponse("Empty Wallet Type", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });
    });

    describe("Authentication Edge Cases", () => {
      it("GET /deposit/create/wallet - malformed token", async () => {
        const response = await api
          .get("/deposit/create/wallet")
          .set('authorization', 'Bearer invalid-token');
        
        logResponse("Malformed Token", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });

      it("GET /deposit/create/wallet - token without Bearer", async () => {
        const response = await api
          .get("/deposit/create/wallet")
          .set('authorization', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
        
        logResponse("Token Without Bearer", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });

      it("GET /deposit/create/wallet - empty authorization", async () => {
        const response = await api
          .get("/deposit/create/wallet")
          .set('authorization', '');
        
        logResponse("Empty Authorization", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });
    });

    describe("Request Body Edge Cases", () => {
      it("POST /deposit/create/transaction - extra fields", async () => {
        const response = await api
          .post("/deposit/create/transaction")
          .set('authorization', TEST_CONFIG.authToken)
          .send({
            txnHash: generateUniqueTransactionHash(),
            amount: "100.50",
            network: TEST_CONFIG.networks.BSC,
            extraField: "should be ignored",
            anotherField: 123
          });
        
        logResponse("Extra Fields", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });

      it("POST /deposit/create/transaction - wrong data types", async () => {
        const response = await api
          .post("/deposit/create/transaction")
          .set('authorization', TEST_CONFIG.authToken)
          .send({
            txnHash: 123456789, // Should be string
            amount: 100.50, // Should be string
            network: TEST_CONFIG.networks.BSC
          });
        
        logResponse("Wrong Data Types", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });
    });
  });

  // ============================================================================
  // 6. ERROR SCENARIOS TESTS
  // ============================================================================
  
  describe("6. Error Scenarios", () => {
    describe("Authentication Errors", () => {
      it("GET /deposit/create/wallet - without authorization", async () => {
        const response = await api.get("/deposit/create/wallet");
        
        logResponse("No Auth Wallet", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });

      it("GET /wallets - without authorization", async () => {
        const response = await api.get("/wallets");
        
        logResponse("No Auth Wallets", response);
        expect(normalizeResponse(response)).toMatchSnapshot();
      });
    });
  });
});