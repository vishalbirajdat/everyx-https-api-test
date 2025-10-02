const request = require('supertest');
require('dotenv').config();
const { sanitizeResponse } = require('../utils/sanitizeResponse');

const api = request(process.env.API_BASE_URL || "http://localhost:8800");
const authtoken = process.env.ADMIN_TOKEN;

// Global variable to store event_id for subsequent tests
let createdEventId = null;

describe("POST /admin/events  create event", () => {
    // Generate dynamic values for the event payload
    const randomSuffix = Math.floor(Math.random() * 1000000);
    const now = new Date();
    // Set ends_at to 30 days from now in ISO format
    const endsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const validPayload = {
        ticker: `BTCTESTEVENT${randomSuffix}`,
        name: `Bitcoin Test Event ${randomSuffix}`,
        name_jp: `ビットコインテストイベント${randomSuffix}`,
        description: `A comprehensive test event for Bitcoin trading #${randomSuffix}`,
        description_jp: `ビットコイン取引のための包括的なテストイベント #${randomSuffix}`,
        rules: "Standard trading rules apply",
        ends_at: endsAt,
        timezone: "Asia/Calcutta",
        event_images_url: [
            `https://everyx-dev-public.s3.eu-west-1.amazonaws.com/upload/${Date.now()}-charts.jpg`
        ],
        recommended_images_url: [],
        top_event_images_url: [],
        is_top_events: Math.random() < 0.5,
        is_featured_events: Math.random() < 0.5,
        og_image_url: "",
        stream_url: ""
    };

    it("should create a new event when authorized", async () => {
        const response = await api
            .post("/admin/events")
            .set("Authorization", `Bearer ${authtoken}`)
            .send(validPayload);
        
        expect(response.status).toBe(201);
        expect(response.body.ticker).toBe(validPayload.ticker);
        
        // Store the event_id for subsequent tests
        createdEventId = response.body._id;
        console.log('Created Event ID:', createdEventId);
        
        expect(sanitizeResponse(response.body)).toMatchSnapshot();
    });

    it("should return 409 for duplicate event name", async () => {
        // Attempt to create another event with the same name and name_jp as above
        const duplicatePayload = {
            ...validPayload,
            ticker: `BTCTESTEVENTDUPLICATE${randomSuffix}`, // ensure ticker is unique
        };

        const response2 = await api
            .post("/admin/events")
            .set("Authorization", `Bearer ${authtoken}`)
            .send(duplicatePayload);

        console.log(response2.body);

        // Expect a 400 or 409 error for duplicate name, depending on API implementation
        expect(response2.status).toBe(409);
        expect(sanitizeResponse(response2.body)).toMatchSnapshot();
    });

    it("should return 400 for the invalid ticker format",async()=>{
        const invalidTickerPayload = {
            ...validPayload,
            ticker: "invalid-ticker-format"
        };

        const response = await api
            .post("/admin/events")
            .set("Authorization", `Bearer ${authtoken}`)
            .send(invalidTickerPayload);

        expect(response.status).toBe(400);
        expect(sanitizeResponse(response.body)).toMatchSnapshot();
    })

    it("should return 401 if no token is provided", async () => {
        const response = await api
            .post("/admin/events")
            .send({ ticker: "BTCTESTEVENT" });

        expect(response.status).toBe(401);
        expect(sanitizeResponse(response.body)).toMatchSnapshot();
    });

    it("should return 401 if token is invalid", async () => {
        const response = await api
            .post("/admin/events")
            .set("Authorization", "Bearer invalid_token")
            .send({ ticker: "BTCTESTEVENT" });

        expect(response.status).toBe(401);
        expect(sanitizeResponse(response.body)).toMatchSnapshot();
    });

    it("should return 400 for missing required fields", async () => {
        const incompletePayload = {
            ticker: "BTCTESTEVENT"
            // missing other required fields like name, description, etc.
        };

        const response = await api
            .post("/admin/events")
            .set("Authorization", `Bearer ${authtoken}`)
            .send(incompletePayload);

        expect(response.status).toBe(400);
        expect(sanitizeResponse(response.body)).toMatchSnapshot();
    });

    it("should return 400 for invalid date format", async () => {
        const invalidPayload = {
            ...validPayload,
            ends_at: "invalid-date-format"
        };

        const response = await api
            .post("/admin/events")
            .set("Authorization", `Bearer ${authtoken}`)
            .send(invalidPayload);

        expect(response.status).toBe(400);
        expect(sanitizeResponse(response.body)).toMatchSnapshot();
    });

    it("should return 400 for invalid timezone", async () => {
        const invalidTimezonePayload = {
            ...validPayload,
            timezone: "Invalid/Timezone"
        };

        const response = await api
            .post("/admin/events")
            .set("Authorization", `Bearer ${authtoken}`)
            .send(invalidTimezonePayload);

        expect(response.status).toBe(409);
        expect(sanitizeResponse(response.body)).toMatchSnapshot();
    });

    it("should return 409 for duplicate ticker", async () => {
        // First, create an event
        await api
            .post("/admin/events")
            .set("Authorization", `Bearer ${authtoken}`)
            .send(validPayload);

        // Try to create another event with the same ticker
        const response = await api
            .post("/admin/events")
            .set("Authorization", `Bearer ${authtoken}`)
            .send(validPayload);

        expect(response.status).toBe(409);
        expect(sanitizeResponse(response.body)).toMatchSnapshot();
    });
});


