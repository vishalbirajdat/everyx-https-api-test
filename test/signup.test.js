const request = require("supertest"); console.log('Loaded supertest');
require("dotenv").config(); console.log('Loaded dotenv config');

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8800"; console.log('API_BASE_URL:', API_BASE_URL);
const api = request(API_BASE_URL); console.log('Initialized api with base url');

const ENDPOINT = "/register"; console.log('ENDPOINT:', ENDPOINT);
const VALID_STATUS = [200, 201]; console.log('VALID_STATUS:', VALID_STATUS);

const normalizeResponse = (response) => {
  console.log('Normalizing response:', response);
  const stableBody = { ...response.body }; console.log('Cloned response body:', stableBody);
  if (stableBody.timestamp) { stableBody.timestamp = "<DYNAMIC_TIMESTAMP>"; console.log('Masked timestamp'); }
  if (stableBody.sessionId) { stableBody.sessionId = "<DYNAMIC_SESSION_ID>"; console.log('Masked sessionId'); }
  if (stableBody.token) { stableBody.token = "<DYNAMIC_TOKEN>"; console.log('Masked token'); }
  if (stableBody.user) {
    console.log('Found user in response body');
    if (stableBody.user.id) { stableBody.user.id = "<DYNAMIC_USER_ID>"; console.log('Masked user.id'); }
    if (stableBody.user.email) { stableBody.user.email = "<DYNAMIC_EMAIL>"; console.log('Masked user.email'); }
  }
  if (stableBody.id) { stableBody.id = "<DYNAMIC_USER_ID>"; console.log('Masked id'); }
  if (stableBody.email) { stableBody.email = "<DYNAMIC_EMAIL>"; console.log('Masked email'); }
  const result = { status: response.status, body: stableBody }; console.log('Normalized response:', result);
  return result;
};

// A valid password according to the required pattern:
// /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
const VALID_PASSWORD = "Password1!"; console.log('VALID_PASSWORD set');

describe("/register endpoint", () => {
  console.log('Describing /register endpoint');
  const baseUser = {
    email: `jestuser_${Date.now()}@example.com`, 
    first_name: "John",
    last_name: "Doe",
    country: "US",
    password: VALID_PASSWORD
  }; console.log('baseUser:', baseUser);

  test("register with null referral_code", async () => {
    console.log('Test: register with null referral_code');
    const payload = {
      ...baseUser,
      email: `user4_${Date.now()}@example.com`,
      referral_code: null,
      password: VALID_PASSWORD
    }; console.log('Payload for null referral_code:', payload);
    const response = await api.post(ENDPOINT).send(payload); console.log('API response:', response.status, response.body);
    expect(VALID_STATUS).toContain(response.status); console.log('Checked status for null referral_code');
    const normalized = normalizeResponse(response); console.log('Normalized response for null referral_code:', normalized);
    expect(normalized).toMatchSnapshot("register-null-referral-code"); console.log('Snapshot tested for null referral_code');
  });

  test("register with invalid email", async () => {
    console.log('Test: register with invalid email');
    const payload = {
      ...baseUser,
      email: "not-an-email",
      password: VALID_PASSWORD
    }; console.log('Payload for invalid email:', payload);
    const response = await api.post(ENDPOINT).send(payload); console.log('API response:', response.status, response.body);
    expect(response.status).toBe(400); console.log('Checked status for invalid email');
    expect(normalizeResponse(response)).toMatchSnapshot("register-invalid-email"); console.log('Snapshot tested for invalid email');
  });

  test("register with duplicate email", async () => {
    console.log('Test: register with duplicate email');
    const email = `user6_${Date.now()}@example.com`; console.log('Duplicate email:', email);
    const payload = {
      ...baseUser,
      email,
      password: VALID_PASSWORD
    }; console.log('Payload for duplicate email:', payload);
    // First registration
    await api.post(ENDPOINT).send(payload); console.log('First registration sent');
    // Second registration with same email
    const response = await api.post(ENDPOINT).send(payload); console.log('Second registration response:', response.status, response.body);
    expect([400, 429]).toContain(response.status); console.log('Checked status for duplicate email');
    expect(normalizeResponse(response)).toMatchSnapshot("register-duplicate-email"); console.log('Snapshot tested for duplicate email');
  });

});
