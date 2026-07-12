import { cache } from "react";

import { auth } from "@/server/auth";

// Server layouts and pages can ask for the session in the same render without
// repeating the Auth.js database work.
export const getSession = cache(auth);
