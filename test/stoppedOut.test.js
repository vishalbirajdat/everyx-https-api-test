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
let stopProbabilityA = null;
let currentProbabilityA = null;
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
    'yadavdeepak5112001@gmail.com'
];

describe("Order Creation and Trading Flow", () => {

    // Setup: Create event and get basic data
    beforeAll(async () => {
        // Create a test event using bulk upload API
        const randomSuffix = Math.floor(Math.random() * 1000000);
        const now = new Date();
        const endsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

        const eventPayload = {
            EventTicker: `RESOLVETEST${randomSuffix}`,
            EventNameEN: `Resolve Test Event ${randomSuffix}`,
            EventNameJP: `解決テストイベント${randomSuffix}`,
            DescriptionEN: `Test event for resolve functionality #${randomSuffix}`,
            DescriptionJP: `解決機能のためのテストイベント #${randomSuffix}`,
            Rules: "Standard trading rules apply",
            Keywords: "test, resolve, functionality",
            VisibleFlag: true,
            TopEventsFlag: false,
            FeaturedEventsFlag: false,
            EventOpenFlag: true,
            StartsAt: now.toISOString(),
            EndsAt: endsAt,
            ClosingAt: new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000).toISOString(),
            ResolutionStartedAt: null,
            ResolutionEndedAt: null,
            TopEventImagesURL: ``,
            EventImagesURL: ``,
            RecommendedEventImagesURL: "",
            OGImageURL: "",
            BlackboxParams: {
                special_rules: "standard_trading",
                resolution_source: "test_resolution",
                dispute_resolution: "standard_rule"
            },
            Tags: ["test", "resolve"],
            Categories: ["test"],
            Collections: ["test-collection"],
            DepositSweetener: 0.0,
            PayoutTaxRate: 0.02,
            MinPledge: 10.0,
            MaxWager: 1000.0,
            MaxWagerImpact: 0.075,
            MaxLeverage: 10,
            MinCashProportionForPool: 0.22,
            RestrictLeverageonLowMPR: true,
            Outcomes: [
                {
                    EN: "Team A Wins",
                    JP: "チームA勝利",
                    DescriptionEN: "Team A emerges victorious",
                    DescriptionJP: "チームAが勝利する",
                    Order: 100,
                    InitialProbability: 35,
                    StartingWager: 350,
                    SystemWager: 75
                },
                {
                    EN: "Team B Wins",
                    JP: "チームB勝利",
                    DescriptionEN: "Team B emerges victorious",
                    DescriptionJP: "チームBが勝利する",
                    Order: 200,
                    InitialProbability: 35,
                    StartingWager: 350,
                    SystemWager: 75
                }
            ]
        };

        const response = await api
            .post("/admin/event-bulk-uploads")
            .set("Authorization", `Bearer ${authtoken}`)
            .field('ignore_warnings', 'true')
            .attach('file', Buffer.from(JSON.stringify(eventPayload)), 'event.json');
        console.log(response.body);

        if (response.status !== 201) {
            throw new Error(`Failed to create test event: ${response.status}`);
        }

        createdEventObjectId = response.body._id;
        console.log(createdEventObjectId,"createdEventObjectId");

        // Search for the created event using retry mechanism (similar to MarginCallUT.js)
        let createdEvent = null;
        let attempts = 0;
        const maxAttempts = 5;

        while (!createdEvent && attempts < maxAttempts) {
            attempts++;
            console.log(`🔍 Searching for event (attempt ${attempts}/${maxAttempts})...`);

            try {
                const eventsResponse = await api
                    .get("/admin/events?limit=50&page=1")
                    .set("Authorization", `Bearer ${authtoken}`);

                if (eventsResponse.status === 200) {
                    const events = eventsResponse.body;
                    createdEvent = events.find(event => event.ticker === eventPayload.EventTicker);

                    if (createdEvent) {
                        console.log(createdEvent,"createdEvent");
                        break;
                    } else {
                        console.log(`   Event not found in list, waiting 3 seconds...`);
                        await delay(3000);
                    }
                }
            } catch (error) {
                console.log(`   Error searching for event: ${error.response?.data?.message || error.message}`);
                await delay(3000);
            }
        }

        if (!createdEvent) {
            throw new Error(`Event not found after ${maxAttempts} attempts. Ticker: ${eventPayload.EventTicker}`);
        }

        // Get the event details to extract the code and outcome codes
        const eventDetailsResponse = await api
            .get(`/events/${createdEvent.code}`)

        if (eventDetailsResponse.status === 200) {
            createdEventCode = eventDetailsResponse.body.code;

            // Extract outcome codes from the event details
            if (eventDetailsResponse.body.outcomes && eventDetailsResponse.body.outcomes.length >= 2) {
                eventOutcomeCodes = [eventDetailsResponse.body.outcomes[0].code, eventDetailsResponse.body.outcomes[1].code];
            }
        }

        // Use the event details we already fetched
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
                leverage: eventDetails.outcomes[0].trader_info.max_leverage,
                wager: eventDetails.outcomes[0].trader_info.min_pledge * eventDetails.outcomes[0].trader_info.max_leverage,
                loan: eventDetails.outcomes[0].trader_info.min_pledge * eventDetails.outcomes[0].trader_info.max_leverage - eventDetails.outcomes[0].trader_info.min_pledge,
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
                leverage: eventDetails.outcomes[0].trader_info.max_leverage,
                wager: eventDetails.outcomes[0].trader_info.min_pledge * eventDetails.outcomes[0].trader_info.max_leverage,
                loan: eventDetails.outcomes[0].trader_info.min_pledge * eventDetails.outcomes[0].trader_info.max_leverage - eventDetails.outcomes[0].trader_info.min_pledge,
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

        it("Get the stop probability for outcome A", async () => {
            const response = await api
                .get(`/wagers/events/${createdEventCode}`)
                .set("Authorization", `Bearer ${userTokens[TEST_USERS[0]]}`);
            console.log(response.body,"stop probability");
            stopProbabilityA = response.body[0].positions[0].stop_probability;
            expect(response.status).toBe(200);
        });



        // getting the current probability for the events 
        it("Get the current probability for outcome A", async () => {
            const response = await api
                .get(`/events/${createdEventCode}`)
            currentProbabilityA = response.body.outcomes[0].trader_info.estimated_probability;
            expect(response.status).toBe(200);
        });


        // Need to keep wagering until the stop probability is reached for outcome A

        it("should generate quote for user 2 on outcome B", async () => {

            expect(currentProbabilityA).toBeDefined();
            expect(stopProbabilityA).toBeDefined();
            expect(currentProbabilityA).toBeGreaterThan(stopProbabilityA);

            console.log("Should stop wagering when the current probability is greater than the stop probability");
            while (currentProbabilityA > stopProbabilityA) {
                const userEmail = TEST_USERS[1];
                const outcomeCode = 'B';

                if (!userTokens[userEmail]) {
                    throw new Error(`No token available for user ${userEmail}`);
                }

                const quoteData = {
                    event_id: createdEventCode,
                    event_outcome_id: outcomeCode,
                    pledge: eventDetails.outcomes[1].trader_info.max_pledge,
                    leverage: 1.0,
                    wager: eventDetails.outcomes[1].trader_info.max_pledge * 1.0,
                    loan: 0.00,
                    force_leverage: false
                };

                const quoteresponse = await api
                    .post("/quotes")
                    .send(quoteData);

                indicativePayout = quoteresponse.body?.indicative_payout;
                expect(quoteresponse.status).toBe(201);
                console.log(quoteresponse.body);


                const wagerData = {
                    wallet_id: walletIds[userEmail],
                    event_id: createdEventCode,
                    event_outcome_id: outcomeCode,
                    pledge: eventDetails.outcomes[1].trader_info.max_pledge,
                    leverage: 1.0,
                    wager: eventDetails.outcomes[1].trader_info.max_pledge * 1.0,
                    loan: 0.00,
                    force_leverage: false,
                    max_payout: indicativePayout
                };
                const wagerResponse = await api
                    .post("/wagers")
                    .set("Authorization", `Bearer ${userTokens[userEmail]}`)
                    .send(wagerData);
                console.log(wagerResponse.body);
                expect(wagerResponse.status).toBe(201);

                // CRITICAL: Update currentProbabilityA after each wager
                const updatedEventResponse = await api
                    .get(`/events/${createdEventCode}`)
                    .set("Authorization", `Bearer ${authtoken}`);

                expect(updatedEventResponse.status).toBe(200);
                currentProbabilityA = updatedEventResponse.body.outcomes[0].trader_info.estimated_probability;

                console.log(`Current A: ${currentProbabilityA}, Stop A: ${stopProbabilityA}`);

                // Add delay to allow system to process
                await delay(1000);
                expect(sanitizeResponse(wagerResponse.body)).toMatchSnapshot();
            }

        });

    });

    // Pre-Resolution User Positions Tests
    describe("Pre-Resolution User Positions", () => {


        // Positions must be closed for user1
        it("should verify user positions after wagers are placed for user 1", async () => {
            const userEmail = TEST_USERS[0];
            const response = await api
                .get(`/wagers/events/${createdEventCode}`)
                .set("Authorization", `Bearer ${userTokens[userEmail]}`);
            expect(response.status).toBe(200);
            expect(response.body[0].type).toBe('closed');
            expect(sanitizeResponse(response.body)).toMatchSnapshot(`user-positions-${userEmail}`);
        });

        it("should verify user positions after wagers are placed for user 2", async () => {
            const userEmail = TEST_USERS[1];
            const response = await api
                .get(`/wagers/events/${createdEventCode}`)
                .set("Authorization", `Bearer ${userTokens[userEmail]}`);
            expect(response.status).toBe(200);
            expect(response.body[0].type).toBe('open');
            expect(sanitizeResponse(response.body)).toMatchSnapshot(`user-positions-${userEmail}`);
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
                .post(`/admin/events/${createdEventCode}/close`)
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
                event_outcome_id: 'B', // Set outcome A as the winning outcome
                ends_at: new Date(new Date().getTime() + 120 * 1000).toISOString()
            };

            const response = await api
                .post(`/admin/events/${createdEventCode}/resolve`)
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

            // Margin Call for user 1
            const user1Email = TEST_USERS[0];
            const response = await api
                .get(`/wagers/events/${createdEventCode}`)
                .set("Authorization", `Bearer ${userTokens[user1Email]}`);
            expect(response.status).toBe(200);
            expect(response.body[0].type).toBe('closed');
            expect(response.body[0].positions[0].last_reason).toBe('MARGINCALLED');
            expect(sanitizeResponse(response.body)).toMatchSnapshot(`user-positions-${user1Email}`);

            const user2Email = TEST_USERS[1];
            const response2 = await api
                .get(`/wagers/events/${createdEventCode}`)
                .set("Authorization", `Bearer ${userTokens[user2Email]}`);
            expect(response2.status).toBe(200);
            expect(response2.body[0].type).toBe('closed');
            expect(response2.body[0].positions[0].last_reason).toBe('WIN');
            expect(sanitizeResponse(response2.body)).toMatchSnapshot(`user-positions-${user2Email}`);

        });

    });
});
