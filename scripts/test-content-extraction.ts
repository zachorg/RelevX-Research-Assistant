/**
 * Test script for content extraction service
 *
 * Usage:
 *   ts-node scripts/test-content-extraction.ts
 *
 * No environment variables required (uses public URLs)
 */

// Load environment variables from .env file (optional for this test)
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });

import {
  extractContent,
  extractMultipleContents,
  getContentPreview,
  type ExtractionOptions,
} from "../packages/core/src/services/content-extractor";

async function testSingleExtraction() {
  console.log("\n=== Testing Single URL Extraction ===\n");

  const url = "https://example.com";

  try {
    console.log(`Extracting content from: ${url}\n`);
    const content = await extractContent(url);

    console.log(`✓ Extraction Status: ${content.fetchStatus}\n`);
    console.log(`Title: ${content.title || "N/A"}`);
    console.log(`Word Count: ${content.wordCount}`);
    console.log(`Headings: ${content.headings.length}`);
    console.log(`Images: ${content.images.length}`);
    console.log(
      `\nSnippet (first 200 chars):\n${content.snippet.substring(0, 200)}...\n`
    );

    if (content.metadata.author) {
      console.log(`Author: ${content.metadata.author}`);
    }
    if (content.metadata.publishedDate) {
      console.log(`Published: ${content.metadata.publishedDate}`);
    }

    return content;
  } catch (error: any) {
    console.error("✗ Extraction failed:", error.message);
    throw error;
  }
}

async function testMultipleExtractions() {
  console.log("\n=== Testing Multiple URL Extractions ===\n");

  const urls = [
    "https://example.com",
    "https://www.wikipedia.org",
    "https://github.com",
  ];

  try {
    console.log(`Extracting content from ${urls.length} URLs...\n`);
    const contents = await extractMultipleContents(urls, undefined, 2);

    console.log(`✓ Extracted ${contents.length} URLs\n`);

    contents.forEach((content, idx) => {
      console.log(`${idx + 1}. ${content.url}`);
      console.log(`   Status: ${content.fetchStatus}`);
      console.log(`   Title: ${content.title || "N/A"}`);
      console.log(`   Words: ${content.wordCount}`);
      if (content.fetchError) {
        console.log(`   Error: ${content.fetchError}`);
      }
      console.log();
    });

    // Summary
    const successful = contents.filter((c) => c.fetchStatus === "success");
    const failed = contents.filter((c) => c.fetchStatus === "failed");
    const blocked = contents.filter((c) => c.fetchStatus === "blocked");
    const timeout = contents.filter((c) => c.fetchStatus === "timeout");

    console.log("Summary:");
    console.log(`  Successful: ${successful.length}`);
    console.log(`  Failed: ${failed.length}`);
    console.log(`  Blocked: ${blocked.length}`);
    console.log(`  Timeout: ${timeout.length}\n`);

    return contents;
  } catch (error: any) {
    console.error("✗ Multiple extractions failed:", error.message);
    throw error;
  }
}

async function testExtractionOptions() {
  console.log("\n=== Testing Extraction Options ===\n");

  const url = "https://example.com";
  const options: ExtractionOptions = {
    timeout: 5000,
    minSnippetLength: 100,
    maxSnippetLength: 300,
  };

  try {
    console.log(`URL: ${url}`);
    console.log(`Options:`, options);
    console.log();

    const content = await extractContent(url, options);

    console.log(`✓ Extraction completed`);
    console.log(`Status: ${content.fetchStatus}`);
    console.log(`Snippet length: ${content.snippet.length} chars\n`);

    return content;
  } catch (error: any) {
    console.error("✗ Extraction with options failed:", error.message);
    throw error;
  }
}

async function testContentPreview() {
  console.log("\n=== Testing Content Preview ===\n");

  const url = "https://example.com";

  try {
    const content = await extractContent(url);
    const preview = getContentPreview(content);

    console.log("Content Preview:\n");
    console.log(preview);
    console.log();

    return preview;
  } catch (error: any) {
    console.error("✗ Preview generation failed:", error.message);
    throw error;
  }
}

async function testImageExtraction() {
  console.log("\n=== Testing Image Extraction ===\n");

  // Wikipedia pages typically have good images
  const url = "https://en.wikipedia.org/wiki/Artificial_intelligence";

  try {
    console.log(`Extracting images from: ${url}\n`);
    const content = await extractContent(url);

    console.log(`✓ Found ${content.images.length} images\n`);

    if (content.images.length > 0) {
      console.log("Sample images (first 5):\n");
      content.images.slice(0, 5).forEach((img, idx) => {
        console.log(`${idx + 1}. ${img.src}`);
        if (img.alt) {
          console.log(`   Alt: ${img.alt}`);
        }
        if (img.width && img.height) {
          console.log(`   Dimensions: ${img.width}x${img.height}`);
        }
        console.log();
      });
    }

    return content.images;
  } catch (error: any) {
    console.error("✗ Image extraction failed:", error.message);
    throw error;
  }
}

async function testErrorHandling() {
  console.log("\n=== Testing Error Handling ===\n");

  const testCases = [
    {
      url: "https://nonexistent-domain-12345.com",
      expectedStatus: "failed",
      description: "Non-existent domain",
    },
    {
      url: "https://httpstat.us/403",
      expectedStatus: "blocked",
      description: "403 Forbidden",
    },
  ];

  for (const testCase of testCases) {
    try {
      console.log(`Testing: ${testCase.description}`);
      console.log(`URL: ${testCase.url}`);

      const content = await extractContent(testCase.url, { timeout: 5000 });

      console.log(`Status: ${content.fetchStatus}`);
      if (content.fetchError) {
        console.log(`Error: ${content.fetchError}`);
      }

      const passed = content.fetchStatus === testCase.expectedStatus;
      console.log(passed ? "✓ PASS" : "✗ FAIL");
      console.log();
    } catch (error: any) {
      console.error("✗ Test case failed:", error.message);
      console.log();
    }
  }
}

async function main() {
  console.log("===========================================");
  console.log("    Content Extraction Test Suite");
  console.log("===========================================");

  try {
    // Run tests
    await testSingleExtraction();
    await testMultipleExtractions();
    await testExtractionOptions();
    await testContentPreview();
    await testImageExtraction();
    await testErrorHandling();

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
