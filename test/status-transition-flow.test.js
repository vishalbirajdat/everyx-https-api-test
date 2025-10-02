const request = require('supertest');
require('dotenv').config();
const { sanitizeResponse } = require('../utils/sanitizeResponse');
const api = request(process.env.API_BASE_URL || "http://localhost:8800");
const authtoken = process.env.ADMIN_TOKEN;

// Timing configuration - customize as needed
const TIMING_CONFIG = {
    RESOLVE_DELAY: parseInt(process.env.RESOLVE_DELAY) || 120 * 1000,  // 120 seconds default (reduced for faster testing)
    PAUSE_DELAY: parseInt(process.env.PAUSE_DELAY) || 1 * 1000,      // 1 second default
    OPEN_DELAY: parseInt(process.env.OPEN_DELAY) || 120 * 1000,             // 0.5 seconds default
    CLOSE_DELAY: parseInt(process.env.CLOSE_DELAY) || 120 * 1000       // 1 second default
};

// Helper function for delays
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

describe("Event Status Transition Flow", () => {
    
    let flowTestEventId = null;
    let flowOutcomeIds = [];
    
    beforeAll(async () => {
        // Create a new event for testing the complete flow
        const randomSuffix = Math.floor(Math.random() * 1000000);
        const now = new Date();
        const endsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

        const eventPayload = {
            ticker: `FLOWTEST${randomSuffix}`,
            name: `Flow Test Event ${randomSuffix}`,
            name_jp: `フローテストイベント${randomSuffix}`,
            description: `Test event for complete status flow #${randomSuffix}`,
            description_jp: `完全なステータスフローのためのテストイベント #${randomSuffix}`,
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

        // Create event
        const createResponse = await api
            .post("/admin/events")
            .set("Authorization", `Bearer ${authtoken}`)
            .send(eventPayload);
        
        flowTestEventId = createResponse.body._id;

        // Create outcomes
        const outcome1Response = await api
            .post(`/admin/events/${flowTestEventId}/outcomes`)
            .set("Authorization", `Bearer ${authtoken}`)
            .send({ name: "Yes", name_jp: "はい" });
        flowOutcomeIds.push(outcome1Response.body._id);

        const outcome2Response = await api
            .post(`/admin/events/${flowTestEventId}/outcomes`)
            .set("Authorization", `Bearer ${authtoken}`)
            .send({ name: "No", name_jp: "いいえ" });
        flowOutcomeIds.push(outcome2Response.body._id);
    });

    it("should follow complete status flow: created -> open -> pause -> open -> close -> resolve", async () => {
        // 1. Open the event (created -> open)
        console.log('Opening event...');
        let response = await api
            .post(`/admin/events/${flowTestEventId}/open`)
            .set("Authorization", `Bearer ${authtoken}`);
        expect(response.status).toBe(204);
        
        // Wait before next action
        await delay(TIMING_CONFIG.OPEN_DELAY);

        // 2. Pause the event (open -> paused)
        console.log('Pausing event...');
        response = await api
            .post(`/admin/events/${flowTestEventId}/pause`)
            .set("Authorization", `Bearer ${authtoken}`);
        expect(response.status).toBe(204);
        
        // Wait before next action
        await delay(TIMING_CONFIG.PAUSE_DELAY);

        // 3. Reopen the event (paused -> open)
        console.log('Reopening event...');
        response = await api
            .post(`/admin/events/${flowTestEventId}/open`)
            .set("Authorization", `Bearer ${authtoken}`);
        expect(response.status).toBe(204);
        
        // Wait before next action
        await delay(TIMING_CONFIG.OPEN_DELAY);

        // 4. Close the event (open -> closed)
        console.log('Closing event...');
        response = await api
            .post(`/admin/events/${flowTestEventId}/close`)
            .set("Authorization", `Bearer ${authtoken}`);
        expect(response.status).toBe(204);
        
        // Wait before resolve
        await delay(TIMING_CONFIG.CLOSE_DELAY);

        // 5. Resolve the event (closed -> resolved)
        console.log('Resolving event...');
        const resolvePayload = {
            event_outcome_id: flowOutcomeIds[0],
            ends_at: new Date(new Date().getTime() + 120 * 1000).toISOString(),
            dry_run: false
        };

        // Wait for the configured resolve delay
        await delay(TIMING_CONFIG.RESOLVE_DELAY);
        response = await api
            .post(`/admin/events/${flowTestEventId}/resolve`)
            .set("Authorization", `Bearer ${authtoken}`)
            .send(resolvePayload);
        expect(response.status).toBe(204);
        console.log('Event resolved successfully!');
    });
});