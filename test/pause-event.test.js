const request = require('supertest');
require('dotenv').config();
const { sanitizeResponse } = require('../utils/sanitizeResponse');
const api = request(process.env.API_BASE_URL || "http://localhost:8800");
const authtoken = process.env.ADMIN_TOKEN;

describe("POST /admin/events/:id/pause - Pause event for trading", () => {
    
    // We need a new event for pause tests since the previous one is closed
    let pauseTestEventId = null;
    
    beforeAll(async () => {
        // Create a new event specifically for pause testing
        const randomSuffix = Math.floor(Math.random() * 1000000);
        const now = new Date();
        const endsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

        const eventPayload = {
            ticker: `PAUSETEST${randomSuffix}`,
            name: `Pause Test Event ${randomSuffix}`,
            name_jp: `ポーズテストイベント${randomSuffix}`,
            description: `Test event for pause functionality #${randomSuffix}`,
            description_jp: `ポーズ機能のためのテストイベント #${randomSuffix}`,
            rules: "Standard trading rules apply",
            ends_at: endsAt,
            timezone: "Asia/Calcutta",
            event_images_url: [
                `https://everyx-dev-public.s3.eu-west-1.amazonaws.com/upload/${Date.now()}-charts.jpg`
            ],
            recommended_images_url: [],
            top_event_images_url: [],
            is_top_events: false,
            is_featured_events: false,
            og_image_url: "",
            stream_url: ""
        };

        // Create event
        const createResponse = await api
            .post("/admin/events")
            .set("Authorization", `Bearer ${authtoken}`)
            .send(eventPayload);
        
        pauseTestEventId = createResponse.body._id;

        // Create outcomes
        await api
            .post(`/admin/events/${pauseTestEventId}/outcomes`)
            .set("Authorization", `Bearer ${authtoken}`)
            .send({ name: "Yes", name_jp: "はい" });

        await api
            .post(`/admin/events/${pauseTestEventId}/outcomes`)
            .set("Authorization", `Bearer ${authtoken}`)
            .send({ name: "No", name_jp: "いいえ" });

        // Open the event so we can pause it
        await api
            .post(`/admin/events/${pauseTestEventId}/open`)
            .set("Authorization", `Bearer ${authtoken}`);
    });

    it("should return 204 for successfully pausing an open event", async () => {
        const response = await api
            .post(`/admin/events/${pauseTestEventId}/pause`)
            .set("Authorization", `Bearer ${authtoken}`);
        
        expect(response.status).toBe(204);
    });

    it("should return 409 for trying to pause already paused event", async () => {
        const response = await api
            .post(`/admin/events/${pauseTestEventId}/pause`)
            .set("Authorization", `Bearer ${authtoken}`);
        
        expect(response.status).toBe(409);
        expect(sanitizeResponse(response.body)).toMatchSnapshot();
    });

    it("should return 401 for unauthorized pause request", async () => {
        const response = await api
            .post(`/admin/events/${pauseTestEventId}/pause`);
        
        expect(response.status).toBe(401);
        expect(sanitizeResponse(response.body)).toMatchSnapshot();
    });

    it("should return 404 for non-existent event", async () => {
        const nonExistentEventId = 999999;
        
        const response = await api
            .post(`/admin/events/${nonExistentEventId}/pause`)
            .set("Authorization", `Bearer ${authtoken}`);
        
        expect(response.status).toBe(404);
        expect(sanitizeResponse(response.body)).toMatchSnapshot();
    });

    it("should allow reopening a paused event", async () => {
        const response = await api
            .post(`/admin/events/${pauseTestEventId}/open`)
            .set("Authorization", `Bearer ${authtoken}`);
        
        expect(response.status).toBe(204);
    });
});