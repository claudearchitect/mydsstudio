import { describe, expect, it } from "vitest";
import { emptyBeliefState } from "@fixtures/beliefStates";
import { FakeAgentDriver, dogGroomerOpeningScript } from "@fixtures/fakeAgent";

describe("FakeAgentDriver", () => {
  it("plays the scripted turns in order via the real applyPatch", () => {
    const driver = new FakeAgentDriver(dogGroomerOpeningScript, emptyBeliefState);
    expect(driver.done).toBe(false);

    const step1 = driver.next();
    expect(step1.interaction.mode).toBe("ask");
    expect(step1.beliefState.groups).toEqual({});

    const step2 = driver.next();
    expect(step2.interaction.mode).toBe("propose");
    expect(step2.beliefState.groups.color?.tokens.primary?.$value).toBe("#5b7f5e");
    expect(step2.beliefState.groups.color?.tokens.primary?.provenance).toEqual(["fake-t01"]);

    const step3 = driver.next();
    expect(step3.interaction.mode).toBe("ask");
    expect(step3.beliefState.groups.color?.confidence).toBe(0.45);

    expect(driver.done).toBe(true);
    expect(() => driver.next()).toThrow();
  });

  it("reset() replays from a given state", () => {
    const driver = new FakeAgentDriver(dogGroomerOpeningScript, emptyBeliefState);
    driver.next();
    driver.next();
    driver.reset(emptyBeliefState);
    expect(driver.done).toBe(false);
    expect(driver.currentState).toEqual(emptyBeliefState);
  });
});
