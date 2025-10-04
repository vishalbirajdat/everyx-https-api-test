const request = require("supertest");
require("dotenv").config();
const { ethers } = require("ethers");

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8800";
const api = request(API_BASE_URL);

const ENDPOINTS = {
  NONCE: "/auth/v2/wallet/nonce",
  VERIFY: "/auth/v2/wallet/verify",
  WALLETS: "/wallets",
};

const VALID_STATUS = [200, 201];

// Helper to mask dynamic fields in the response for snapshot testing
const normalizeResponse = (response) => {
  const stableBody = { ...response.body };

  // Mask dynamic fields that will change in each query/test
  if (stableBody.timestamp) stableBody.timestamp = "<DYNAMIC_TIMESTAMP>";
  if (stableBody.sessionId) stableBody.sessionId = "<DYNAMIC_SESSION_ID>";

  // Mask dynamic fields in user object if present
  if (stableBody.user) {
    if (stableBody.user.id) stableBody.user.id = "<DYNAMIC_USER_ID>";
    if (stableBody.user.email) stableBody.user.email = "<DYNAMIC_EMAIL>";
    if (stableBody.user.trader_id) stableBody.user.trader_id = "<DYNAMIC_TRADER_ID>";
  }

  // Mask dynamic fields in tracking_data if present
  if (stableBody.tracking_data) {
    if (stableBody.tracking_data.wallet_address)
      stableBody.tracking_data.wallet_address = "<DYNAMIC_WALLET_ADDRESS>";
    if (stableBody.tracking_data.ip)
      stableBody.tracking_data.ip = "<DYNAMIC_IP>";
  }

  // Mask dynamic token if present
  if (stableBody.token) stableBody.token = "<DYNAMIC_TOKEN>";

  // Mask dynamic fields in error/validation if present
  if (stableBody.validation && Array.isArray(stableBody.validation.keys)) {
    stableBody.validation.keys = stableBody.validation.keys.map((k) =>
      typeof k === "string" ? "<DYNAMIC_KEY>" : k
    );
  }

  // Mask dynamic fields in balances/wallets if present
  if (stableBody.balances) {
    Object.keys(stableBody.balances).forEach((k) => {
      if (typeof stableBody.balances[k] === "number") {
        // leave as is, usually 0
      }
    });
  }
  if (stableBody.wallets) {
    Object.keys(stableBody.wallets).forEach((k) => {
      if (stableBody.wallets[k].id) stableBody.wallets[k].id = "<DYNAMIC_WALLET_ID>";
      if (stableBody.wallets[k].last_transaction_at !== undefined)
        stableBody.wallets[k].last_transaction_at = "<DYNAMIC_LAST_TX_AT>";
      if (stableBody.wallets[k].wallet_address)
        stableBody.wallets[k].wallet_address = "<DYNAMIC_WALLET_ADDRESS>";
      if (stableBody.wallets[k].trader_id)
        stableBody.wallets[k].trader_id = "<DYNAMIC_TRADER_ID>";
      // Set bonus.balance to 0 or 10 if present
      if (
        stableBody.wallets[k].bonus &&
        typeof stableBody.wallets[k].bonus === "object" &&
        typeof stableBody.wallets[k].bonus.balance === "number"
      ) {
        stableBody.wallets[k].bonus.balance =
          stableBody.wallets[k].bonus.balance === 10 ? 10 : 0;
      }
    });
  }

  // Mask top-level trader_id if present
  if (stableBody.trader_id) stableBody.trader_id = "<DYNAMIC_TRADER_ID>";
  // Mask top-level wallet_address if present
  if (stableBody.wallet_address) stableBody.wallet_address = "<DYNAMIC_WALLET_ADDRESS>";

  return { status: response.status, body: stableBody };
};

let wallet, signature, nonceResponse;

const createWalletAndSign = async () => {
  wallet = ethers.Wallet.createRandom();
  nonceResponse = await api.post(ENDPOINTS.NONCE).send({ walletAddress: wallet.address });
  if (nonceResponse.status !== 200) throw new Error("Failed to get nonce");
  const { nonce } = nonceResponse.body;
  signature = await wallet.signMessage(nonce);
  return { wallet, signature, nonceResponse };
};

describe("Auth V2 Wallet", () => {
  beforeEach(async () => {
    await createWalletAndSign();
  });

  afterAll(() => {
    console.log("✅ All tests completed for Auth V2 Wallet");
  });

  describe("Wallet Verify Scenarios", () => {
    test("no referral code → success", async () => {
      const response = await api.post(ENDPOINTS.VERIFY).send({
        walletAddress: wallet.address,
        signature,
      });
      expect(normalizeResponse(response)).toMatchSnapshot("wallet-verify-no-referral");
      expect(VALID_STATUS).toContain(response.status);
      expect(response.body).toHaveProperty("success", true);
    });

    test("wrong signature → fail", async () => {
      const response = await api.post(ENDPOINTS.VERIFY).send({
        walletAddress: wallet.address,
        signature: "0xWRONGSIGNATURE",
      });
      expect([400, 401, 403]).toContain(response.status);
      expect(normalizeResponse(response)).toMatchSnapshot("wallet-verify-wrong-signature");
    });

    test("wrong wallet address → fail", async () => {
      const response = await api.post(ENDPOINTS.VERIFY).send({
        walletAddress: "0x0000000000000000000000000000000000000000",
        signature,
      });
      // The API may return 400, 401, or 403 for wrong wallet address.
      expect([400, 401, 403]).toContain(response.status);
      expect(normalizeResponse(response)).toMatchSnapshot("wallet-verify-wrong-wallet");
    });

    test("missing wallet address → fail", async () => {
      const response = await api.post(ENDPOINTS.VERIFY).send({ signature });
      expect(response.status).toBe(400);
      expect(normalizeResponse(response)).toMatchSnapshot("wallet-verify-missing-wallet");
    });

    test("missing signature → fail", async () => {
      const response = await api.post(ENDPOINTS.VERIFY).send({ walletAddress: wallet.address });
      expect(response.status).toBe(400);
      expect(normalizeResponse(response)).toMatchSnapshot("wallet-verify-missing-signature");
    });

    test("empty payload → fail", async () => {
      const response = await api.post(ENDPOINTS.VERIFY).send({});
      expect(response.status).toBe(400);
      expect(normalizeResponse(response)).toMatchSnapshot("wallet-verify-empty-payload");
    });
  });
});


// if sign is not valid then api response 500 is coming which is wrong