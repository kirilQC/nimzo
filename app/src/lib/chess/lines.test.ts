import { expect, it } from "vitest";
import { formatLine } from "./lines";

it("numbers lines from either side", () => {
  expect(formatLine(9, ["Bxf7+", "Kxf7", "Nxe5+"])).toBe("5. Bxf7+ Kxf7 6. Nxe5+");
  expect(formatLine(10, ["Qxg2", "Rf1", "Qxe4+"])).toBe("5... Qxg2 6. Rf1 Qxe4+");
  expect(formatLine(1, [])).toBe("");
});
