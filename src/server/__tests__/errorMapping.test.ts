import { describe, expect, it } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { mapErrorToTurnError } from "../errorMapping";
import { MissingApiKeyError } from "../anthropicClient";

function instanceOf<T>(Ctor: new (...args: never[]) => T): T {
  return Object.create(Ctor.prototype);
}

describe("mapErrorToTurnError", () => {
  it("maps RateLimitError -> rate_limited", () => {
    expect(mapErrorToTurnError(instanceOf(Anthropic.RateLimitError)).code).toBe("rate_limited");
  });

  it("maps BadRequestError -> bad_request", () => {
    expect(mapErrorToTurnError(instanceOf(Anthropic.BadRequestError)).code).toBe("bad_request");
  });

  it("maps AuthenticationError -> server_error", () => {
    expect(mapErrorToTurnError(instanceOf(Anthropic.AuthenticationError)).code).toBe("server_error");
  });

  it("maps PermissionDeniedError -> server_error", () => {
    expect(mapErrorToTurnError(instanceOf(Anthropic.PermissionDeniedError)).code).toBe("server_error");
  });

  it("maps APIConnectionError -> network_error", () => {
    expect(mapErrorToTurnError(instanceOf(Anthropic.APIConnectionError)).code).toBe("network_error");
  });

  it("maps InternalServerError -> server_error", () => {
    expect(mapErrorToTurnError(instanceOf(Anthropic.InternalServerError)).code).toBe("server_error");
  });

  it("maps a generic APIError subtype (e.g. 404 NotFoundError) -> server_error", () => {
    expect(mapErrorToTurnError(instanceOf(Anthropic.NotFoundError)).code).toBe("server_error");
  });

  it("maps MissingApiKeyError -> server_error with a helpful message", () => {
    const result = mapErrorToTurnError(new MissingApiKeyError());
    expect(result.code).toBe("server_error");
    expect(result.message).toMatch(/ANTHROPIC_API_KEY/);
  });

  it("maps a plain Error -> unknown", () => {
    expect(mapErrorToTurnError(new Error("boom")).code).toBe("unknown");
  });

  it("maps a non-Error thrown value -> unknown", () => {
    expect(mapErrorToTurnError("not an error").code).toBe("unknown");
    expect(mapErrorToTurnError(undefined).code).toBe("unknown");
  });
});
