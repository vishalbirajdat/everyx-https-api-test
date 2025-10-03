const request = require('supertest');
require('dotenv').config();
const api = request(process.env.API_BASE_URL || "http://localhost:8800");
let userAuthToken = process.env.USER_AUTH_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiNjhiOWI3ZTExZDZlNTkwYzc0OGEwMTc3IiwiZW1haWwiOiJza3VtYXIudmsxMkBnbWFpbC5jb20iLCJpYXQiOjE3NTg3MDU5NDN9.gd-dtII6w1bGZ0R3ghl9Ui9-2U6vKeF_ApHQT7_g9fY';
let eventId = 'DEV-000001';


function sanitize(obj) {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map(sanitize);
    if (typeof obj === "object") {
        const out = {};
        Object.keys(obj).sort().forEach((key) => {
            let v = obj[key];
            if (key.match(/timestamp|createdAt|created_at|updatedAt|updated_at/)) out[key] = "<TS>";
            else if (typeof v === "number" && !Number.isInteger(v)) {
                // round floating numbers so they don't change every run
                out[key] = Number(v.toFixed(3));
            } else {
                out[key] = sanitize(v);
            }
        });
        return out;
    }
    return obj;
}

describe('Get All Positions', () => {


    test('Should give unauthorized error if no auth token is provided', async () => {
        const response = await api.get(`/dashboard/wager-position-events?pagination=false&status=active`)
        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Unauthorized');
        expect(sanitize(response.body)).toMatchSnapshot();
    })

    test('Should return all active positions of the user', async () => {
        const response = await api.get(`/dashboard/wager-position-events?pagination=false&status=active`)
            .set('Authorization', `Bearer ${userAuthToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toBeDefined();
        expect(sanitize(response.body)).toMatchSnapshot();
    })

    test('should give all inactive positions of the user', async () => {
        const response = await api.get(`/dashboard/wager-position-events?pagination=false&status=inactive`)
            .set('Authorization', `Bearer ${userAuthToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toBeDefined();
        expect(sanitize(response.body)).toMatchSnapshot();
    })
})



describe('Get Positions of a specific event', () => {

    test('Should give unauthorized error if no auth token is provided', async () => {

        const response = await api.get(`/wagers/events/${eventId}`)
        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Unauthorized');
        expect(sanitize(response.body)).toMatchSnapshot();
    })


    test('Should return all positions of the event', async () => {
        const response = await api.get(`/wagers/events/${eventId}`)
            .set('Authorization', `Bearer ${userAuthToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toBeDefined();
        expect(sanitize(response.body)).toMatchSnapshot();
    })
})



describe('Positions Verification', () => {
    let eventData;
    let outcome;
    let walletData;
    let quote;

    test('Get Data of Event and Wallet', async () => {
        // Get event data
        const eventResponse = await api.get(`/events/${eventId}`);
        expect(eventResponse.status).toBe(200);
        eventData = eventResponse.body;
        outcome = eventData.outcomes[0];
        expect(outcome).toBeDefined();

        // Get wallet data
        const walletResponse = await api.get('/wallets').set('Authorization', `Bearer ${userAuthToken}`);
        expect(walletResponse.status).toBe(200);
        walletData = walletResponse.body;
        expect(walletData).toBeDefined();
        expect(Object.keys(walletData).length).toBeGreaterThan(0);
    })

    test('Should create a position for the event outcome after wager creation', async () => {
        // Get initial positions to verify they exist (might be empty for first-time wager)
        const initialPositionsResponse = await api.get(`/wagers/events/${eventId}`)
            .set('Authorization', `Bearer ${userAuthToken}`);
        expect(initialPositionsResponse.status).toBe(200);
        const initialPositions = initialPositionsResponse.body[0].positions;

        // Handle case where user has no existing wagers (first-time wager)
        const initialWagerCount = Array.isArray(initialPositions) ? initialPositions.length : 0;
        let existingWager = null;

        if (initialWagerCount > 0) {
            existingWager = initialPositions.find(p => p.event_outcome_id === outcome._id && p.is_leveraged === false);
        }

        // Create a new wager to generate a position
        let pledge = outcome.trader_info.min_pledge;
        let leverage = 1;
        let wager = pledge * leverage;
        let loan = wager - pledge;

        // Get quote first
        const quotePayload = {
            event_id: eventId,
            event_outcome_id: outcome._id,
            pledge: pledge,
            leverage: leverage,
            wager: wager,
            loan: loan,
            force_leverage: false,
        }

        const quoteResponse = await api.post('/quotes')
            .send(quotePayload)
            .set('Authorization', `Bearer ${userAuthToken}`);
        expect(quoteResponse.status).toBe(201);
        quote = quoteResponse.body;

        // Create wager
        const wagerPayload = {
            event_id: eventId,
            wallet_id: walletData.wallets.topup.id,
            event_outcome_id: outcome._id,
            pledge: pledge,
            leverage: leverage,
            wager: wager,
            loan: loan,
            force_leverage: false,
            max_payout: quote.indicative_payout,
        }

        const wagerResponse = await api.post('/wagers')
            .send(wagerPayload)
            .set('Authorization', `Bearer ${userAuthToken}`);
        expect(wagerResponse.status).toBe(201);

        // Verify position was created by checking positions for the event
        const finalPositionsResponse = await api.get(`/wagers/events/${eventId}`)
            .set('Authorization', `Bearer ${userAuthToken}`);
        expect(finalPositionsResponse.status).toBe(200);
        const finalPositions = finalPositionsResponse.body[0].positions;

        // Verify positions array is not empty and contains the new position
        expect(finalPositions).toBeDefined();
        expect(Array.isArray(finalPositions)).toBe(true);
        expect(finalPositions.length).toBeGreaterThan(0);

        const createdWager = finalPositions.find(p => p.event_outcome_id === outcome._id && p.is_leveraged === false);

        expect(createdWager).toBeDefined();

        // Verify wager structure
        expect(createdWager.type).toBe('open');
        expect(createdWager.event_id).toBe(eventId);
        expect(createdWager.user_id).toBeDefined();
        if (initialWagerCount > 0) {
            expect(existingWager.pledge + pledge).toBeCloseTo(createdWager.pledge, 2);
            expect(existingWager.wager + wager).toBeCloseTo(createdWager.wager, 2);
        } else {
            expect(createdWager.pledge).toBeCloseTo(pledge, 2);
            expect(createdWager.wager).toBeCloseTo(wager, 2);
        }
        expect(createdWager.is_leveraged).toBe(false);
        expect(createdWager.leverage).toBe(1);

        expect(sanitize(finalPositions)).toMatchSnapshot();
    })

    test('Should create a leveraged position for the event outcome after wager creation', async () => {
        // Get initial positions to verify they exist
        const initialPositionsResponse = await api.get(`/wagers/events/${eventId}`)
            .set('Authorization', `Bearer ${userAuthToken}`);
        expect(initialPositionsResponse.status).toBe(200);
        const initialPositions = initialPositionsResponse.body[0].positions;

        // Handle case where user has no existing wagers (first-time wager)
        const initialWagerCount = Array.isArray(initialPositions) ? initialPositions.length : 0;
        console.log(initialWagerCount);
        let existingWager = null;

        if (initialWagerCount > 0) {
            existingWager = initialPositions.find(p => p.event_outcome_id === outcome._id && p.is_leveraged === true);
        }

        // Create a new wager to generate a position
        let pledge = outcome.trader_info.min_pledge;
        let leverage = outcome.trader_info.max_leverage;
        let wager = pledge * leverage;
        let loan = wager - pledge;

        // Get quote first
        const quotePayload = {
            event_id: eventId,
            event_outcome_id: outcome._id,
            pledge: pledge,
            leverage: leverage,
            wager: wager,
            loan: loan,
            force_leverage: false,
        }

        const quoteResponse = await api.post('/quotes')
            .send(quotePayload)
            .set('Authorization', `Bearer ${userAuthToken}`);
        expect(quoteResponse.status).toBe(201);
        quote = quoteResponse.body;

        // Create wager
        const wagerPayload = {
            event_id: eventId,
            wallet_id: walletData.wallets.topup.id,
            event_outcome_id: outcome._id,
            pledge: pledge,
            leverage: leverage,
            wager: wager,
            loan: loan,
            force_leverage: false,
            max_payout: quote.indicative_payout,
        }

        const wagerResponse = await api.post('/wagers')
            .send(wagerPayload)
            .set('Authorization', `Bearer ${userAuthToken}`);
        expect(wagerResponse.status).toBe(201);

        // Verify position was created by checking positions for the event
        const finalPositionsResponse = await api.get(`/wagers/events/${eventId}`)
            .set('Authorization', `Bearer ${userAuthToken}`);
        expect(finalPositionsResponse.status).toBe(200);
        const finalPositions = finalPositionsResponse.body[0].positions;

        // Verify positions array is not empty and contains the new position
        expect(finalPositions).toBeDefined();
        expect(Array.isArray(finalPositions)).toBe(true);
        expect(finalPositions.length).toBeGreaterThan(0);

        const createdWager = finalPositions.find(p => p.event_outcome_id === outcome._id && p.is_leveraged === true);

        expect(createdWager).toBeDefined();

        // Verify wager structure
        expect(createdWager.type).toBe('open');
        expect(createdWager.event_id).toBe(eventId);
        expect(createdWager.user_id).toBeDefined();
        if (initialWagerCount > 0) {
            expect(existingWager.pledge + pledge).toBeCloseTo(createdWager.pledge, 2);
            expect(existingWager.wager + wager).toBeCloseTo(createdWager.wager, 2);
        } else {
            expect(createdWager.pledge).toBeCloseTo(pledge, 2);
            expect(createdWager.wager).toBeCloseTo(wager, 2);
        }
        expect(createdWager.is_leveraged).toBe(true);
        expect(sanitize(finalPositions)).toMatchSnapshot();
    })

    test('Should create a position with force_leverage enabled after wager creation', async () => {
        // Get initial positions to verify they exist
        const initialPositionsResponse = await api.get(`/wagers/events/${eventId}`)
            .set('Authorization', `Bearer ${userAuthToken}`);
        expect(initialPositionsResponse.status).toBe(200);
        const initialPositions = initialPositionsResponse.body[0].positions;

        // Handle case where user has no existing wagers (first-time wager)
        const initialWagerCount = Array.isArray(initialPositions) ? initialPositions.length : 0;
        let existingWager = null;

        if (initialWagerCount > 0) {
            existingWager = initialPositions.find(p => p.event_outcome_id === outcome._id && p.is_leveraged === true);
        }

        // Create a new wager to generate a position
        let pledge = outcome.trader_info.min_pledge;
        let leverage = 1;
        let wager = pledge * leverage;
        let loan = wager - pledge;

        // Get quote first
        const quotePayload = {
            event_id: eventId,
            event_outcome_id: outcome._id,
            pledge: pledge,
            leverage: leverage,
            wager: wager,
            loan: loan,
            force_leverage: true,
        }

        const quoteResponse = await api.post('/quotes')
            .send(quotePayload)
            .set('Authorization', `Bearer ${userAuthToken}`);
        expect(quoteResponse.status).toBe(201);
        quote = quoteResponse.body;

        // Create wager
        const wagerPayload = {
            event_id: eventId,
            wallet_id: walletData.wallets.topup.id,
            event_outcome_id: outcome._id,
            pledge: pledge,
            leverage: leverage,
            wager: wager,
            loan: loan,
            force_leverage: true,
            max_payout: quote.indicative_payout,
        }

        const wagerResponse = await api.post('/wagers')
            .send(wagerPayload)
            .set('Authorization', `Bearer ${userAuthToken}`);
        expect(wagerResponse.status).toBe(201);

        // Verify position was created by checking positions for the event
        const finalPositionsResponse = await api.get(`/wagers/events/${eventId}`)
            .set('Authorization', `Bearer ${userAuthToken}`);
        expect(finalPositionsResponse.status).toBe(200);
        const finalPositions = finalPositionsResponse.body[0].positions;

        // Verify positions array is not empty and contains the new position
        expect(finalPositions).toBeDefined();
        expect(Array.isArray(finalPositions)).toBe(true);
        expect(finalPositions.length).toBeGreaterThan(0);

        const createdWager = finalPositions.find(p => p.event_outcome_id === outcome._id && p.is_leveraged === true);

        expect(createdWager).toBeDefined();

        // Verify wager structure
        expect(createdWager.type).toBe('open');
        expect(createdWager.event_id).toBe(eventId);
        expect(createdWager.user_id).toBeDefined();
        if (initialWagerCount > 0) {
            expect(existingWager.pledge + pledge).toBeCloseTo(createdWager.pledge, 2);
            expect(existingWager.wager + wager).toBeCloseTo(createdWager.wager, 2);
        } else {
            expect(createdWager.pledge).toBeCloseTo(pledge, 2);
            expect(createdWager.wager).toBeCloseTo(wager, 2);
        }
        expect(createdWager.is_leveraged).toBe(true);

        expect(sanitize(finalPositions)).toMatchSnapshot();
    })

    test('Should return empty positions array when no wagers exist for event', async () => {
        // Use a different event ID that likely has no wagers
        const testEventId = 'NONEXISTENT-EVENT';

        const response = await api.get(`/wagers/events/${testEventId}`)
            .set('Authorization', `Bearer ${userAuthToken}`);

        // This might return 404 or empty array depending on API implementation
        if (response.status === 200) {
            expect(response.body).toBeDefined();
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(0);
        } else {
            expect(response.status).toBe(404);
        }

        expect(sanitize(response.body)).toMatchSnapshot();
    })
})

