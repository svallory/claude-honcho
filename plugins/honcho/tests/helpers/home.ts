import { mock } from "bun:test";
import { mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import * as realOs from "os";

// bun:test shares one module registry across files, so a second
// mock.module("os") would redirect every earlier file's homedir too. Mock once
// here and let every test file that needs a scratch ~/.honcho import this.
export const home = mkdtempSync(join(tmpdir(), "honcho-test-home-"));
mock.module("os", () => ({ ...realOs, homedir: () => home }));
