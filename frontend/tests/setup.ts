import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { TextEncoder, TextDecoder } from "util";

Object.assign(global, { TextDecoder, TextEncoder });

// Testing Library only auto-registers cleanup when Vitest globals are enabled.
// They aren't here (tests import describe/it/expect explicitly), so without
// this the DOM accumulates across tests in a file and queries match duplicates.
afterEach(cleanup);

import { MotionGlobalConfig } from "framer-motion";
MotionGlobalConfig.skipAnimations = true;
