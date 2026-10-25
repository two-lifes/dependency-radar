import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { DEMO_USER } from "../demo/demo-user";
import { editableProjects, visibleProjects } from "./project-access";

// Unit tests don't touch the database (plan.md assumption 1), so these check
// the conditions the queries run with.
const dialect = new PgDialect();
const ada = { userId: "u1", sessionId: "s-ada" };
const demo = { userId: DEMO_USER.id, sessionId: "s-a" };

describe("visibleProjects", () => {
  it("is the owner for everyone but the demo", () => {
    const query = dialect.sqlToQuery(visibleProjects(ada));
    expect(query.sql).toBe('"projects"."owner_id" = $1');
    expect(query.params).toEqual(["u1"]);
  });

  it("denies all projects for old demo sessions", () => {
    const query = dialect.sqlToQuery(visibleProjects(demo));
    expect(query.sql).toBe("false");
    expect(query.params).toEqual([]);
  });
});

describe("editableProjects", () => {
  it("is the owner for everyone but the demo", () => {
    expect(dialect.sqlToQuery(editableProjects(ada)).sql).toBe(
      '"projects"."owner_id" = $1',
    );
  });

  // Delete, rename and replace all use this predicate.
  it("denies all mutations for old demo sessions", () => {
    const query = dialect.sqlToQuery(editableProjects(demo));
    expect(query.sql).toBe("false");
    expect(query.params).toEqual([]);
  });
});
