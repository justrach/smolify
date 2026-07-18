import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Keep the MVP cache deliberately simple. Generated docs already live in R2;
// OpenNext's ISR cache can be added once invalidation behavior is measured.
export default defineCloudflareConfig();
