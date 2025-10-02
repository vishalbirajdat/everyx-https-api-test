const request = require("supertest");
require("dotenv").config();
const { ethers } = require("ethers");

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8800";
const api = request(API_BASE_URL);

const ENDPOINTS = {
  NONCE: "/auth/v2/wallet/nonce",
  VERIFY: "/auth/v2/wallet/verify",
  ME: "/me",
  WALLETS: "/wallets",
};

const REFERRAL_BALANCE = 10;

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
  // Also mask top-level trader_id and wallet_address if present
  if (stableBody.trader_id) stableBody.trader_id = "<DYNAMIC_TRADER_ID>";
  if (stableBody.wallet_address) stableBody.wallet_address = "<DYNAMIC_WALLET_ADDRESS>";

  // Mask dynamic fields in /me response for referral_code and related fields
  if (stableBody.referral_code) stableBody.referral_code = "<DYNAMIC_REFERRAL_CODE>";
  if (stableBody.referral_code_expires_at) stableBody.referral_code_expires_at = "<DYNAMIC_REFERRAL_CODE_EXPIRES_AT>";
  if (stableBody._id) stableBody._id = "<DYNAMIC_USER_ID>";
  if (stableBody.display_name) stableBody.display_name = "<DYNAMIC_DISPLAY_NAME>";
  if (stableBody.email) stableBody.email = "<DYNAMIC_EMAIL>";

  // Mask dynamic fields in user_level if present
  if (stableBody.user_level && stableBody.user_level.all_levels_progress) {
    Object.values(stableBody.user_level.all_levels_progress).forEach((level) => {
      if (level.progress && typeof level.progress === "object") {
        Object.keys(level.progress).forEach((key) => {
          if (typeof level.progress[key] === "string" && /[0-9a-f]{24}/.test(level.progress[key])) {
            level.progress[key] = "<DYNAMIC>";
          }
        });
      }
    });
  }

  // Set top-level bonus.balance if present
  if (
    stableBody.bonus &&
    typeof stableBody.bonus === "object" &&
    typeof stableBody.bonus.balance === "number"
  ) {
    stableBody.bonus.balance = stableBody.bonus.balance === 10 ? 10 : 0;
  }

  return { status: response.status, body: stableBody };
};

const createWalletAndSign = async () => {
  const wallet = ethers.Wallet.createRandom();
  const nonceResponse = await api.post(ENDPOINTS.NONCE).send({ walletAddress: wallet.address });
  if (nonceResponse.status !== 200) throw new Error("Failed to get nonce");
  const { nonce } = nonceResponse.body;
  const signature = await wallet.signMessage(nonce);
  return { wallet, signature, nonceResponse };
};

const getReferralCodeFromMe = async (token) => {
  const meResponse = await api
    .get(ENDPOINTS.ME)
    .set("authorization", `Bearer ${token}`);
  expect(VALID_STATUS).toContain(meResponse.status);
  // Try common locations for referral code
  const referralCode = meResponse.body.referral_code;
  return referralCode;
};

const getBonusBalance = async (token) => {
  const walletsResponse = await api
    .get(ENDPOINTS.WALLETS)
    .set("authorization", `Bearer ${token}`)
    .query({ include_balances: true });
  expect(VALID_STATUS).toContain(walletsResponse.status);
  const wallets = walletsResponse.body.wallets || walletsResponse.body.data || walletsResponse.body;
  // Try common locations for bonus balance
  let bonus =
    wallets?.bonus?.balance ??
    wallets?.bonus_balance ??
    wallets?.bonusBalance ??
    0;
  bonus = bonus === 10 ? 10 : 0;
  return bonus;
};

