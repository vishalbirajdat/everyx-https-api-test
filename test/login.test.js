const request = require("supertest");

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8800";
const api = request(API_BASE_URL);

const ENDPOINT = "/auth/v2/login";
// Fixed testEmail declaration and assignment
const testEmail = "vishalbirajdar7030@gmail.com";

const normalizeResponse = (response) => {
  const stableBody = { ...response.body };
  if (stableBody.timestamp) stableBody.timestamp = "<DYNAMIC_TIMESTAMP>";
  if (stableBody.sessionId) stableBody.sessionId = "<DYNAMIC_SESSION_ID>";
  if (stableBody.message && typeof stableBody.message === "string") {
    // Optionally mask dynamic parts of the message
    stableBody.message = stableBody.message.replace(/to (.*)/, "to <DYNAMIC_EMAIL>");
  }
  return { status: response.status, body: stableBody };
};

describe("Auth V2 Login Email Link", () => {
  it("should send login link to valid email", async () => {
    const res = await api.get(`${ENDPOINT}/${encodeURIComponent(testEmail)}`);
    expect(normalizeResponse(res)).toMatchSnapshot("login-link-valid-email");
  });

  it("should fail for invalid email format", async () => {
    const invalidEmail = "notanemail";
    const res = await api.get(`${ENDPOINT}/${encodeURIComponent(invalidEmail)}`);
    expect(normalizeResponse(res)).toMatchSnapshot("login-link-invalid-email");
  });

  it("should fail for missing email param", async () => {
    const res = await api.get(`${ENDPOINT}/`);
    expect(normalizeResponse(res)).toMatchSnapshot("login-link-missing-email");
  });
});



// Taking time to send the testEmail
// linlk