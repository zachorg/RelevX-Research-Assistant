/**
 * Test script for Brave Search API service
 *
 * Usage:
 *   ts-node scripts/test-brave-search.ts
 *
 * Environment variables required:
 *   BRAVE_SEARCH_API_KEY
 */

// Load environment variables from .env file
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });

import {
  initializeBraveSearch,
  searchWeb,
  searchMultipleQueries,
  deduplicateResults,
  normalizeUrl,
  type SearchFilters,
} from "../packages/core/src/services/brave-search";

async function testSingleSearch() {
  console.log("\n=== Testing Single Search ===\n");

  const query = "artificial intelligence language models 2024";
  const filters: SearchFilters = {
    language: "en",
    country: "US",
    count: 10,
  };

  try {
    console.log(`Searching for: "${query}"\n`);
    const response = await searchWeb(query, filters);

    console.log(`✓ Found ${response.totalResults} results\n`);

    response.results.slice(0, 5).forEach((result, idx) => {
      console.log(`${idx + 1}. ${result.title}`);
      console.log(`   URL: ${result.url}`);
      console.log(`   Description: ${result.description.substring(0, 100)}...`);
      if (result.published_date) {
        console.log(`   Published: ${result.published_date}`);
      }
      console.log();
    });

    return response;
  } catch (error: any) {
    console.error("✗ Search failed:", error.message);
    throw error;
  }
}

async function testMultipleSearches() {
  console.log("\n=== Testing Multiple Searches ===\n");

  const queries = [
    "GPT-4 capabilities",
    "AI code generation tools",
    "language models in production",
  ];

  const filters: SearchFilters = {
    language: "en",
    count: 5,
  };

  try {
    console.log(`Executing ${queries.length} searches...\n`);
    const responses = await searchMultipleQueries(queries, filters);

    console.log(`✓ Completed ${responses.size} searches\n`);

    for (const [query, response] of responses.entries()) {
      console.log(`Query: "${query}"`);
      console.log(`Results: ${response.totalResults}`);
      console.log();
    }

    return responses;
  } catch (error: any) {
    console.error("✗ Multiple searches failed:", error.message);
    throw error;
  }
}

async function testDeduplication() {
  console.log("\n=== Testing Deduplication ===\n");

  const queries = ["OpenAI GPT-4", "GPT-4 release"];

  try {
    const responses = await searchMultipleQueries(queries, { count: 10 });
    const allResponses = Array.from(responses.values());

    // Count total results before dedup
    const totalBefore = allResponses.reduce(
      (sum, r) => sum + r.results.length,
      0
    );

    // Deduplicate
    const uniqueResults = deduplicateResults(allResponses);

    console.log(`Results before deduplication: ${totalBefore}`);
    console.log(`Results after deduplication: ${uniqueResults.length}`);
    console.log(`Duplicates removed: ${totalBefore - uniqueResults.length}\n`);

    console.log("Sample unique results:\n");
    uniqueResults.slice(0, 5).forEach((result, idx) => {
      console.log(`${idx + 1}. ${result.title}`);
      console.log(`   ${result.url}\n`);
    });

    return uniqueResults;
  } catch (error: any) {
    console.error("✗ Deduplication test failed:", error.message);
    throw error;
  }
}

async function testUrlNormalization() {
  console.log("\n=== Testing URL Normalization ===\n");

  const testUrls = [
    "https://www.example.com/page",
    "https://example.com/page/",
    "https://example.com/page?param=value",
    "https://example.com/page#section",
    "https://EXAMPLE.COM/Page",
  ];

  console.log("Test URLs:");
  testUrls.forEach((url) => console.log(`  - ${url}`));

  console.log("\nNormalized URLs:");
  const normalized = testUrls.map((url) => normalizeUrl(url));
  const unique = new Set(normalized);

  normalized.forEach((url) => console.log(`  - ${url}`));

  console.log(
    `\n✓ ${testUrls.length} URLs normalized to ${unique.size} unique URL(s)\n`
  );

  return normalized;
}

async function testSearchWithFilters() {
  console.log("\n=== Testing Search with Filters ===\n");

  const query = "machine learning";
  const filters: SearchFilters = {
    includeDomains: ["github.com", "arxiv.org"],
    language: "en",
    count: 10,
  };

  try {
    console.log(`Query: "${query}"`);
    console.log(`Include domains: ${filters.includeDomains?.join(", ")}\n`);

    const response = await searchWeb(query, filters);

    console.log(`✓ Found ${response.totalResults} results\n`);

    // Check if results are from specified domains
    const domainCounts = new Map<string, number>();
    response.results.forEach((result) => {
      try {
        const domain = new URL(result.url).hostname;
        domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
      } catch (error) {
        // Skip invalid URLs
      }
    });

    console.log("Results by domain:");
    for (const [domain, count] of domainCounts.entries()) {
      console.log(`  ${domain}: ${count} result(s)`);
    }
    console.log();

    return response;
  } catch (error: any) {
    console.error("✗ Filtered search failed:", error.message);
    throw error;
  }
}

async function main() {
  console.log("===========================================");
  console.log("    Brave Search API Test Suite");
  console.log("===========================================");

  // Check for API key
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    console.error(
      "\n✗ Error: BRAVE_SEARCH_API_KEY environment variable not set"
    );
    console.error("Please set it before running this test:\n");
    console.error("  export BRAVE_SEARCH_API_KEY=your-api-key\n");
    process.exit(1);
  }

  // Initialize Brave Search
  console.log("\n✓ Initializing Brave Search client...");
  initializeBraveSearch(apiKey);

  try {
    // Run tests
    await testSingleSearch();
    await testMultipleSearches();
    await testDeduplication();
    await testUrlNormalization();
    await testSearchWithFilters();

    console.log("\n===========================================");
    console.log("    ✓ All tests completed successfully!");
    console.log("===========================================\n");
  } catch (error: any) {
    console.error("\n===========================================");
    console.error("    ✗ Test suite failed");
    console.error("===========================================\n");
    console.error("Error:", error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}
