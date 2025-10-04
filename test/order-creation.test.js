const request = require('supertest');
require('dotenv').config();
const { sanitizeResponse } = require('../utils/sanitizeResponse');

const api = request(process.env.API_BASE_URL || "http://localhost:8800");
const authtoken = process.env.ADMIN_TOKEN;

// Global variables to store data across tests
let createdEventObjectId = null;
let createdEventId = null;
let createdEventCode = null;
let eventDetails = {};
let eventOutcomeCodes = [];
let indicativePayout = null;
let wagerPayload = {};
let userTokens = {};
let walletIds = {};
let wagers = [];
// const oldWallet = {
//     topup: 0,
//     profit: 0,
//     bonus: 0
// }
// const newWallet = {
//     topup: 0,
//     profit: 0,
//     bonus: 0
// }
// Helper function for delays
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Test user emails - using different test users for different scenarios
const TEST_USERS = [
    'dny9136833946@gmail.com',
    '1032220499@tcetmumbai.in',
    'yadavdeepak5112001@gmail.com'
];

describe("Order Creation and Trading Flow", () => {

    // Setup: Create event and get basic data
    beforeAll(async () => {
        // Create a test event first
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

        const response = await api
            .post("/admin/events")
            .set("Authorization", `Bearer ${authtoken}`)
            .send(eventPayload);
        console.log(response.body);

        if (response.status !== 201) {
            throw new Error(`Failed to create test event: ${response.status}`);
        }

        createdEventId = response.body._id;
        createdEventCode = response.body.code;
        createdEventObjectId = response.body._id;

        // Add outcomes to the event
        const outcome1 = await api
            .post(`/admin/events/${createdEventCode}/outcomes`)
            .set("Authorization", `Bearer ${authtoken}`)
            .send({ name: "Team A Wins", name_jp: "チームA勝利" });

        const outcome2 = await api
            .post(`/admin/events/${createdEventCode}/outcomes`)
            .set("Authorization", `Bearer ${authtoken}`)
            .send({ name: "Team B Wins", name_jp: "チームB勝利" });

        if (outcome1.status === 201 && outcome2.status === 201) {
            eventOutcomeCodes = [outcome1.body.code, outcome2.body.code];
        }

        // Open the event for trading
        const openEventResponse = await api
            .post(`/admin/events/${createdEventCode}/open`)
            .set("Authorization", `Bearer ${authtoken}`);

        // Getting the event details to get the min pledge for each outcome
        const eventDetailsResponse = await api
            .get(`/events/${createdEventCode}`)

        eventDetails = eventDetailsResponse.body;


        console.log('Setup complete:', { createdEventId, createdEventCode, eventOutcomeCodes });
        console.log('Outcome codes debug:', eventOutcomeCodes);
        console.log('Outcome codes length:', eventOutcomeCodes.length);
    });

    // User Authentication Tests
    describe("User Authentication Tests", () => {
        TEST_USERS.forEach((email, index) => {
            it(`should generate token for user ${index + 1} (${email})`, async () => {
                const response = await api
                    .post("/admin/dev-scripts/generate-user-token")
                    .set("Authorization", `Bearer ${authtoken}`)
                    .send({ email });

                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('token');

                userTokens[email] = response.body.token;
                expect(sanitizeResponse(response.body)).toMatchSnapshot();
            });
        });
    });

    // Wallet Information Tests
    describe("Wallet Information Tests", () => {

        TEST_USERS.forEach((email, index) => {
            it(`should get wallet info for user ${index + 1}`, async () => {
                if (!userTokens[email]) {
                    throw new Error(`No token available for user ${email}`);
                }

                const response = await api
                    .get("/wallets")
                    .set("Authorization", `Bearer ${userTokens[email]}`);

                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('success', true);

                // Store wallet ID for testing
                // oldWallet.topup = response.body.wallets.topup.balance;
                // oldWallet.profit = response.body.wallets.profit.balance;
                // oldWallet.bonus = response.body.wallets.bonus.balance;

                if (response.body.wallets.topup) {
                    walletIds[email] = response.body.wallets.topup.id;
                } else if (response.body.wallets.profit) {
                    walletIds[email] = response.body.wallets.profit.id;
                }

                expect(sanitizeResponse(response.body)).toMatchSnapshot();
            });
        });
    });

    // Quote Generation and Wager Creation Tests
    describe("Quote Generation Tests", () => {
        // Create individual tests to avoid Jest discovery timing issues
        it("should generate quote for user 1 on outcome A", async () => {
            const userEmail = TEST_USERS[0];
            const outcomeCode = 'A'; // Fixed value to avoid timing issues

            if (!userTokens[userEmail]) {
                throw new Error(`No token available for user ${userEmail}`);
            }

            const quoteData = {
                event_id: createdEventCode,
                event_outcome_id: outcomeCode,
                pledge: eventDetails.outcomes[0].trader_info.min_pledge,
                leverage: 1.0,
                wager: eventDetails.outcomes[0].trader_info.min_pledge * 1.0,
                loan: 0.00,
                force_leverage: false
            };

            // Verify test preconditions
            expect(eventOutcomeCodes).toBeDefined();
            expect(eventOutcomeCodes.length).toBeGreaterThan(0);
            expect(createdEventCode).toBeDefined();

            const response = await api
                .post("/quotes")
                .send(quoteData);
            console.log(response.body);
            expect(response.status).toBe(201);

            // Extract indicative_payout from the response for use in the next API call
            indicativePayout = response.body?.indicative_payout;

            expect(sanitizeResponse(response.body)).toMatchSnapshot();
        });

        // creating a wager on outcome A for user 1
        it("should create a wager on outcome A for user 1", async () => {
            const userEmail = TEST_USERS[0];
            const outcomeCode = 'A';

            if (!userTokens[userEmail]) {
                throw new Error(`No token available for user ${userEmail}`);
            }

            const wagerData = {
                wallet_id: walletIds[userEmail],
                event_id: createdEventCode,
                event_outcome_id: outcomeCode,
                pledge: eventDetails.outcomes[0].trader_info.min_pledge,
                leverage: 1.0,
                wager: eventDetails.outcomes[0].trader_info.min_pledge * 1.0,
                loan: 0.00,
                force_leverage: false,
                max_payout: indicativePayout
            };
            const response = await api
                .post("/wagers")
                .set("Authorization", `Bearer ${userTokens[userEmail]}`)
                .send(wagerData);
            console.log(response.body);
            expect(response.status).toBe(201);
            expect(sanitizeResponse(response.body)).toMatchSnapshot();

        });

        it("should generate quote for user 1 on outcome B", async () => {
            const userEmail = TEST_USERS[0];
            const outcomeCode = 'B'; // Fixed value to avoid timing issues

            if (!userTokens[userEmail]) {
                throw new Error(`No token available for user ${userEmail}`);
            }

            const quoteData = {
                event_id: createdEventCode,
                event_outcome_id: outcomeCode,
                pledge: eventDetails.outcomes[1].trader_info.min_pledge,
                leverage: 1.0,
                wager: eventDetails.outcomes[1].trader_info.min_pledge * 1.0,
                loan: 0.00,
                force_leverage: false
            };

            const response = await api
                .post("/quotes")
                .send(quoteData);
            indicativePayout = response.body?.indicative_payout;
            expect(response.status).toBe(201);
            console.log(response.body);

            expect(sanitizeResponse(response.body)).toMatchSnapshot();

        });

        it("should create a wager on outcome B for user 1", async () => {
            const userEmail = TEST_USERS[0];
            const outcomeCode = 'B';

            if (!userTokens[userEmail]) {
                throw new Error(`No token available for user ${userEmail}`);
            }

            const wagerData = {
                wallet_id: walletIds[userEmail],
                event_id: createdEventCode,
                event_outcome_id: outcomeCode,
                pledge: eventDetails.outcomes[1].trader_info.min_pledge,
                leverage: 1.0,
                wager: eventDetails.outcomes[1].trader_info.min_pledge * 1.0,
                loan: 0.00,
                force_leverage: false,
                max_payout: indicativePayout
            };
            const response = await api
                .post("/wagers")
                .set("Authorization", `Bearer ${userTokens[userEmail]}`)
                .send(wagerData);
            console.log(response.body);
            expect(response.status).toBe(201);
            expect(sanitizeResponse(response.body)).toMatchSnapshot();

        });

        it("should generate quote for user 2 on outcome A", async () => {
            const userEmail = TEST_USERS[1];
            const outcomeCode = 'A';

            if (!userTokens[userEmail]) {
                throw new Error(`No token available for user ${userEmail}`);
            }

            const quoteData = {
                event_id: createdEventCode,
                event_outcome_id: outcomeCode,
                pledge: eventDetails.outcomes[0].trader_info.min_pledge,
                leverage: 1.0,
                wager: eventDetails.outcomes[0].trader_info.min_pledge * 1.0,
                loan: 0.00,
                force_leverage: false
            };

            const response = await api
                .post("/quotes")
                .send(quoteData);

            indicativePayout = response.body?.indicative_payout;
            expect(response.status).toBe(201);
            console.log(response.body);

            expect(sanitizeResponse(response.body)).toMatchSnapshot();
        });

        it("should create a wager on outcome A for user 2", async () => {
            const userEmail = TEST_USERS[1];
            const outcomeCode = 'A';

            if (!userTokens[userEmail]) {
                throw new Error(`No token available for user ${userEmail}`);
            }

            const wagerData = {
                wallet_id: walletIds[userEmail],
                event_id: createdEventCode,
                event_outcome_id: outcomeCode,
                pledge: eventDetails.outcomes[0].trader_info.min_pledge,
                leverage: 1.0,
                wager: eventDetails.outcomes[0].trader_info.min_pledge * 1.0,
                loan: 0.00,
                force_leverage: false,
                max_payout: indicativePayout
            };
            const response = await api
                .post("/wagers")
                .set("Authorization", `Bearer ${userTokens[userEmail]}`)
                .send(wagerData);
            console.log(response.body);
            expect(response.status).toBe(201);
            expect(sanitizeResponse(response.body)).toMatchSnapshot();

        });

        it("should generate quote for user 2 on outcome B", async () => {
            const userEmail = TEST_USERS[1];
            const outcomeCode = 'B';

            if (!userTokens[userEmail]) {
                throw new Error(`No token available for user ${userEmail}`);
            }

            const quoteData = {
                event_id: createdEventCode,
                event_outcome_id: outcomeCode,
                pledge: eventDetails.outcomes[1].trader_info.min_pledge,
                leverage: 1.0,
                wager: eventDetails.outcomes[1].trader_info.min_pledge * 1.0,
                loan: 0.00,
                force_leverage: false
            };

            const response = await api
                .post("/quotes")
                .send(quoteData);

            indicativePayout = response.body?.indicative_payout;
            expect(response.status).toBe(201);
            console.log(response.body);
            expect(sanitizeResponse(response.body)).toMatchSnapshot();
        });

        it("should create a wager on outcome B for user 2", async () => {
            const userEmail = TEST_USERS[1];
            const outcomeCode = 'B';

            if (!userTokens[userEmail]) {
                throw new Error(`No token available for user ${userEmail}`);
            }
            const wagerData = {
                wallet_id: walletIds[userEmail],
                event_id: createdEventCode,
                event_outcome_id: outcomeCode,
                pledge: eventDetails.outcomes[1].trader_info.min_pledge,
                leverage: 1.0,
                wager: eventDetails.outcomes[1].trader_info.min_pledge * 1.0,
                loan: 0.00,
                force_leverage: false,
                max_payout: indicativePayout
            };
            const response = await api
                .post("/wagers")
                .set("Authorization", `Bearer ${userTokens[userEmail]}`)
                .send(wagerData);
            console.log(response.body);
            expect(response.status).toBe(201);
            expect(sanitizeResponse(response.body)).toMatchSnapshot();

        });

        it("should generate quote for user 3 on outcome A", async () => {
            const userEmail = TEST_USERS[2];
            const outcomeCode = 'A';

            if (!userTokens[userEmail]) {
                throw new Error(`No token available for user ${userEmail}`);
            }

            const quoteData = {
                event_id: createdEventCode,
                event_outcome_id: outcomeCode,
                pledge: eventDetails.outcomes[0].trader_info.min_pledge,
                leverage: 1.0,
                wager: eventDetails.outcomes[0].trader_info.min_pledge * 1.0,
                loan: 0.00,
                force_leverage: false
            };

            const response = await api
                .post("/quotes")
                .send(quoteData);

            indicativePayout = response.body?.indicative_payout;
            expect(response.status).toBe(201);
            console.log(response.body);
            expect(sanitizeResponse(response.body)).toMatchSnapshot();
        });

        it("should create a wager on outcome A for user 3", async () => {
            const userEmail = TEST_USERS[2];
            const outcomeCode = 'A';

            if (!userTokens[userEmail]) {
                throw new Error(`No token available for user ${userEmail}`);
            }
            const wagerData = {
                wallet_id: walletIds[userEmail],
                event_id: createdEventCode,
                event_outcome_id: outcomeCode,
                pledge: eventDetails.outcomes[0].trader_info.min_pledge,
                leverage: 1.0,
                wager: eventDetails.outcomes[0].trader_info.min_pledge * 1.0,
                loan: 0.00,
                force_leverage: false,
                max_payout: indicativePayout
            };
            const response = await api
                .post("/wagers")
                .set("Authorization", `Bearer ${userTokens[userEmail]}`)
                .send(wagerData);
            console.log(response.body);
            expect(response.status).toBe(201);
            expect(sanitizeResponse(response.body)).toMatchSnapshot();

        });

        it("should generate quote for user 3 on outcome B", async () => {
            const userEmail = TEST_USERS[2];
            const outcomeCode = 'B';

            if (!userTokens[userEmail]) {
                throw new Error(`No token available for user ${userEmail}`);
            }

            const quoteData = {
                event_id: createdEventCode,
                event_outcome_id: outcomeCode,
                pledge: eventDetails.outcomes[1].trader_info.min_pledge,
                leverage: 1.0,
                wager: eventDetails.outcomes[1].trader_info.min_pledge * 1.0,
                loan: 0.00,
                force_leverage: false,
                max_payout: indicativePayout
            };

            const response = await api
                .post("/quotes")
                .send(quoteData);

            indicativePayout = response.body?.indicative_payout;
            expect(response.status).toBe(201);
            console.log(response.body);
            expect(sanitizeResponse(response.body)).toMatchSnapshot();
        });

        it("should create a wager on outcome B for user 3", async () => {
            const userEmail = TEST_USERS[2];
            const outcomeCode = 'B';

            if (!userTokens[userEmail]) {
                throw new Error(`No token available for user ${userEmail}`);
            }
            const wagerData = {
                wallet_id: walletIds[userEmail],
                event_id: createdEventCode,
                event_outcome_id: outcomeCode,
                pledge: eventDetails.outcomes[1].trader_info.min_pledge,
                leverage: 1.0,
                wager: eventDetails.outcomes[1].trader_info.min_pledge * 1.0,
                loan: 0.00,
                force_leverage: false,
                max_payout: indicativePayout
            };
            const response = await api
                .post("/wagers")
                .set("Authorization", `Bearer ${userTokens[userEmail]}`)
                .send(wagerData);
            console.log(response.body);
            expect(response.status).toBe(201);
            expect(sanitizeResponse(response.body)).toMatchSnapshot();

        });
    });

    // Pre-Resolution User Positions Tests
    describe("Pre-Resolution User Positions", () => {
        it("should verify user positions after wagers are placed", async () => {
            console.log("Checking user positions after wagers...");

            for (const userEmail of TEST_USERS) {
                if (!userTokens[userEmail]) {
                    console.log(`Skipping ${userEmail} - no token available`);
                    continue;
                }

                const response = await api
                    .get(`/wagers/events/${createdEventCode}`)
                    .set("Authorization", `Bearer ${userTokens[userEmail]}`);
                expect(response.status).toBe(200);
                expect(response.body[0].type).toBe('open');
                expect(sanitizeResponse(response.body)).toMatchSnapshot(`user-positions-${userEmail}`);
            }
        });

        it("should verify event is still open for trading", async () => {
            const response = await api
                .get(`/events/${createdEventCode}`)
                .set("Authorization", `Bearer ${authtoken}`);

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('open');
            expect(response.body).toHaveProperty('outcomes');
            expect(response.body.outcomes).toHaveLength(2);

            console.log("Event status (should be open):", response.body.status);

            expect(sanitizeResponse(response.body)).toMatchSnapshot();
        });
    });

    // Adding the time delay before closing the event
    beforeAll(async () => {
        await delay(12000);
    });

    describe("Event Closure Tests", () => {
        it("should close the event for resolution", async () => {
            console.log("Closing event for resolution...");

            const response = await api
                .post(`/admin/events/${createdEventObjectId}/close`)
                .set("Authorization", `Bearer ${authtoken}`);

            expect(response.status).toBe(204);
            console.log("Event closed successfully");

            // Verify event status changed to closed
            const statusResponse = await api
                .get(`/events/${createdEventCode}`)
                .set("Authorization", `Bearer ${authtoken}`);

            expect(statusResponse.status).toBe(200);

            expect(sanitizeResponse(response.body)).toMatchSnapshot();
        });

        it("should verify event is closed and no longer accepting trades", async () => {
            const response = await api
                .get(`/events/${createdEventCode}`)
                .set("Authorization", `Bearer ${authtoken}`);

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('closed');

            console.log("Event status (should be closed):", response.body.status);
            console.log("Event closed at:", response.body.closed_at);

            expect(sanitizeResponse(response.body)).toMatchSnapshot();
        });
    });

    describe("Event Resolution Tests", () => {
        it("should resolve the event with outcome A as winner", async () => {
            console.log("Resolving event with outcome A as winner...");

            const resolutionData = {
                event_outcome_id: 'A', // Set outcome A as the winning outcome
                ends_at: new Date(new Date().getTime() + 120 * 1000).toISOString()
            };

            const response = await api
                .post(`/admin/events/${createdEventObjectId}/resolve`)
                .set("Authorization", `Bearer ${authtoken}`)
                .send(resolutionData);

            expect(response.status).toBe(204);

            console.log("Event resolved successfully");

            expect(sanitizeResponse(response.body)).toMatchSnapshot();
        });

        it("should verify event status changed to resolved", async () => {
            const response = await api
                .get(`/events/${createdEventCode}`)
                .set("Authorization", `Bearer ${authtoken}`);

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('resolved');

            console.log("Event status (should be resolved):", response.body.status);

            expect(sanitizeResponse(response.body)).toMatchSnapshot();
        });
    });

    describe("Post-Resolution User Positions", () => {
        it("should verify final user positions after resolution", async () => {
            console.log("Checking final user positions after resolution...");

            for (let i = 0; i < TEST_USERS.length; i++) {
                const userEmail = TEST_USERS[i];

                if (!userTokens[userEmail]) {
                    console.log(`Skipping ${userEmail} - no token available`);
                    continue;
                }

                // Check positions
                const positionsResponse = await api
                    .get(`/wagers/events/${createdEventCode}`)
                    .set("Authorization", `Bearer ${userTokens[userEmail]}`);

                expect(positionsResponse.status).toBe(200);
                expect(positionsResponse.body[0].type).toBe('closed');

                // Verify positions are resolved
                if (positionsResponse.body[0].positions[0].event_outcome_id === 'A') {
                    console.log("posistion1", positionsResponse.body[0].positions[0].last_reason);
                    expect(positionsResponse.body[0].positions[0].last_reason).toBe('WIN');
                }
                else if (positionsResponse.body[0].positions[1].event_outcome_id === 'B') {
                    expect(positionsResponse.body[0].positions[1].last_reason).toBe('LOSS');
                }

                expect(sanitizeResponse(positionsResponse.body)).toMatchSnapshot(`final-user-positions-${userEmail}`);
            }
        });

    });

    // describe("Checking the event wallet balance", () => {
    //     it("should verify the wallet balance after resolution", async () => {
    //         const response = await api
    //             .get(`/wallets}`)
    //             .set("Authorization", `Bearer ${authtoken}`);

          
    //         newWallet.topup = response.body.wallets.topup.balance;
    //         newWallet.profit = response.body.wallets.profit.balance;
    //         newWallet.bonus = response.body.wallets.bonus.balance;
    //         expect(response.status).toBe(200);
            
    //         // expect(newWallet.topup).toBe(oldWallet.topup);
    //         // expect(newWallet.profit).toBe(oldWallet.profit);
    //         // expect(newWallet.bonus).toBe(oldWallet.bonus);
    //     });

    // })


});
