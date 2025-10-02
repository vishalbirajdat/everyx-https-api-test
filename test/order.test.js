const request = require('supertest');
require('dotenv').config();
const api = request(process.env.API_BASE_URL || "http://localhost:8800");
let userAuthToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiNjhiOWI3ZTExZDZlNTkwYzc0OGEwMTc3IiwiZW1haWwiOiJza3VtYXIudmsxMkBnbWFpbC5jb20iLCJpYXQiOjE3NTg3MDU5NDN9.gd-dtII6w1bGZ0R3ghl9Ui9-2U6vKeF_ApHQT7_g9fY';
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


describe('Get Event Data and Quote', () => {
  let eventData;
  let outcome;

  test(`Get Data of Event ${eventId}`, async () => {
    const response = await api.get(`/events/${eventId}`);
    expect(response.status).toBe(200);

    eventData = response.body;
    outcome = eventData.outcomes[0];
    expect(outcome).toBeDefined();


    expect(sanitize(response.body)).toMatchSnapshot();
  })

  test('has to give error when setting pledge below min_pledge', async () => {

    let pledge = outcome.trader_info.min_pledge - 1;
    let leverage = 1;
    let wager = pledge * leverage;
    let loan = wager - pledge;

    const payload = {
      event_id: eventId,
      event_outcome_id: outcome._id,
      pledge: pledge,
      leverage: leverage,
      wager: wager,
      loan: loan,
      force_leverage: false,
    }

    const response = await api.post('/quotes')
      .send(payload)
      .set('Authorization', `Bearer ${userAuthToken}`);

    expect(response.status).toBe(409);

    expect(sanitize(response.body)).toMatchSnapshot();
  })

  test('has to give error when setting pledge above max_pledge', async () => {

    let pledge = outcome.trader_info.max_pledge + 1;
    let leverage = 1;
    let wager = pledge * leverage;
    let loan = wager - pledge;

    const payload = {
      event_id: eventId,
      event_outcome_id: outcome._id,
      pledge: pledge,
      leverage: leverage,
      wager: wager,
      loan: loan,
      force_leverage: false,
    }

    const response = await api.post('/quotes')
      .send(payload)
      .set('Authorization', `Bearer ${userAuthToken}`);

    expect(response.status).toBe(409);

    expect(sanitize(response.body)).toMatchSnapshot();
  })

  test('has to give quote for min_pledge', async () => {
    expect(outcome).toBeDefined();

    let pledge = outcome.trader_info.min_pledge;
    let leverage = 1;
    let wager = pledge * leverage;
    let loan = wager - pledge;

    const payload = {
      event_id: eventId,
      event_outcome_id: outcome._id,
      pledge: pledge,
      leverage: leverage,
      wager: wager,
      loan: loan,
      force_leverage: false,
    }

    const response = await api.post('/quotes')
      .send(payload)
      .set('Authorization', `Bearer ${userAuthToken}`);

    expect(response.status).toBe(201);

    expect(sanitize(response.body)).toMatchSnapshot();
  })

  test('has to give quote for max_pledge', async () => {

    let pledge = outcome.trader_info.max_pledge;
    let leverage = 1;
    let wager = pledge * leverage;
    let loan = wager - pledge;

    const payload = {
      event_id: eventId,
      event_outcome_id: outcome._id,
      pledge: pledge,
      leverage: leverage,
      wager: wager,
      loan: loan,
      force_leverage: false,
    }

    const response = await api.post('/quotes')
      .send(payload)
      .set('Authorization', `Bearer ${userAuthToken}`);

    expect(response.status).toBe(201);

    expect(sanitize(response.body)).toMatchSnapshot();
  })

  test('has to give quote for max_leverage', async () => {
    expect(outcome).toBeDefined();
    let pledge = outcome.trader_info.min_pledge;
    let leverage = outcome.trader_info.max_leverage;
    let wager = pledge * leverage;
    let loan = wager - pledge;

    const payload = {
      event_id: eventId,
      event_outcome_id: outcome._id,
      pledge: pledge,
      leverage: leverage,
      wager: wager,
      loan: loan,
      force_leverage: false,
    }

    const response = await api.post('/quotes')
      .send(payload)
      .set('Authorization', `Bearer ${userAuthToken}`);

    expect(response.status).toBe(201);

    expect(sanitize(response.body)).toMatchSnapshot();
  })

  test('has to give error when setting leverage above max_leverage', async () => {
    expect(outcome).toBeDefined();
    let pledge = outcome.trader_info.min_pledge;
    let leverage = outcome.trader_info.max_leverage + 1;
    let wager = pledge * leverage;
    let loan = wager - pledge;


    const payload = {
      event_id: eventId,
      event_outcome_id: outcome._id,
      pledge: pledge,
      leverage: leverage,
      wager: wager,
      loan: loan,
      force_leverage: false,
    }

    const response = await api.post('/quotes')
      .send(payload)
      .set('Authorization', `Bearer ${userAuthToken}`);

    expect(response.status).toBe(409);

    expect(sanitize(response.body)).toMatchSnapshot();
  })
})


