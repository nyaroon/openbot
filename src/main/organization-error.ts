import { Schema } from "effect";

export class OrganizationError extends Schema.TaggedError<OrganizationError>()("OrganizationError", {
  cause: Schema.Defect(),
}) {}
