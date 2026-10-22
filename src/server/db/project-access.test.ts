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

  it("adds the seeded projects and the session's own for the demo", () => {
    const query = dialect.sqlToQuery(visibleProjects(demo));
    expect(query.sql).toBe(
      '("projects"."owner_id" = $1 and ("projects"."demo_session_id" is null or "projects"."demo_session_id" = $2))',
    );
    expect(query.params).toEqual(["demo", "s-a"]);
  });
});

describe("editableProjects", () => {
  it("is the owner for everyone but the demo", () => {
    expect(dialect.sqlToQuery(editableProjects(ada)).sql).toBe(
      '"projects"."owner_id" = $1',
    );
  });

  // Delete, rename and replace run with this: a seeded project's null
  // session or another session's id never equals the caller's own.
  it("is only the session's own projects for the demo", () => {
    const query = dialect.sqlToQuery(editableProjects(demo));
    expect(query.sql).toBe(
      '("projects"."owner_id" = $1 and "projects"."demo_session_id" = $2)',
    );
    expect(query.params).toEqual(["demo", "s-a"]);
  });
});
