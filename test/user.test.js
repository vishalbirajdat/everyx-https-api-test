const request = require("supertest");
const api = request("http://localhost:4000");

const normalizeResponse = (response) => ({
  status: response.status,
  body: {
    ...response.body,
    timestamp: "<DYNAMIC>",
    sessionId: response.body.sessionId ? "<DYNAMIC_SESSION_ID>" : undefined
  }
});

describe("Login Flow Snapshot Testing", () => {
  it("POST /login with correct username & password", async () => {
    const response = await api.post("/login").send({ username: "testuser", password: "123456" });
    expect(normalizeResponse(response)).toMatchSnapshot();
  });

  it("POST /login with wrong password", async () => {
    const response = await api.post("/login").send({ username: "testuser", password: "wrongpassword" });
    expect(normalizeResponse(response)).toMatchSnapshot();
  });

  it("POST /login with missing password", async () => {
    const response = await api.post("/login").send({ username: "testuser" });
    expect(normalizeResponse(response)).toMatchSnapshot();
  });

  it("POST /login with missing username", async () => {
    const response = await api.post("/login").send({ password: "123456" });
    expect(normalizeResponse(response)).toMatchSnapshot();
  });
});