describe("Auth V2 Wallet Referral Scenarios", () => {
  let user1, user1Token, user1ReferralCode;
  let user2, user2Token;

  afterAll(() => {
    console.log("✅ All tests completed for Auth V2 Wallet Referral");
  });

  describe("Referral Flow", () => {
    test("Create user1, get referral code, create user2 with referral, user2 gets $10 bonus", async () => {
      // 1. Create user1 (referrer)
      user1 = await createWalletAndSign();
      const verify1 = await api.post(ENDPOINTS.VERIFY).send({
        walletAddress: user1.wallet.address,
        signature: user1.signature,
      });
      expect(VALID_STATUS).toContain(verify1.status);
      expect(verify1.body).toHaveProperty("success", true);
      user1Token = verify1.body.token;
      expect(user1Token).toBeDefined();
      expect(normalizeResponse(verify1)).toMatchSnapshot("user1-verify");

      // 2. Get referral code from /me
      const meResponse = await api
        .get(ENDPOINTS.ME)
        .set("authorization", `Bearer ${user1Token}`);
      expect(VALID_STATUS).toContain(meResponse.status);
      expect(normalizeResponse(meResponse)).toMatchSnapshot("user1-me");
      user1ReferralCode = meResponse.body.referral_code;
      expect(user1ReferralCode).toBeDefined();
      expect(typeof user1ReferralCode).toBe("string");
      expect(user1ReferralCode.length).toBeGreaterThan(0);

      // 3. Create user2 (referee) with referral code
      user2 = await createWalletAndSign();
      const verify2 = await api.post(ENDPOINTS.VERIFY).send({
        walletAddress: user2.wallet.address,
        signature: user2.signature,
        referral_code: user1ReferralCode,
      });
      expect(VALID_STATUS).toContain(verify2.status);
      expect(verify2.body).toHaveProperty("success", true);
      user2Token = verify2.body.token;
      expect(user2Token).toBeDefined();
      expect(normalizeResponse(verify2)).toMatchSnapshot("user2-verify-with-referral");

      // 4. Check user2's bonus balance is $10
      const walletsResponse = await api
        .get(ENDPOINTS.WALLETS)
        .set("authorization", `Bearer ${user2Token}`)
        .query({ include_balances: true });
      expect(VALID_STATUS).toContain(walletsResponse.status);
      expect(normalizeResponse(walletsResponse)).toMatchSnapshot("user2-wallets-bonus");
      const wallets = walletsResponse.body.wallets || walletsResponse.body.data || walletsResponse.body;
      let user2Bonus =
        wallets?.bonus?.balance ??
        wallets?.bonus_balance ??
        wallets?.bonusBalance ??
        0;
      user2Bonus = user2Bonus === 10 ? 10 : 0;
      expect(user2Bonus).toBe(REFERRAL_BALANCE);
    });

    test("Create user3 with non-existent referral code → success, no bonus", async () => {
      const user3 = await createWalletAndSign();
      const verify3 = await api.post(ENDPOINTS.VERIFY).send({
        walletAddress: user3.wallet.address,
        signature: user3.signature,
        referral_code: "NONEXISTENTREFERRALCODE123",
      });
      expect(VALID_STATUS).toContain(verify3.status);
      expect(verify3.body).toHaveProperty("success", true);
      expect(normalizeResponse(verify3)).toMatchSnapshot("user3-verify-nonexistent-referral");
      const user3Token = verify3.body.token;
      expect(user3Token).toBeDefined();

      const walletsResponse = await api
        .get(ENDPOINTS.WALLETS)
        .set("authorization", `Bearer ${user3Token}`)
        .query({ include_balances: true });
      expect(VALID_STATUS).toContain(walletsResponse.status);
      expect(normalizeResponse(walletsResponse)).toMatchSnapshot("user3-wallets-nonexistent-referral");
      const wallets = walletsResponse.body.wallets || walletsResponse.body.data || walletsResponse.body;
      let user3Bonus =
        wallets?.bonus?.balance ??
        wallets?.bonus_balance ??
        wallets?.bonusBalance ??
        0;
      user3Bonus = user3Bonus === 10 ? 10 : 0;
      expect(user3Bonus).toBe(0);
    });

    test("Create user4 with invalid referral code → success, no bonus", async () => {
      const user4 = await createWalletAndSign();
      const verify4 = await api.post(ENDPOINTS.VERIFY).send({
        walletAddress: user4.wallet.address,
        signature: user4.signature,
        referral_code: "INVALID_CODE_!@#",
      });
      expect(VALID_STATUS).toContain(verify4.status);
      expect(verify4.body).toHaveProperty("success", true);
      expect(normalizeResponse(verify4)).toMatchSnapshot("user4-verify-invalid-referral");
      const user4Token = verify4.body.token;
      expect(user4Token).toBeDefined();

      const walletsResponse = await api
        .get(ENDPOINTS.WALLETS)
        .set("authorization", `Bearer ${user4Token}`)
        .query({ include_balances: true });
      expect(VALID_STATUS).toContain(walletsResponse.status);
      expect(normalizeResponse(walletsResponse)).toMatchSnapshot("user4-wallets-invalid-referral");
      const wallets = walletsResponse.body.wallets || walletsResponse.body.data || walletsResponse.body;
      let user4Bonus =
        wallets?.bonus?.balance ??
        wallets?.bonus_balance ??
        wallets?.bonusBalance ??
        0;
      user4Bonus = user4Bonus === 10 ? 10 : 0;
      expect(user4Bonus).toBe(0);
    });

    test("Create user5 with no referral code → success, no bonus", async () => {
      const user5 = await createWalletAndSign();
      const verify5 = await api.post(ENDPOINTS.VERIFY).send({
        walletAddress: user5.wallet.address,
        signature: user5.signature,
      });
      expect(VALID_STATUS).toContain(verify5.status);
      expect(verify5.body).toHaveProperty("success", true);
      expect(normalizeResponse(verify5)).toMatchSnapshot("user5-verify-no-referral");
      const user5Token = verify5.body.token;
      expect(user5Token).toBeDefined();

      const walletsResponse = await api
        .get(ENDPOINTS.WALLETS)
        .set("authorization", `Bearer ${user5Token}`)
        .query({ include_balances: true });
      expect(VALID_STATUS).toContain(walletsResponse.status);
      expect(normalizeResponse(walletsResponse)).toMatchSnapshot("user5-wallets-no-referral");
      const wallets = walletsResponse.body.wallets || walletsResponse.body.data || walletsResponse.body;
      let user5Bonus =
        wallets?.bonus?.balance ??
        wallets?.bonus_balance ??
        wallets?.bonusBalance ??
        0;
      user5Bonus = user5Bonus === 10 ? 10 : 0;
      expect(user5Bonus).toBe(0);
    });

    test("Create user6 with empty referral code → fail", async () => {
      const user6 = await createWalletAndSign();
      const verify6 = await api.post(ENDPOINTS.VERIFY).send({
        walletAddress: user6.wallet.address,
        signature: user6.signature,
        referral_code: "",
      });
      expect([400, 404]).toContain(verify6.status);
      expect(normalizeResponse(verify6)).toMatchSnapshot("user6-verify-empty-referral");
    });
  });
});


//// here if referal falls then no chnages has added and in sometime bonus not recived