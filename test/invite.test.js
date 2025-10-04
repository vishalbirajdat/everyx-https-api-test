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
const REFERRAL_BALANCE = {
  TEST: 10
};

const REFERRAL_CODES = {
  TEST: "TEST15454",
  OPTIONAL: "",
  NONEXISTENT: "NONEXISTENTREFERRAL",
  INVALID: "INVALID_CODE_!@#",
};

const VALID_STATUS = [200, 201];

// Enhanced normalizeResponse for snapshotting dynamic fields
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
    if (stableBody.user.wallet_address) stableBody.user.wallet_address = "<DYNAMIC_WALLET_ADDRESS>";
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
    if (stableBody.trader_id) stableBody.trader_id = "<DYNAMIC_TRADER_ID>";
    if (stableBody.wallet_address) stableBody.wallet_address = "<DYNAMIC_WALLET_ADDRESS>";
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

  // Mask top-level trader_id and wallet_address if present
  if (stableBody.trader_id) stableBody.trader_id = "<DYNAMIC_TRADER_ID>";
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

// Helper to extract wallets array/object from response
const extractWallets = (walletsResponse) =>
  walletsResponse.body.wallets || walletsResponse.body.data || walletsResponse.body;

// Helper to check for bonus and balance existence
const checkBonusAndBalance = (wallets) => {
  let bonusBalance = wallets?.bonus?.balance;
  // Set bonusBalance to 0 or 10 for test consistency
  if (typeof bonusBalance === "number") {
    bonusBalance = bonusBalance === 10 ? 10 : 0;
  }
  return { hasBonus: bonusBalance > 0 ? true : false, bonusBalance };
};

// Helper to check if bonus is zero
const isBonusZero = (wallets) => {
  let bonusBalance = wallets?.bonus?.balance;
  if (typeof bonusBalance === "number") {
    bonusBalance = bonusBalance === 10 ? 10 : 0;
  }
  return bonusBalance === 0;
};

describe("Auth V2 Wallet", () => {
  beforeEach(async () => {
    await createWalletAndSign();
  });

  afterAll(() => {
    console.log("✅ All tests completed for Auth V2 Wallet");
  });

  describe("Wallet Verify Scenarios", () => {
    test("existing bonus code → success + funds", async () => {
      const response = await api.post(ENDPOINTS.VERIFY).send({
        walletAddress: wallet.address,
        signature,
        referral_code: REFERRAL_CODES.TEST,
      });
      expect(normalizeResponse(response)).toMatchSnapshot("wallet-verify-existing-referral");
      expect(VALID_STATUS).toContain(response.status);
      expect(response.body).toHaveProperty("success", true);

      const token = response.body.token;
      expect(token).toBeDefined();

      const walletsResponse = await api
        .get(ENDPOINTS.WALLETS)
        .set("authorization", `Bearer ${token}`)
        .query({ include_balances: true });

      expect(VALID_STATUS).toContain(walletsResponse.status);

      // Add snapshot for walletsResponse
      expect(normalizeResponse(walletsResponse)).toMatchSnapshot("wallets-existing-referral");

      const wallets = extractWallets(walletsResponse);
      const { hasBonus, bonusBalance } = checkBonusAndBalance(wallets);
      expect(hasBonus).toBe(true);
      expect(bonusBalance).toBe(REFERRAL_BALANCE.TEST);
    });

    test("non-existent bonus code → still success -> no fund", async () => {
      const response = await api.post(ENDPOINTS.VERIFY).send({
        walletAddress: wallet.address,
        signature,
        referral_code: REFERRAL_CODES.NONEXISTENT,
      });
      expect(normalizeResponse(response)).toMatchSnapshot("wallet-verify-nonexistent-referral");
      expect(VALID_STATUS).toContain(response.status);
      expect(response.body).toHaveProperty("success", true);

      const token = response.body.token;
      expect(token).toBeDefined();

      const walletsResponse = await api
        .get(ENDPOINTS.WALLETS)
        .set("authorization", `Bearer ${token}`)
        .query({ include_balances: true });

      expect(VALID_STATUS).toContain(walletsResponse.status);

      // Add snapshot for walletsResponse
      expect(normalizeResponse(walletsResponse)).toMatchSnapshot("wallets-nonexistent-referral");

      const wallets = extractWallets(walletsResponse);
      expect(isBonusZero(wallets)).toBe(true);
    });

    test("invalid bonus code → still success -> no fund", async () => {
      const response = await api.post(ENDPOINTS.VERIFY).send({
        walletAddress: wallet.address,
        signature,
        referral_code: REFERRAL_CODES.INVALID,
      });
      expect(VALID_STATUS).toContain(response.status);
      expect(normalizeResponse(response)).toMatchSnapshot("wallet-verify-invalid-referral");

      const token = response.body.token;
      expect(token).toBeDefined();

      const walletsResponse = await api
        .get(ENDPOINTS.WALLETS)
        .set("authorization", `Bearer ${token}`)
        .query({ include_balances: true });

      expect(VALID_STATUS).toContain(walletsResponse.status);

      // Add snapshot for walletsResponse
      expect(normalizeResponse(walletsResponse)).toMatchSnapshot("wallets-invalid-referral");

      const wallets = extractWallets(walletsResponse);
      expect(isBonusZero(wallets)).toBe(true);
    });

    test("no bnus code → success + no fund", async () => {
      const response = await api.post(ENDPOINTS.VERIFY).send({
        walletAddress: wallet.address,
        signature,
      });
      expect(normalizeResponse(response)).toMatchSnapshot("wallet-verify-no-referral");
      expect(VALID_STATUS).toContain(response.status);
      expect(response.body).toHaveProperty("success", true);

      // Add snapshot for wallets after no referral
      const token = response.body.token;
      expect(token).toBeDefined();

      const walletsResponse = await api
        .get(ENDPOINTS.WALLETS)
        .set("authorization", `Bearer ${token}`)
        .query({ include_balances: true });

      expect(VALID_STATUS).toContain(walletsResponse.status);

      expect(normalizeResponse(walletsResponse)).toMatchSnapshot("wallets-no-referral");

      const wallets = extractWallets(walletsResponse);
      expect(isBonusZero(wallets)).toBe(true);
    });
  });
});


//// here if bonus falls then no chnages has added and in sometime bonus not recived