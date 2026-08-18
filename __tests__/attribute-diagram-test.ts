import { DIAGRAM_COVERAGE } from "@/features/studio/components/AttributeDiagram";

// Every enumerated dossier value needs a drawing — a missing one renders an
// empty chip rather than failing loudly.
describe("attribute diagrams", () => {
  for (const [kind, { values, paths }] of Object.entries(DIAGRAM_COVERAGE)) {
    it(`covers every ${kind} value`, () => {
      for (const value of values) {
        expect(Object.keys(paths)).toContain(value);
      }
    });
  }
});
