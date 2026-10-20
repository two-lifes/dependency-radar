import type {
  CheckInput,
  CheckSnapshot,
  CheckState,
  CheckStore,
} from "../check-store";
import type { CheckPackageRow } from "../package-row";

type StoredCheck = CheckState & {
  leaseUntil: Date | null;
  snapshot?: CheckSnapshot;
};

/** In-memory `CheckStore` for unit tests, which never touch the database. */
export function createMemoryCheckStore() {
  const reports = new Map<string, CheckInput>();
  const checks = new Map<string, StoredCheck>();
  const rows = new Map<string, CheckPackageRow[]>();
  let nextId = 1;

  const store: CheckStore = {
    async getCheck(checkId) {
      const check = checks.get(checkId);
      if (!check) return undefined;
      const { id, reportId, status, totalPackages, failureReason, retryAt } =
        check;
      return { id, reportId, status, totalPackages, failureReason, retryAt };
    },
    async getInput(checkId) {
      const check = checks.get(checkId);
      return check && reports.get(check.reportId);
    },
    async listRows(checkId) {
      return [...(rows.get(checkId) ?? [])];
    },
    async insertRow(row) {
      const list = rows.get(row.checkId) ?? [];
      if (list.some((r) => r.name === row.name)) return false;
      rows.set(row.checkId, [...list, row]);
      return true;
    },
    async claimLease(checkId, now, until) {
      const check = checks.get(checkId);
      if (!check || check.status !== "running") return false;
      if (check.leaseUntil && check.leaseUntil > now) return false;
      check.leaseUntil = until;
      return true;
    },
    async renewLease(checkId, until) {
      const check = checks.get(checkId);
      if (!check || check.status !== "running") return false;
      check.leaseUntil = until;
      return true;
    },
    async releaseLease(checkId) {
      const check = checks.get(checkId);
      if (check?.status === "running") check.leaseUntil = null;
    },
    async finish(checkId, snapshot) {
      const check = checks.get(checkId);
      if (!check || check.status !== "running") return false;
      Object.assign(check, {
        status: snapshot.status,
        failureReason: snapshot.failureReason,
        retryAt: snapshot.retryAt,
        leaseUntil: null,
        snapshot,
      });
      return true;
    },
    async createCheck(reportId) {
      const input = reports.get(reportId);
      if (!input) return { ok: false, error: "report-not-found" };
      if (runningFor(reportId)) return { ok: false, error: "already-running" };
      const id = `check-${nextId++}`;
      checks.set(id, {
        id,
        reportId,
        status: "running",
        totalPackages: input.dependencies.length,
        failureReason: null,
        retryAt: null,
        leaseUntil: null,
      });
      return { ok: true, value: { checkId: id } };
    },
    async reopenCheck(checkId, dropReasons) {
      const check = checks.get(checkId);
      if (!check) return { ok: false, error: "check-not-found" };
      if (check.status === "running" || check.status === "completed") {
        return { ok: false, error: "not-reopenable" };
      }
      if (runningFor(check.reportId)) {
        return { ok: false, error: "already-running" };
      }
      rows.set(
        checkId,
        (rows.get(checkId) ?? []).filter(
          (row) => row.reason === null || !dropReasons.includes(row.reason),
        ),
      );
      Object.assign(check, {
        status: "running",
        failureReason: null,
        retryAt: null,
        leaseUntil: null,
        snapshot: undefined,
      });
      return { ok: true, value: undefined };
    },
  };

  function runningFor(reportId: string) {
    return [...checks.values()].some(
      (c) => c.reportId === reportId && c.status === "running",
    );
  }

  return {
    store,
    checks,
    rows,
    addReport(reportId: string, input: CheckInput) {
      reports.set(reportId, input);
    },
  };
}