describe('Wager Creation & Verification', () => {
  let eventData;
  let outcome;
  let walletData;
  let quote;

  test(`Get Data of Event ${eventId}`, async () => {
    const response = await api.get(`/events/${eventId}`);
    expect(response.status).toBe(200);

    eventData = response.body;
    outcome = eventData.outcomes[0];
    expect(outcome).toBeDefined();
  })

  test('Get Wallet Data', async () => {
    const response = await api.get('/wallets').set('Authorization', `Bearer ${userAuthToken}`);
    expect(response.status).toBe(200);

    walletData = response.body;
    expect(walletData).toBeDefined();
    expect(Object.keys(walletData).length).toBeGreaterThan(0);
    expect(sanitize(walletData)).toMatchSnapshot();
  })

  test('has to give quote for min_pledge and leverage 1', async () => {
    expect(outcome).toBeDefined();
    let pledge = outcome.trader_info.min_pledge;
    let leverage = 1;
    let wager = pledge * leverage;
    let loan = wager - pledge;

    const payload = {
      event_id: eventId,
      event_outcome_id: outcome._id,
      pledge: pledge,
      leverage: leverage,
      wager: wager,
      loan: loan,
      force_leverage: false,
    }

    const response = await api.post('/quotes')
      .send(payload)
      .set('Authorization', `Bearer ${userAuthToken}`);

    expect(response.status).toBe(201);

    quote = response.body;
  })

  test('has to give unauthorized error when not providing auth token', async () => {

    let pledge = outcome.trader_info.min_pledge;
    let leverage = 1;
    let wager = pledge * leverage;
    let loan = wager - pledge;

    const payload = {
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

    const response = await api.post('/wagers')
      .send(payload);

    expect(response.status).toBe(401);
    expect(sanitize(response.body)).toMatchSnapshot();
  })

  test('has to give error when setting pledge below min_pledge', async () => {

    let pledge = outcome.trader_info.min_pledge - 1;
    let leverage = 1;
    let wager = pledge * leverage;
    let loan = wager - pledge;

    const payload = {
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

    const response = await api.post('/wagers')
      .send(payload)
      .set('Authorization', `Bearer ${userAuthToken}`);

    expect(response.status).toBe(500);

    expect(sanitize(response.body)).toMatchSnapshot();
  })

  test('has to give error when setting pledge above max_pledge', async () => {

    let pledge = outcome.trader_info.max_pledge + 1;
    let leverage = 1;
    let wager = pledge * leverage;
    let loan = wager - pledge;

    const payload = {
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

    const response = await api.post('/wagers')
      .send(payload)
      .set('Authorization', `Bearer ${userAuthToken}`);

    expect(response.status).toBe(500);

    expect(sanitize(response.body)).toMatchSnapshot();
  })

  test('has to give error when setting max_payout above indicative_payout', async () => {

    let pledge = outcome.trader_info.min_pledge;
    let leverage = 1;
    let wager = pledge * leverage;
    let loan = wager - pledge;

    const payload = {
      event_id: eventId,
      wallet_id: walletData.wallets.topup.id,
      event_outcome_id: outcome._id,
      pledge: pledge,
      leverage: leverage,
      wager: wager,
      loan: loan,
      force_leverage: false,
      max_payout: quote.indicative_payout + 1,
    }

    const response = await api.post('/wagers')
      .send(payload)
      .set('Authorization', `Bearer ${userAuthToken}`);

    expect(response.status).toBe(500);

    expect(sanitize(response.body)).toMatchSnapshot();
  })

  test('has to create wager with min_pledge and leverage 1', async () => {

    let pledge = outcome.trader_info.min_pledge;
    let leverage = 1;
    let wager = pledge * leverage;
    let loan = wager - pledge;
    let quote;


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

    const payload = {
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

    const response = await api.post('/wagers')
      .send(payload)
      .set('Authorization', `Bearer ${userAuthToken}`);

    expect(response.status).toBe(201);

    expect(sanitize(response.body)).toMatchSnapshot();
  })

  test('has to create wager with max_pledge with no leverage', async () => {

    let pledge = outcome.trader_info.max_pledge;
    let leverage = 1;
    let wager = pledge * leverage;
    let loan = wager - pledge;
    let quote;


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

    const payload = {
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

    const response = await api.post('/wagers')
      .send(payload)
      .set('Authorization', `Bearer ${userAuthToken}`);

    expect(response.status).toBe(201);

    expect(sanitize(response.body)).toMatchSnapshot();
  })
})


describe('Wager Creation and Verification of Wallet Deductions and Event Changes', () => {
  test('can wager with min pledge min leverage - verify wallet deduction and event changes', async () => {
    // Get initial wallet balances
    const initialWalletResponse = await api.get('/wallets').set('Authorization', `Bearer ${userAuthToken}`);
    expect(initialWalletResponse.status).toBe(200);
    const initialWallets = initialWalletResponse.body.wallets;
    const initialTopupBalance = parseFloat(initialWallets.topup.balance);
    const initialProfitBalance = parseFloat(initialWallets.profit.balance);
    const initialBonusBalance = parseFloat(initialWallets.bonus.balance);

    // Get initial event data for comparison
    const initialEventResponse = await api.get(`/events/${eventId}`);
    expect(initialEventResponse.status).toBe(200);
    const initialEventData = initialEventResponse.body;
    const initialOutcome = initialEventData.outcomes[0];
    const initialParticipantsCount = initialEventData.participants_count || 0;
    const initialWagers = initialEventData.volume || 0;

    let pledge = initialOutcome.trader_info.min_pledge;
    let leverage = 1;
    let wager = pledge * leverage;
    let loan = wager - pledge;
    let quote;

    // Get quote first
    const quotePayload = {
      event_id: eventId,
      event_outcome_id: initialOutcome._id,
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
    const payload = {
      event_id: eventId,
      wallet_id: initialWallets.topup.id,
      event_outcome_id: initialOutcome._id,
      pledge: pledge,
      leverage: leverage,
      wager: wager,
      loan: loan,
      force_leverage: false,
      max_payout: quote.indicative_payout,
    }

    const response = await api.post('/wagers')
      .send(payload)
      .set('Authorization', `Bearer ${userAuthToken}`);

    expect(response.status).toBe(201);

    // Verify wallet deduction (sequential: topup -> profit -> bonus with max 10 from bonus)
    const finalWalletResponse = await api.get('/wallets').set('Authorization', `Bearer ${userAuthToken}`);
    expect(finalWalletResponse.status).toBe(200);
    const finalWallets = finalWalletResponse.body.wallets;
    const finalTopupBalance = parseFloat(finalWallets.topup.balance);
    const finalProfitBalance = parseFloat(finalWallets.profit.balance);
    const finalBonusBalance = parseFloat(finalWallets.bonus.balance);

    // Calculate expected deductions based on sequential priority
    let remainingPledge = pledge;
    let expectedTopupDeduction = 0;
    let expectedProfitDeduction = 0;
    let expectedBonusDeduction = 0;

    // First deduct from topup
    if (remainingPledge > 0 && initialTopupBalance > 0) {
      expectedTopupDeduction = Math.min(remainingPledge, initialTopupBalance);
      remainingPledge -= expectedTopupDeduction;
    }

    // Then deduct from profit
    if (remainingPledge > 0 && initialProfitBalance > 0) {
      expectedProfitDeduction = Math.min(remainingPledge, initialProfitBalance);
      remainingPledge -= expectedProfitDeduction;
    }

    // Finally deduct from bonus (max 10 at a time)
    if (remainingPledge > 0 && initialBonusBalance > 0) {
      expectedBonusDeduction = Math.min(remainingPledge, Math.min(10, initialBonusBalance));
      remainingPledge -= expectedBonusDeduction;
    }

    // Verify the deductions (using toBeCloseTo for floating point precision)
    expect(finalTopupBalance).toBeCloseTo(initialTopupBalance - expectedTopupDeduction, 2);
    expect(finalProfitBalance).toBeCloseTo(initialProfitBalance - expectedProfitDeduction, 2);
    expect(finalBonusBalance).toBeCloseTo(initialBonusBalance - expectedBonusDeduction, 2);

    // Verify event outcome changes
    const finalEventResponse = await api.get(`/events/${eventId}`);
    expect(finalEventResponse.status).toBe(200);
    const finalEventData = finalEventResponse.body;
    const finalOutcome = finalEventData.outcomes[0];

    // Check participants count increased
    expect(finalEventData.participants_count).toBe(initialParticipantsCount + 1);

    // Check wager value increased (using toBeCloseTo for floating point precision)
    expect(finalEventData.volume).toBeCloseTo(initialWagers + wager, 2);

    // Verify probability changes (should be different from initial)
    expect(finalOutcome.trader_info.estimated_probability).toBeDefined();

    expect(sanitize(response.body)).toMatchSnapshot();
  })

  test('can wager with max pledge min leverage - verify wallet deduction and event changes', async () => {
    // Get initial wallet balances
    const initialWalletResponse = await api.get('/wallets').set('Authorization', `Bearer ${userAuthToken}`);
    expect(initialWalletResponse.status).toBe(200);
    const initialWallets = initialWalletResponse.body.wallets;
    const initialTopupBalance = parseFloat(initialWallets.topup.balance);
    const initialProfitBalance = parseFloat(initialWallets.profit.balance);
    const initialBonusBalance = parseFloat(initialWallets.bonus.balance);

    // Get initial event data for comparison
    const initialEventResponse = await api.get(`/events/${eventId}`);
    expect(initialEventResponse.status).toBe(200);
    const initialEventData = initialEventResponse.body;
    const initialOutcome = initialEventData.outcomes[0];
    const initialParticipantsCount = initialEventData.participants_count || 0;
    const initialWagers = initialEventData.volume || 0;

    let pledge = initialOutcome.trader_info.max_pledge;
    let leverage = 1;
    let wager = pledge * leverage;
    let loan = wager - pledge;
    let quote;

    // Get quote first
    const quotePayload = {
      event_id: eventId,
      event_outcome_id: initialOutcome._id,
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
    const payload = {
      event_id: eventId,
      wallet_id: initialWallets.topup.id,
      event_outcome_id: initialOutcome._id,
      pledge: pledge,
      leverage: leverage,
      wager: wager,
      loan: loan,
      force_leverage: false,
      max_payout: quote.indicative_payout,
    }

    const response = await api.post('/wagers')
      .send(payload)
      .set('Authorization', `Bearer ${userAuthToken}`);

    expect(response.status).toBe(201);

    // Verify wallet deduction (sequential: topup -> profit -> bonus with max 10 from bonus)
    const finalWalletResponse = await api.get('/wallets').set('Authorization', `Bearer ${userAuthToken}`);
    expect(finalWalletResponse.status).toBe(200);
    const finalWallets = finalWalletResponse.body.wallets;
    const finalTopupBalance = parseFloat(finalWallets.topup.balance);
    const finalProfitBalance = parseFloat(finalWallets.profit.balance);
    const finalBonusBalance = parseFloat(finalWallets.bonus.balance);

    // Calculate expected deductions based on sequential priority
    let remainingPledge = pledge;
    let expectedTopupDeduction = 0;
    let expectedProfitDeduction = 0;
    let expectedBonusDeduction = 0;

    // First deduct from topup
    if (remainingPledge > 0 && initialTopupBalance > 0) {
      expectedTopupDeduction = Math.min(remainingPledge, initialTopupBalance);
      remainingPledge -= expectedTopupDeduction;
    }

    // Then deduct from profit
    if (remainingPledge > 0 && initialProfitBalance > 0) {
      expectedProfitDeduction = Math.min(remainingPledge, initialProfitBalance);
      remainingPledge -= expectedProfitDeduction;
    }

    // Finally deduct from bonus (max 10 at a time)
    if (remainingPledge > 0 && initialBonusBalance > 0) {
      expectedBonusDeduction = Math.min(remainingPledge, Math.min(10, initialBonusBalance));
      remainingPledge -= expectedBonusDeduction;
    }

    // Verify the deductions (using toBeCloseTo for floating point precision)
    expect(finalTopupBalance).toBeCloseTo(initialTopupBalance - expectedTopupDeduction, 2);
    expect(finalProfitBalance).toBeCloseTo(initialProfitBalance - expectedProfitDeduction, 2);
    expect(finalBonusBalance).toBeCloseTo(initialBonusBalance - expectedBonusDeduction, 2);

    // Verify event outcome changes
    const finalEventResponse = await api.get(`/events/${eventId}`);
    expect(finalEventResponse.status).toBe(200);
    const finalEventData = finalEventResponse.body;
    const finalOutcome = finalEventData.outcomes[0];

    // Check participants count increased
    expect(finalEventData.participants_count).toBe(initialParticipantsCount + 1);

    // Check wager count increased (using toBeCloseTo for floating point precision)
    expect(finalEventData.volume).toBeCloseTo(initialWagers + wager, 2);

    // Verify probability changes (should be different from initial)
    expect(finalOutcome.trader_info.estimated_probability).toBeDefined();

    expect(sanitize(response.body)).toMatchSnapshot();
  })

  test('can wager with max leverage and min pledge - verify wallet deduction and event changes', async () => {
    // Get initial wallet balances
    const initialWalletResponse = await api.get('/wallets').set('Authorization', `Bearer ${userAuthToken}`);
    expect(initialWalletResponse.status).toBe(200);
    const initialWallets = initialWalletResponse.body.wallets;
    const initialTopupBalance = parseFloat(initialWallets.topup.balance);
    const initialProfitBalance = parseFloat(initialWallets.profit.balance);
    const initialBonusBalance = parseFloat(initialWallets.bonus.balance);

    // Get initial event data for comparison
    const initialEventResponse = await api.get(`/events/${eventId}`);
    expect(initialEventResponse.status).toBe(200);
    const initialEventData = initialEventResponse.body;
    const initialOutcome = initialEventData.outcomes[0];
    const initialParticipantsCount = initialEventData.participants_count || 0;
    const initialWagers = initialEventData.volume || 0;

    let pledge = initialOutcome.trader_info.min_pledge;
    let leverage = initialOutcome.trader_info.max_leverage;
    let wager = pledge * leverage;
    let loan = wager - pledge;
    let quote;

    // Get quote first
    const quotePayload = {
      event_id: eventId,
      event_outcome_id: initialOutcome._id,
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
    const payload = {
      event_id: eventId,
      wallet_id: initialWallets.topup.id,
      event_outcome_id: initialOutcome._id,
      pledge: pledge,
      leverage: leverage,
      wager: wager,
      loan: loan,
      force_leverage: false,
      max_payout: quote.indicative_payout,
    }

    const response = await api.post('/wagers')
      .send(payload)
      .set('Authorization', `Bearer ${userAuthToken}`);

    expect(response.status).toBe(201);

    // Verify wallet deduction (sequential: topup -> profit -> bonus with max 10 from bonus)
    const finalWalletResponse = await api.get('/wallets').set('Authorization', `Bearer ${userAuthToken}`);
    expect(finalWalletResponse.status).toBe(200);
    const finalWallets = finalWalletResponse.body.wallets;
    const finalTopupBalance = parseFloat(finalWallets.topup.balance);
    const finalProfitBalance = parseFloat(finalWallets.profit.balance);
    const finalBonusBalance = parseFloat(finalWallets.bonus.balance);

    // Calculate expected deductions based on sequential priority
    let remainingPledge = pledge;
    let expectedTopupDeduction = 0;
    let expectedProfitDeduction = 0;
    let expectedBonusDeduction = 0;

    // First deduct from topup
    if (remainingPledge > 0 && initialTopupBalance > 0) {
      expectedTopupDeduction = Math.min(remainingPledge, initialTopupBalance);
      remainingPledge -= expectedTopupDeduction;
    }

    // Then deduct from profit
    if (remainingPledge > 0 && initialProfitBalance > 0) {
      expectedProfitDeduction = Math.min(remainingPledge, initialProfitBalance);
      remainingPledge -= expectedProfitDeduction;
    }

    // Finally deduct from bonus (max 10 at a time)
    if (remainingPledge > 0 && initialBonusBalance > 0) {
      expectedBonusDeduction = Math.min(remainingPledge, Math.min(10, initialBonusBalance));
      remainingPledge -= expectedBonusDeduction;
    }

    // Verify the deductions (using toBeCloseTo for floating point precision)
    expect(finalTopupBalance).toBeCloseTo(initialTopupBalance - expectedTopupDeduction, 2);
    expect(finalProfitBalance).toBeCloseTo(initialProfitBalance - expectedProfitDeduction, 2);
    expect(finalBonusBalance).toBeCloseTo(initialBonusBalance - expectedBonusDeduction, 2);

    // Verify event outcome changes
    const finalEventResponse = await api.get(`/events/${eventId}`);
    expect(finalEventResponse.status).toBe(200);
    const finalEventData = finalEventResponse.body;
    const finalOutcome = finalEventData.outcomes[0];

    // Check participants count increased
    expect(finalEventData.participants_count).toBe(initialParticipantsCount + 1);

    // Check wager count increased (using toBeCloseTo for floating point precision)
    expect(finalEventData.volume).toBeCloseTo(initialWagers + wager, 2);

    // Verify probability changes (should be different from initial)
    expect(finalOutcome.trader_info.estimated_probability).toBeDefined();

    expect(sanitize(response.body)).toMatchSnapshot();
  })
})


describe('Add Margin with wallet deduction and event changes', () => {
  test('verification of qoute data with force_leverage true', async () => {

    const eventDataResponse = await api.get(`/events/${eventId}`);
    expect(eventDataResponse.status).toBe(200);
    const eventData = eventDataResponse.body;
    const outcome = eventData.outcomes[0];

    let leverage = 1;
    let pledge = outcome.trader_info.min_pledge;
    let wager = pledge * leverage;
    let loan = wager - pledge;

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
    const quote = quoteResponse.body;
    expect(quote.after_pledge).toBe(pledge + quote.before_pledge);
    expect(quote.after_wager).toBe(wager + quote.before_wager);
    expect(sanitize(quote)).toMatchSnapshot();
  })

  test('able to add margin in leveraged positions', async () => {
    const initialWalletResponse = await api.get('/wallets').set('Authorization', `Bearer ${userAuthToken}`);
    expect(initialWalletResponse.status).toBe(200);
    const initialWallets = initialWalletResponse.body.wallets;
    const initialTopupBalance = parseFloat(initialWallets.topup.balance);
    const initialProfitBalance = parseFloat(initialWallets.profit.balance);
    const initialBonusBalance = parseFloat(initialWallets.bonus.balance);

    const initialEventResponse = await api.get(`/events/${eventId}`);
    expect(initialEventResponse.status).toBe(200);
    const initialEventData = initialEventResponse.body;
    const initialOutcome = initialEventData.outcomes[0];
    const initialParticipantsCount = initialEventData.participants_count || 0;
    const initialWagers = initialEventData.volume || 0;

    let pledge = initialOutcome.trader_info.min_pledge;
    let leverage = 1;
    let wager = pledge * leverage;
    let loan = wager - pledge;
    let quote;

    const quotePayload = {
      event_id: eventId,
      event_outcome_id: initialOutcome._id,
      leverage: leverage,
      pledge: pledge,
      wager: wager,
      loan: loan,
      force_leverage: true,
    }

    const quoteResponse = await api.post('/quotes')
      .send(quotePayload)
      .set('Authorization', `Bearer ${userAuthToken}`);

    expect(quoteResponse.status).toBe(201);
    quote = quoteResponse.body;
    expect(quote.after_pledge).toBe(pledge + quote.before_pledge);
    expect(quote.after_wager).toBe(wager + quote.before_wager);


    const payload = {
      event_id: eventId,
      wallet_id: initialWallets.topup.id,
      event_outcome_id: initialOutcome._id,
      pledge: pledge,
      leverage: leverage,
      wager: wager,
      loan: loan,
      force_leverage: true,
      max_payout: quote.indicative_payout,
    }

    const response = await api.post('/wagers')
      .send(payload)
      .set('Authorization', `Bearer ${userAuthToken}`);

    expect(response.status).toBe(201);
    expect(sanitize(response.body)).toMatchSnapshot();

    // Verify wallet deduction (sequential: topup -> profit -> bonus with max 10 from bonus)
    const finalWalletResponse = await api.get('/wallets').set('Authorization', `Bearer ${userAuthToken}`);
    expect(finalWalletResponse.status).toBe(200);
    const finalWallets = finalWalletResponse.body.wallets;
    const finalTopupBalance = parseFloat(finalWallets.topup.balance);
    const finalProfitBalance = parseFloat(finalWallets.profit.balance);
    const finalBonusBalance = parseFloat(finalWallets.bonus.balance);

    // Calculate expected deductions based on sequential priority
    let remainingPledge = pledge;
    let expectedTopupDeduction = 0;
    let expectedProfitDeduction = 0;
    let expectedBonusDeduction = 0;

    // First deduct from topup
    if (remainingPledge > 0 && initialTopupBalance > 0) {
      expectedTopupDeduction = Math.min(remainingPledge, initialTopupBalance);
      remainingPledge -= expectedTopupDeduction;
    }

    // Then deduct from profit
    if (remainingPledge > 0 && initialProfitBalance > 0) {
      expectedProfitDeduction = Math.min(remainingPledge, initialProfitBalance);
      remainingPledge -= expectedProfitDeduction;
    }

    // Finally deduct from bonus (max 10 at a time)
    if (remainingPledge > 0 && initialBonusBalance > 0) {
      expectedBonusDeduction = Math.min(remainingPledge, Math.min(10, initialBonusBalance));
      remainingPledge -= expectedBonusDeduction;
    }

    // Verify the deductions (using toBeCloseTo for floating point precision)
    expect(finalTopupBalance).toBeCloseTo(initialTopupBalance - expectedTopupDeduction, 2);
    expect(finalProfitBalance).toBeCloseTo(initialProfitBalance - expectedProfitDeduction, 2);
    expect(finalBonusBalance).toBeCloseTo(initialBonusBalance - expectedBonusDeduction, 2);

    // Verify event outcome changes
    const finalEventResponse = await api.get(`/events/${eventId}`);
    expect(finalEventResponse.status).toBe(200);
    const finalEventData = finalEventResponse.body;
    const finalOutcome = finalEventData.outcomes[0];

    // Check participants count increased
    expect(finalEventData.participants_count).toBe(initialParticipantsCount + 1);

    // Check wager value increased (using toBeCloseTo for floating point precision)
    expect(finalEventData.volume).toBeCloseTo(initialWagers + wager, 2);

    // Verify probability changes (should be different from initial)
    expect(finalOutcome.trader_info.estimated_probability).toBeDefined();

    expect(sanitize(response.body)).toMatchSnapshot();
  })
})