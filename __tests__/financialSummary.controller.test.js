jest.mock("../models/FundTransfer", () => ({
  aggregate: jest.fn(),
}));

jest.mock("../models/Transaction", () => ({
  aggregate: jest.fn(),
}));

jest.mock("../models/User", () => ({
  find: jest.fn(),
}));

const FundTransfer = require("../models/FundTransfer");
const Transaction = require("../models/Transaction");
const User = require("../models/User");

const { getFinancialSummary } = require("../controllers/reportController");

function createRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

describe("reportController.getFinancialSummary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns fund transfer totals even when there are no expense transactions", async () => {
    FundTransfer.aggregate.mockResolvedValueOnce([
      {
        byType: [
          { _id: "bank", totalAmount: 1800, count: 1 },
          { _id: "cash", totalAmount: 5000, count: 1 },
        ],
        overall: [{ _id: null, total: 6800, count: 2 }],
      },
    ]);

    Transaction.aggregate.mockResolvedValueOnce([]);
    User.find.mockResolvedValueOnce([]);

    const req = {
      query: {},
      user: { _id: "u1", role: "admin" },
    };
    const res = createRes();

    await getFinancialSummary(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];

    expect(payload.success).toBe(true);
    expect(payload.data.fundTransfers.overall.total).toBe(6800);
    expect(payload.data.fundTransfers.byType.bank.totalAmount).toBe(1800);
    expect(payload.data.fundTransfers.byType.cash.totalAmount).toBe(5000);

    expect(payload.data.expenseTransactions.summary.totalTransactions).toBe(0);
    expect(payload.data.expenseTransactions.summary.totalAmount).toBe(0);
  });

  test("applies manager team-role filtering helper without crashing", async () => {
    FundTransfer.aggregate.mockResolvedValueOnce([
      { byType: [], overall: [{ _id: null, total: 0, count: 0 }] },
    ]);

    User.find.mockResolvedValueOnce([{ _id: "e1" }, { _id: "e2" }]);
    Transaction.aggregate.mockResolvedValueOnce([
      { _id: "approved", count: 2, totalAmount: 200 },
      { _id: "pending", count: 1, totalAmount: 50 },
    ]);

    const req = {
      query: { period: "all" },
      user: { _id: "m1", role: "manager" },
    };
    const res = createRes();

    await getFinancialSummary(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];

    expect(payload.data.expenseTransactions.summary.totalTransactions).toBe(3);
    expect(payload.data.expenseTransactions.summary.approvedCount).toBe(2);
    expect(payload.data.expenseTransactions.summary.pendingCount).toBe(1);
  });

  test("does not expose fund transfer aggregates to non-admin/manager roles", async () => {
    // Should not call FundTransfer.aggregate for employee
    User.find.mockResolvedValueOnce([]);
    Transaction.aggregate.mockResolvedValueOnce([]);

    const req = {
      query: {},
      user: { _id: "e1", role: "employee" },
    };
    const res = createRes();

    await getFinancialSummary(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(FundTransfer.aggregate).not.toHaveBeenCalled();

    const payload = res.json.mock.calls[0][0];
    expect(payload.data.fundTransfers.overall.total).toBe(0);
    expect(payload.data.fundTransfers.overall.count).toBe(0);
  });
});
