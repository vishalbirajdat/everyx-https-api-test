const request = require('supertest');
require('dotenv').config();
const { sanitizeResponse } = require('../utils/sanitizeResponse');
const api = request(process.env.API_BASE_URL || "http://localhost:8800");
const authtoken = process.env.ADMIN_TOKEN;



describe("POST /admin/events/:id/resolve - Resolve event", () => {
    
    let resolveTestEventId = null;
    let outcomeIds = [];
    
    beforeAll(async () => {
        // Create a new event specifically for resolve testing
        const randomSuffix = Math.floor(Math.random() * 1000000);
        const now = new Date();
        const endsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

        const eventPayload = {
            ticker: `RESOLVETEST${randomSuffix}`,
            name: `Resolve Test Event ${randomSuffix}`,
            name_jp: `解決テストイベント${randomSuffix}`,
            description: `Test event for resolve functionality #${randomSuffix}`,
            description_jp: `解決機能のためのテストイベント #${randomSuffix}`,
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
        
        resolveTestEventId = createResponse.body._id;

        // Create outcomes and store their IDs
        const outcome1Response = await api
            .post(`/admin/events/${resolveTestEventId}/outcomes`)
            .set("Authorization", `Bearer ${authtoken}`)
            .send({ name: "Yes", name_jp: "はい" });
        outcomeIds.push(outcome1Response.body._id);

        const outcome2Response = await api
            .post(`/admin/events/${resolveTestEventId}/outcomes`)
            .set("Authorization", `Bearer ${authtoken}`)
            .send({ name: "No", name_jp: "いいえ" });
        outcomeIds.push(outcome2Response.body._id);

        // Open and then close the event so we can resolve it
        await api
            .post(`/admin/events/${resolveTestEventId}/open`)
            .set("Authorization", `Bearer ${authtoken}`);

        await api
            .post(`/admin/events/${resolveTestEventId}/close`)
            .set("Authorization", `Bearer ${authtoken}`);
    });

    it("should return 200 for successful dry run validation", async () => {
        const resolvePayload = {
            event_outcome_id: outcomeIds[0],
            ends_at: new Date().toISOString(),
            dry_run: true
        };

        const response = await api
            .post(`/admin/events/${resolveTestEventId}/resolve`)
            .set("Authorization", `Bearer ${authtoken}`)
            .send(resolvePayload);
        
        expect(response.status).toBe(200);
        expect(response.body).toBe(true); // Should return true for valid dry run
    });

    it("should return 204 for successfully resolving an event", async () => {
        const resolvePayload = {
            event_outcome_id: outcomeIds[0],
            ends_at: new Date().toISOString(),
            dry_run: false
        };

        const response = await api
            .post(`/admin/events/${resolveTestEventId}/resolve`)
            .set("Authorization", `Bearer ${authtoken}`)
            .send(resolvePayload);
        
        expect(response.status).toBe(204);
    });

    it("should return 409 for trying to resolve already resolved event", async () => {
        const resolvePayload = {
            event_outcome_id: outcomeIds[1],
            ends_at: new Date().toISOString(),
            dry_run: false
        };

        const response = await api
            .post(`/admin/events/${resolveTestEventId}/resolve`)
            .set("Authorization", `Bearer ${authtoken}`)
            .send(resolvePayload);
        
        expect(response.status).toBe(409);
        expect(sanitizeResponse(response.body)).toMatchSnapshot();
    });

    it("should return 400 for missing required fields", async () => {
        const incompletePayload = {
            event_outcome_id: outcomeIds[0]
            // missing ends_at
        };

        // Create another event for this test since previous one is resolved
        const randomSuffix = Math.floor(Math.random() * 1000000);
        const now = new Date();
        const endsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

        const eventPayload = {
            ticker: `RESOLVETEST2${randomSuffix}`,
            name: `Resolve Test Event 2 ${randomSuffix}`,
            name_jp: `解決テストイベント2${randomSuffix}`,
            description: `Test event for resolve validation #${randomSuffix}`,
            description_jp: `解決検証のためのテストイベント #${randomSuffix}`,
            rules: "Standard trading rules apply",
            ends_at: endsAt,
            timezone: "Asia/Calcutta",
            event_images_url: [],
            recommended_images_url: [],
            top_event_images_url: [],
            is_top_events: false,
            is_featured_events: false,
            og_image_url: "",
            stream_url: ""
        };

        const createResponse = await api
            .post("/admin/events")
            .set("Authorization", `Bearer ${authtoken}`)
            .send(eventPayload);
        
        const testEventId = createResponse.body._id;

        const response = await api
            .post(`/admin/events/${testEventId}/resolve`)
            .set("Authorization", `Bearer ${authtoken}`)
            .send(incompletePayload);
        
        expect(response.status).toBe(400);
        expect(sanitizeResponse(response.body)).toMatchSnapshot();
    });

    it("should return 401 for unauthorized resolve request", async () => {
        const resolvePayload = {
            event_outcome_id: outcomeIds[0],
            ends_at: new Date().toISOString(),
            dry_run: false
        };

        const response = await api
            .post(`/admin/events/${resolveTestEventId}/resolve`)
            .send(resolvePayload); // No authorization header
        
        expect(response.status).toBe(401);
        expect(sanitizeResponse(response.body)).toMatchSnapshot();
    });

    it("should return 404 for non-existent event", async () => {
        const nonExistentEventId = 999999;
        const resolvePayload = {
            event_outcome_id: outcomeIds[0],
            ends_at: new Date().toISOString(),
            dry_run: false
        };
        
        const response = await api
            .post(`/admin/events/${nonExistentEventId}/resolve`)
            .set("Authorization", `Bearer ${authtoken}`)
            .send(resolvePayload);
        
        expect(response.status).toBe(404);
        expect(sanitizeResponse(response.body)).toMatchSnapshot();
    });
});