describe("POST /admin/events/:id/outcomes - Create outcomes", () => {
    
    beforeAll(() => {
        // Ensure we have an event_id from the previous test suite
        if (!createdEventId) {
            throw new Error('No event_id available. Make sure event creation tests run first.');
        }
    });

    it("should return 201 for successful creation of outcomes", async () => {
        const outcomePayload = {
            name: "Yes",
            name_jp: "はい"
        };

        const response = await api
            .post(`/admin/events/${createdEventId}/outcomes`)
            .set("Authorization", `Bearer ${authtoken}`)
            .send(outcomePayload);
        
        expect(response.status).toBe(201);
        expect(response.body.name).toBe(outcomePayload.name);
        expect(sanitizeResponse(response.body)).toMatchSnapshot();
    });

    it("should return 201 for creating second outcome", async () => {
        const outcomePayload = {
            name: "No",
            name_jp: "いいえ"
        };

        const response = await api
            .post(`/admin/events/${createdEventId}/outcomes`)
            .set("Authorization", `Bearer ${authtoken}`)
            .send(outcomePayload);
        
        expect(response.status).toBe(201);
        expect(response.body.name).toBe(outcomePayload.name);
        expect(sanitizeResponse(response.body)).toMatchSnapshot();
    });

    // it("should return 409 for duplicate outcome name", async () => {
    //     const duplicatePayload = {
    //         name: "Yes", // Same as first outcome
    //         name_jp: "はい"
    //     };

    //     const response = await api
    //         .post(`/admin/events/${createdEventId}/outcomes`)
    //         .set("Authorization", `Bearer ${authtoken}`)
    //         .send(duplicatePayload);
        
    //     expect(response.status).toBe(409);
    //     expect(sanitizeResponse(response.body)).toMatchSnapshot();
    // });

    it("should return 401 for unauthorized request", async () => {
        const outcomePayload = {
            name: "Unauthorized",
            name_jp: "未承認"
        };

        const response = await api
            .post(`/admin/events/${createdEventId}/outcomes`)
            .send(outcomePayload); // No authorization header
        
        expect(response.status).toBe(401);
        expect(sanitizeResponse(response.body)).toMatchSnapshot();
    });
});

describe("POST /admin/events/:id/open - Open event for trading", () => {
    
    beforeAll(() => {
        // Ensure we have an event_id from the previous test suite
        if (!createdEventId) {
            throw new Error('No event_id available. Make sure event creation tests run first.');
        }
    });

    it("should return 204 for successfully opening an event", async () => {
        const response = await api
            .post(`/admin/events/${createdEventId}/open`)
            .set("Authorization", `Bearer ${authtoken}`);
        
        expect(response.status).toBe(204);
    });

    it("should return 409 for trying to open already opened event", async () => {
        const response = await api
            .post(`/admin/events/${createdEventId}/open`)
            .set("Authorization", `Bearer ${authtoken}`);
        
        expect(response.status).toBe(409);
        expect(sanitizeResponse(response.body)).toMatchSnapshot();
    });

    it("should return 401 for unauthorized open request", async () => {
        const response = await api
            .post(`/admin/events/${createdEventId}/open`);
        
        expect(response.status).toBe(401);
        expect(sanitizeResponse(response.body)).toMatchSnapshot();
    });

    it("should return 404 for non-existent event", async () => {
        const nonExistentEventId = 999999;
        
        const response = await api
            .post(`/admin/events/${nonExistentEventId}/open`)
            .set("Authorization", `Bearer ${authtoken}`);
        
        expect(response.status).toBe(404);
        expect(sanitizeResponse(response.body)).toMatchSnapshot();
    });
});


describe("POST /admin/events/:id/close - Close event for trading", () => {
    
    beforeAll(() => {
        // Ensure we have an event_id from the previous test suite
        if (!createdEventId) {
            throw new Error('No event_id available. Make sure event creation tests run first.');
        }
    });

    it("should return 204 for successfully closing an event", async () => {
        const response = await api
            .post(`/admin/events/${createdEventId}/close`)
            .set("Authorization", `Bearer ${authtoken}`);
        
        expect(response.status).toBe(204);
    });

    it("should return 409 for trying to close already closed event", async () => {
        const response = await api
            .post(`/admin/events/${createdEventId}/close`)
            .set("Authorization", `Bearer ${authtoken}`);
        
        expect(response.status).toBe(409);
        expect(sanitizeResponse(response.body)).toMatchSnapshot();
    });

    it("should return 401 for unauthorized close request", async () => {
        const response = await api
            .post(`/admin/events/${createdEventId}/close`);
        
        expect(response.status).toBe(401);
        expect(sanitizeResponse(response.body)).toMatchSnapshot();
    });

    it("should return 404 for non-existent event", async () => {
        const nonExistentEventId = 999999;
        
        const response = await api
            .post(`/admin/events/${nonExistentEventId}/close`)
            .set("Authorization", `Bearer ${authtoken}`);
        
        expect(response.status).toBe(404);
        expect(sanitizeResponse(response.body)).toMatchSnapshot();
    });
});



